import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronDown, Loader2, CheckCircle2, AlertCircle, ThumbsUp, Pencil, Trash2, X, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 6;

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 30) return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return 'Just now';
}

const AVATAR_COLORS = [
  'bg-blue-500/20 text-blue-400 ring-blue-500/20',
  'bg-purple-500/20 text-purple-400 ring-purple-500/20',
  'bg-emerald-500/20 text-emerald-400 ring-emerald-500/20',
  'bg-rose-500/20 text-rose-400 ring-rose-500/20',
  'bg-amber-500/20 text-amber-400 ring-amber-500/20',
  'bg-cyan-500/20 text-cyan-400 ring-cyan-500/20',
];

function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StarRating({
  value, onChange, readonly = false, size = 20,
}: {
  value: number; onChange?: (v: number) => void; readonly?: boolean; size?: number;
}) {
  const [hovered, setHovered] = useState(0);
  const display = readonly ? value : (hovered || value);
  return (
    <div className="flex items-center gap-0.5" role={readonly ? undefined : 'group'} aria-label={readonly ? `${value} out of 5 stars` : 'Select rating'}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`transition-transform ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95'}`}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          <Star
            size={size}
            className={`transition-colors duration-100 ${star <= display ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-muted-foreground/25'}`}
          />
        </button>
      ))}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const color = avatarColor(name);
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-1 ${color}`}>
      {initials(name)}
    </div>
  );
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-3">{label}</span>
      <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-amber-400"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-muted-foreground/60 w-7 text-right">{count}</span>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Review {
  review_id: string;
  reviewer_name: string;
  review_text: string;
  rating: number;
  helpful_count: number;
  created_at: string;
  user_id?: string;
}

interface ReviewStats {
  avg_rating: number;
  total: number;
  distribution: Record<string, number>;
}

// ── Main Component ─────────────────────────────────────────────────────────

interface ReviewsSectionProps {
  sectionRef?: React.RefObject<HTMLElement>;
}

export default function ReviewsSection({ sectionRef }: ReviewsSectionProps) {
  const { user } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [helpfulSet, setHelpfulSet] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editRating, setEditRating] = useState(5);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'You';

  const fetchReviews = useCallback(async (offset = 0, append = false) => {
    try {
      const { data, count, error } = await supabase
        .from('reviews')
        .select('review_id, user_id, reviewer_name, review_text, rating, helpful_count, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const fetched: Review[] = data ?? [];
      setReviews(prev => append ? [...prev, ...fetched] : fetched);
      const total = count ?? fetched.length;
      setTotal(total);
      // Compute stats from all ratings via a separate lightweight query
      const { data: allRatings } = await supabase.from('reviews').select('rating');
      if (allRatings && allRatings.length > 0) {
        const dist: Record<string, number> = {};
        allRatings.forEach(r => { dist[r.rating] = (dist[r.rating] || 0) + 1; });
        const avg = allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length;
        setStats({ avg_rating: parseFloat(avg.toFixed(1)), total: allRatings.length, distribution: dist });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    fetchReviews(reviews.length, true);
  };

  const handleSubmit = async () => {
    if (!reviewText.trim()) { setFormError('Please write something before submitting.'); return; }
    if (!user) { setFormError('You must be signed in to post a review.'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const newReview = {
        review_id: crypto.randomUUID(),
        user_id: user.id,
        reviewer_name: userName,
        review_text: reviewText.trim().slice(0, 2000),
        rating,
        helpful_count: 0,
      };
      const { data, error } = await supabase.from('reviews').insert(newReview).select().single();
      if (error) throw error;
      const created: Review = data;
      setReviews(prev => [created, ...prev]);
      setTotal(t => t + 1);
      setStats(s => s ? {
        ...s,
        avg_rating: parseFloat(((s.avg_rating * s.total + rating) / (s.total + 1)).toFixed(1)),
        total: s.total + 1,
        distribution: { ...s.distribution, [rating]: (s.distribution[rating] || 0) + 1 },
      } : { avg_rating: rating, total: 1, distribution: { [rating]: 1 } });
      setReviewText('');
      setRating(5);
      setFormSuccess('Review published! Thank you.');
      setTimeout(() => setFormSuccess(''), 5000);
    } catch (e: any) {
      setFormError(e.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (review: Review) => {
    setEditingId(review.review_id);
    setEditText(review.review_text);
    setEditRating(review.rating);
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
    setEditRating(5);
  };

  const saveEdit = async (reviewId: string) => {
    if (!editText.trim()) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ review_text: editText.trim().slice(0, 2000), rating: editRating })
        .eq('review_id', reviewId)
        .eq('user_id', user!.id);
      if (error) throw error;
      setReviews(prev => prev.map(r =>
        r.review_id === reviewId ? { ...r, review_text: editText.trim(), rating: editRating } : r
      ));
      cancelEdit();
    } catch {
      // silent — keep edit open
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    setDeletingId(reviewId);
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('review_id', reviewId)
        .eq('user_id', user!.id);
      if (error) throw error;
      setReviews(prev => prev.filter(r => r.review_id !== reviewId));
      setTotal(t => t - 1);
      setStats(s => s ? { ...s, total: s.total - 1 } : null);
      setConfirmDeleteId(null);
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  const handleHelpful = async (reviewId: string) => {
    if (helpfulSet.has(reviewId)) return;
    setHelpfulSet(prev => new Set([...prev, reviewId]));
    setReviews(prev => prev.map(r => r.review_id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r));
  };

  const avgRating = stats?.avg_rating ?? 0;
  const dist = stats?.distribution ?? {};

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} id="reviews" className="w-full max-w-4xl mx-auto px-4 py-16">

      {/* ── Header ── */}
      <div className="mb-10 text-center">
        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-2">Reviews</p>
        <h2 className="font-serif text-3xl font-semibold text-foreground mb-3">
          What users say about Shadow Board
        </h2>
        {total > 0 && (
          <div className="flex items-center justify-center gap-3 mt-3">
            <StarRating value={Math.round(avgRating)} readonly size={20} />
            <span className="text-2xl font-bold text-foreground">{avgRating.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">
              · {total} review{total !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr] items-start">

        {/* ── Left: review list ── */}
        <div className="space-y-4">

          {/* Rating distribution (shown when stats loaded) */}
          {stats && stats.total > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-slate-950/60 p-5 mb-6 space-y-2"
            >
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-mono">Rating breakdown</p>
              {[5, 4, 3, 2, 1].map(star => (
                <RatingBar key={star} label={String(star)} count={dist[star] ?? 0} total={stats.total} />
              ))}
            </motion.div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-muted-foreground/40" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-10 text-center">
              <Star size={36} className="mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm font-medium text-foreground mb-1">No reviews yet</p>
              <p className="text-xs text-muted-foreground">Be the first to share your experience with Shadow Board.</p>
            </div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {reviews.map((review, i) => (
                  <motion.div
                    key={review.review_id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.28, delay: i < PAGE_SIZE ? i * 0.04 : 0 }}
                    className="rounded-2xl border border-border bg-slate-950/90 p-5 shadow-lg group"
                  >
                    {/* Header row */}
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar name={review.reviewer_name || 'A'} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {review.reviewer_name || 'Anonymous'}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground/60">
                              {timeAgo(review.created_at)}
                            </span>
                            {/* Owner controls */}
                            {user?.id === review.user_id && editingId !== review.review_id && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => startEdit(review)}
                                  className="p-1 rounded-md text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-all"
                                  title="Edit review"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(review.review_id)}
                                  className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all"
                                  title="Delete review"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {editingId !== review.review_id && (
                          <StarRating value={review.rating} readonly size={13} />
                        )}
                      </div>
                    </div>

                    {/* Delete confirmation */}
                    {confirmDeleteId === review.review_id && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-between gap-3"
                      >
                        <p className="text-xs text-destructive">Delete this review permanently?</p>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[11px] px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(review.review_id)}
                            disabled={deletingId === review.review_id}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-destructive text-white hover:bg-destructive/80 transition-colors flex items-center gap-1 disabled:opacity-60"
                          >
                            {deletingId === review.review_id
                              ? <Loader2 size={10} className="animate-spin" />
                              : <Trash2 size={10} />}
                            Delete
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Edit mode */}
                    {editingId === review.review_id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">Rating</label>
                          <StarRating value={editRating} onChange={setEditRating} size={22} />
                        </div>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value.slice(0, 500))}
                          rows={4}
                          className="w-full rounded-xl border border-primary/30 bg-secondary/20 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
                          autoFocus
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground/50">{editText.length}/500</span>
                          <div className="flex gap-2">
                            <button
                              onClick={cancelEdit}
                              className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X size={11} /> Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(review.review_id)}
                              disabled={editSaving || !editText.trim()}
                              className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg gold-gradient text-primary-foreground font-semibold disabled:opacity-50 transition-all"
                            >
                              {editSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed text-muted-foreground mb-4">
                          {review.review_text}
                        </p>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => handleHelpful(review.review_id)}
                            disabled={helpfulSet.has(review.review_id) || user?.id === review.user_id}
                            className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                              helpfulSet.has(review.review_id)
                                ? 'border-primary/30 text-primary bg-primary/5'
                                : user?.id === review.user_id
                                  ? 'border-border/30 text-muted-foreground/30 cursor-default'
                                  : 'border-border text-muted-foreground/50 hover:border-primary/30 hover:text-primary/70'
                            }`}
                            title={user?.id === review.user_id ? "Can't mark your own review as helpful" : ''}
                          >
                            <ThumbsUp size={11} />
                            {helpfulSet.has(review.review_id) ? 'Helpful' : 'Mark as helpful'}
                            {review.helpful_count > 0 && (
                              <span className="opacity-60">({review.helpful_count})</span>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {reviews.length < total && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all flex items-center justify-center gap-2"
                >
                  {loadingMore
                    ? <Loader2 size={14} className="animate-spin" />
                    : <ChevronDown size={14} />}
                  {loadingMore
                    ? 'Loading...'
                    : `Load more · ${total - reviews.length} remaining`}
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Right: write review ── */}
        <div className="rounded-2xl border border-border bg-slate-950/90 p-6 sticky top-24">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-1">Share your experience</p>
          <h3 className="text-xl font-semibold text-foreground mb-6">Write a review</h3>

          {/* Posting as */}
          <div className="mb-5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-2">
              Posting as
            </label>
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/30 border border-border">
              <Avatar name={userName} />
              <div>
                <p className="text-sm font-medium text-foreground leading-tight">{userName}</p>
                {user?.email && (
                  <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{user.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Star rating input */}
          <div className="mb-5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-2">
              Your rating
            </label>
            <StarRating value={rating} onChange={setRating} size={30} />
            <p className="text-[10px] text-muted-foreground mt-1">
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
            </p>
          </div>

          {/* Review textarea */}
          <div className="mb-5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-2">
              Your review
            </label>
            <textarea
              value={reviewText}
              onChange={(e) => {
                setReviewText(e.target.value.slice(0, 500));
                setFormError('');
              }}
              rows={5}
              placeholder="How did Shadow Board help your decision process?"
              className="w-full rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/40 transition-colors resize-none placeholder:text-muted-foreground/40"
            />
            <div className="flex justify-end mt-1">
              <span className={`text-[10px] ${reviewText.length >= 450 ? 'text-amber-400' : 'text-muted-foreground/50'}`}>
                {reviewText.length}/500
              </span>
            </div>
          </div>

          {/* Feedback messages */}
          <AnimatePresence>
            {formError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-xs text-destructive mb-4 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20"
              >
                <AlertCircle size={12} className="shrink-0" /> {formError}
              </motion.div>
            )}
            {formSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-xs text-emerald-400 mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
              >
                <CheckCircle2 size={12} className="shrink-0" /> {formSuccess}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleSubmit}
            disabled={submitting || !reviewText.trim()}
            className="w-full py-3 rounded-xl gold-gradient text-primary-foreground font-bold text-sm uppercase tracking-wider hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            {submitting ? 'Publishing...' : 'Publish Review'}
          </button>
        </div>
      </div>
    </section>
  );
}

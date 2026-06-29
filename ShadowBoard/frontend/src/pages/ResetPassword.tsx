import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase exchanges the token from the URL automatically via onAuthStateChange
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if we already have a session (page reload scenario)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/'), 2500);
  };

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 bg-grid-pattern">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold gold-gradient-text">SHADOW BOARD</h1>
        </div>

        <div className="glass-card-strong rounded-2xl p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-cmo/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-cmo" />
              </div>
              <h2 className="text-xl font-serif font-bold text-foreground mb-2">Password updated!</h2>
              <p className="text-sm text-muted-foreground">Redirecting you back to the app…</p>
            </div>
          ) : !sessionReady ? (
            <div className="text-center py-8">
              <Loader2 size={32} className="animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Verifying reset link…</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-serif font-bold text-foreground mb-1">Set new password</h2>
              <p className="text-sm text-muted-foreground mb-6">Choose a strong password for your account.</p>

              <div className="space-y-3">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-destructive text-xs"
                  >
                    <AlertCircle size={14} className="shrink-0" />
                    {error}
                  </motion.div>
                )}

                {/* New password */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                    <Lock size={16} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New password (min. 8 characters)"
                    value={password}
                    autoComplete="new-password"
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-secondary/40 border border-border rounded-lg pl-10 pr-10 py-3 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Confirm password */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                    <Lock size={16} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirm}
                    autoComplete="new-password"
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                    className="w-full bg-secondary/40 border border-border rounded-lg pl-10 pr-10 py-3 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                  />
                </div>

                {/* Password strength indicator */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            password.length >= [8, 10, 12, 14][i]
                              ? password.length >= 14 ? 'bg-cmo' : password.length >= 10 ? 'bg-primary' : 'bg-destructive/70'
                              : 'bg-border'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {password.length < 8 ? 'Too short' : password.length < 10 ? 'Weak' : password.length < 14 ? 'Good' : 'Strong'}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="w-full py-3 rounded-xl gold-gradient text-primary-foreground font-bold text-sm tracking-wide hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Update password
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

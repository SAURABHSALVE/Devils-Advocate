-- ============================================================
-- ShadowBoard — Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Profiles (extends auth.users with display name) ──────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sessions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
    session_id       TEXT PRIMARY KEY,
    user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question         TEXT NOT NULL,
    context          TEXT DEFAULT '',
    board_type       TEXT DEFAULT 'tech',
    votes            JSONB DEFAULT '{}',
    moderator_summary TEXT DEFAULT '',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Comparisons ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comparisons (
    comparison_id       TEXT PRIMARY KEY,
    user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    option_a            TEXT NOT NULL,
    option_b            TEXT NOT NULL,
    context             TEXT DEFAULT '',
    board_type          TEXT DEFAULT 'tech',
    votes_a             JSONB DEFAULT '{}',
    votes_b             JSONB DEFAULT '{}',
    comparison_summary  TEXT DEFAULT '',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Reviews ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
    review_id     TEXT PRIMARY KEY,
    user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewer_name TEXT NOT NULL,
    rating        INTEGER DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
    review_text   TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_user_id   ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created   ON public.sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comparisons_user   ON public.comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created    ON public.reviews(created_at DESC);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews    ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- sessions (backend service key bypasses RLS; these protect direct API calls)
CREATE POLICY "Users can read own sessions"
    ON public.sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage sessions"
    ON public.sessions FOR ALL USING (true);

-- comparisons
CREATE POLICY "Users can read own comparisons"
    ON public.comparisons FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage comparisons"
    ON public.comparisons FOR ALL USING (true);

-- reviews — public read, authenticated write
CREATE POLICY "Anyone can read reviews"
    ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert reviews"
    ON public.reviews FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL OR user_id IS NULL
    );

-- ── Auto-create profile on signup ─────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, name)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'full_name',
            split_part(NEW.email, '@', 1)
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

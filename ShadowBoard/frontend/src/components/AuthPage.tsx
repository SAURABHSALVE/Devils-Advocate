import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type View = 'login' | 'signup' | 'forgot' | 'check-email';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

interface FieldProps {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  rightEl?: React.ReactNode;
}

function Field({ icon, type, placeholder, value, onChange, autoComplete, rightEl }: FieldProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-secondary/40 border border-border rounded-lg pl-10 pr-10 py-3 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
      />
      {rightEl && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</span>
      )}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-destructive text-xs"
    >
      <AlertCircle size={14} className="shrink-0" />
      {message}
    </motion.div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-lg bg-cmo/10 border border-cmo/30 px-3 py-2 text-cmo text-xs"
    >
      <CheckCircle2 size={14} className="shrink-0" />
      {message}
    </motion.div>
  );
}

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();

  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reset = () => { setError(''); setSuccess(''); };

  const handleLogin = async () => {
    reset();
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    const { error: err } = await signIn(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  const handleSignup = async () => {
    reset();
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!email.trim()) { setError('Please enter your email.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    const { error: err } = await signUp(email.trim(), password, name.trim());
    setLoading(false);
    if (err) { setError(err); return; }
    setView('check-email');
  };

  const handleForgot = async () => {
    reset();
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);
    const { error: err } = await resetPassword(email.trim());
    setLoading(false);
    if (err) { setError(err); return; }
    setView('check-email');
  };

  const handleGoogle = async () => {
    reset();
    setGoogleLoading(true);
    const { error: err } = await signInWithGoogle();
    setGoogleLoading(false);
    if (err) setError(err);
  };

  const switchView = (v: View) => { reset(); setView(v); };

  return (
    <div className="min-h-svh flex bg-grid-pattern">
      {/* ── Left branding panel (hidden on small screens) ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-border/20 bg-background/60 backdrop-blur-sm">
        <div>
          <h1 className="text-4xl font-serif font-bold gold-gradient-text tracking-tight">SHADOW BOARD</h1>
          <p className="mt-2 text-muted-foreground text-sm tracking-wide">AI-Powered Executive Decision Simulation</p>
        </div>

        <div className="space-y-6">
          {[
            { icon: '🔍', label: 'Research', desc: 'CFO, CMO, and Legal counsel independently research every angle of your question with live web search.' },
            { icon: '⚔️', label: 'Debate', desc: 'Three structured rounds of adversarial debate with a dedicated Devil\'s Advocate who challenges all consensus.' },
            { icon: '📋', label: 'Strategy Brief', desc: 'A signed PDF strategy brief with vote tally, risk matrix, and recommended next steps — in minutes.' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex gap-4 items-start">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="font-semibold text-sm text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          {['CFO', 'CMO', 'Legal', 'D.A.', 'Mod'].map((role, i) => (
            <div
              key={role}
              className="flex flex-col items-center gap-1 glass-card rounded-xl px-3 py-2"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary">{role[0]}</span>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right auth panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <h1 className="text-4xl font-serif font-bold gold-gradient-text">SHADOW BOARD</h1>
          <p className="mt-1 text-muted-foreground text-xs">AI-Powered Executive Decision Simulation</p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── Check email ── */}
          {view === 'check-email' && (
            <motion.div
              key="check-email"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="w-full max-w-md glass-card-strong rounded-2xl p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mail size={28} className="text-primary" />
              </div>
              <h2 className="text-xl font-serif font-bold text-foreground mb-2">Check your email</h2>
              <p className="text-sm text-muted-foreground mb-6">
                We sent a link to <span className="text-foreground font-medium">{email}</span>.
                Click it to continue — check your spam folder if you don't see it.
              </p>
              <button
                onClick={() => switchView('login')}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
              >
                <ArrowLeft size={14} /> Back to login
              </button>
            </motion.div>
          )}

          {/* ── Forgot password ── */}
          {view === 'forgot' && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="w-full max-w-md glass-card-strong rounded-2xl p-8"
            >
              <button
                onClick={() => switchView('login')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft size={14} /> Back to login
              </button>

              <h2 className="text-2xl font-serif font-bold text-foreground mb-1">Forgot password?</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Enter your email and we'll send you a reset link.
              </p>

              <div className="space-y-3">
                {error && <ErrorBanner message={error} />}
                {success && <SuccessBanner message={success} />}

                <Field
                  icon={<Mail size={16} />}
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                />

                <button
                  onClick={handleForgot}
                  disabled={loading}
                  className="w-full py-3 rounded-xl gold-gradient text-primary-foreground font-bold text-sm tracking-wide hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Send reset link
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Login / Signup ── */}
          {(view === 'login' || view === 'signup') && (
            <motion.div
              key="auth-form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="w-full max-w-md"
            >
              <div className="glass-card-strong rounded-2xl p-8">

                {/* Tabs */}
                <div className="flex gap-1 mb-7 bg-secondary/40 rounded-xl p-1">
                  {(['login', 'signup'] as View[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => switchView(v)}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                        view === v
                          ? 'gold-gradient text-primary-foreground shadow'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {v === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                  ))}
                </div>

                {/* Google OAuth */}
                <button
                  onClick={handleGoogle}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 active:scale-[0.98] transition-all text-sm font-medium text-foreground disabled:opacity-60"
                >
                  {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
                  Continue with Google
                </button>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-[11px] text-muted-foreground uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>

                {/* Form fields */}
                <div className="space-y-3">
                  {error && <ErrorBanner message={error} />}
                  {success && <SuccessBanner message={success} />}

                  <AnimatePresence>
                    {view === 'signup' && (
                      <motion.div
                        key="name-field"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <Field
                          icon={<User size={16} />}
                          type="text"
                          placeholder="Your full name"
                          value={name}
                          onChange={setName}
                          autoComplete="name"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Field
                    icon={<Mail size={16} />}
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                  />

                  <Field
                    icon={<Lock size={16} />}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={view === 'signup' ? 'Min. 8 characters' : 'Your password'}
                    value={password}
                    onChange={setPassword}
                    autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                    rightEl={
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((p) => !p)}
                        className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />

                  {view === 'login' && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => switchView('forgot')}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  <button
                    onClick={view === 'login' ? handleLogin : handleSignup}
                    disabled={loading}
                    onKeyDown={(e) => e.key === 'Enter' && (view === 'login' ? handleLogin() : handleSignup())}
                    className="w-full py-3 rounded-xl gold-gradient text-primary-foreground font-bold text-sm tracking-wide hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {view === 'login' ? 'Sign In' : 'Create Account'}
                  </button>
                </div>

                {/* Switch mode hint */}
                <p className="mt-5 text-center text-xs text-muted-foreground">
                  {view === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    onClick={() => switchView(view === 'login' ? 'signup' : 'login')}
                    className="text-primary hover:underline font-medium"
                  >
                    {view === 'login' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>

              <p className="mt-4 text-center text-[11px] text-muted-foreground/50">
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

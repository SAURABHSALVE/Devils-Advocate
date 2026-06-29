import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, AlertCircle, Shield, CheckCircle2, Users, MessageSquare, FileText, Mic, MicOff, GitCompare } from 'lucide-react';
import PhaseIndicator from '@/components/PhaseIndicator';
import MessageCard, { type AgentMessage } from '@/components/MessageCard';
import HumanInputPanel from '@/components/HumanInputPanel';
import TypingIndicator from '@/components/TypingIndicator';
import ReviewsSection from '@/components/ReviewsSection';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useAuth } from '@/context/AuthContext';
import AuthPage from '@/components/AuthPage';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

const PHASE_MAP: Record<string, number> = {
  research: 0,
  debate_round1: 1,
  hitl: 2,
  debate_round2: 3,
  debate_round3: 4,
  synthesis: 5,
};

const EXAMPLE_QUESTIONS = [
  "Should Spotify acquire a podcast analytics company?",
  "Should we expand our SaaS product to the European market?",
  "Should we pivot from B2C to B2B?",
];

const COMPARISON_EXAMPLES = [
  { a: "Should we expand to the European market?", b: "Should we expand to the Asian market?" },
  { a: "Should we build the feature in-house?", b: "Should we acquire a company that already has the feature?" },
];

const Index = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState(''); 
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null);

  const voiceQuestion = useSpeechRecognition(
    useCallback((text: string) => setQuestion((prev) => prev + (prev ? ' ' : '') + text), [])
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [boardType, setBoardType] = useState('tech');
  const { user, signOut, getAccessToken } = useAuth();
  const howItWorksRef = useRef<HTMLDivElement | null>(null);
  const reviewsRef = useRef<HTMLElement | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [compareSession, setCompareSession] = useState<any>(null);
  const [compareWith, setCompareWith] = useState<any>(null);

  // Scenario Comparison Mode
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [messagesA, setMessagesA] = useState<AgentMessage[]>([]);
  const [messagesB, setMessagesB] = useState<AgentMessage[]>([]);
  const [comparisonResult, setComparisonResult] = useState<string | null>(null);
  const [comparisonPhase, setComparisonPhase] = useState<string>('');
  const [votesA, setVotesA] = useState<Record<string, string>>({});
  const [votesB, setVotesB] = useState<Record<string, string>>({});
  const [comparisonPaused, setComparisonPaused] = useState(false);
  const [activeScenarioTab, setActiveScenarioTab] = useState<'A' | 'B' | 'analysis'>('A');
  const [scenarioAComplete, setScenarioAComplete] = useState(false);
  const [scenarioBComplete, setScenarioBComplete] = useState(false);
  const [phaseA, setPhaseA] = useState<string>('');
  const [phaseB, setPhaseB] = useState<string>('');
  const [slackSent, setSlackSent] = useState(false);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToSection = (ref: React.RefObject<HTMLElement | HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, messagesA, messagesB, isPaused, comparisonPaused, scrollToBottom]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const initSSE = useCallback(async (sid: string) => {
    const token = await getAccessToken();
    const url = token
      ? `${API_BASE}/api/${sid}/agents_research?token=${encodeURIComponent(token)}`
      : `${API_BASE}/api/${sid}/agents_research`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    setIsThinking(true);

    es.addEventListener('phase', (e) => {
      try {
        const data = JSON.parse(e.data);
        
        if (data.phase === 'research') {
            setCurrentPhase(0);
        } else if (data.phase === 'debate' && data.round === 1) {
            setCurrentPhase(1);
        } else if (data.phase === 'debate' && data.round === 2) {
            setCurrentPhase(3);
        } else if (data.phase === 'debate' && data.round === 3) {
            setCurrentPhase(4);
        } else if (data.phase === 'synthesis') {
            setCurrentPhase(5);
        }
        
        setIsThinking(true);
      } catch { /* ignore */ }
    });
    es.addEventListener('agent_start', (e) => {
    try {
        const data = JSON.parse(e.data);
        setThinkingAgent(`${data.agent} is ${data.action}...`);
        setIsThinking(true);
    } catch { /* ignore */ }
});

    es.addEventListener('agent_message', (e) => {
      try {
        const data = JSON.parse(e.data) as AgentMessage;
        setMessages((prev) => [...prev, data]);
        setIsThinking(false);
        setThinkingAgent(null);
        // Brief pause then show thinking again for next message
        setTimeout(() => setIsThinking(true), 800);
      } catch { /* ignore */ }
    });

    es.addEventListener('pause', (e) => {
      try { JSON.parse(e.data); } catch { /* ignore */ }
      setIsPaused(true);
      setIsThinking(false);
      setCurrentPhase(2); // HITL phase
    });

    es.addEventListener('heartbeat', () => {
      // Keep connection alive while waiting for human input
    });

    es.addEventListener('brief_ready', (e) => {
      try { JSON.parse(e.data); } catch { /* ignore */ }
    });

    es.addEventListener('resume', () => {
      setIsPaused(false);
      setIsThinking(true);
    });

    let serverErrorReceived = false;

    es.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        serverErrorReceived = true;
        setError(data.message || 'Pipeline error occurred.');
        setIsThinking(false);
        es.close();
      } catch { /* ignore */ }
    });

    es.addEventListener('complete', () => {
      setIsComplete(true);
      setIsThinking(false);
      es.close();
    });

    es.onerror = () => {
      if (!serverErrorReceived && es.readyState !== EventSource.CLOSED) {
        setError('Connection to Board lost — check that the backend is running and OPENAI_API_KEY is set on Render.');
        setIsThinking(false);
      }
    };
  }, []);

  const startDebate = async () => {
    if (!question.trim()) return;
    setIsStarting(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/session/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context, board_type: boardType }),
      });
      const data = await res.json();
      setSessionId(data.session);

      // Upload file if one was selected
      if (uploadedFile) {
        const formData = new FormData();
        formData.append('file', uploadedFile);
        await authFetch(`${API_BASE}/api/${data.session}/upload`, {
          method: 'POST',
          body: formData,
        });
      }

      initSSE(data.session);
    } catch {
      setError('Failed to initialize session. Ensure backend is running.');
      setIsStarting(false);
    }
  };


  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getAccessToken();
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers as Record<string, string> || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [getAccessToken]);

  const submitHumanInput = async (text: string, targetAgent: string = 'all') => {
    if (!sessionId) return;
    try {
      const response = await authFetch(`${API_BASE}/api/${sessionId}/human_input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ human_ip: text, target_agent: targetAgent }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      // Only update state after backend confirms receipt
      setIsPaused(false);
      setIsThinking(true);
    } catch {
      setError('Failed to send input. Please try again.');
    }
  };
  const loadHistory = async () => {
      if (!user) return;
      try {
          const res = await authFetch(`${API_BASE}/api/sessions/history`);
          const data = await res.json();
          setHistory(data.sessions);
          setShowHistory(true);
      } catch {
          setError('Failed to load history');
      }
  };

  // Scenario Comparison: init SSE (parallel execution)
  const initComparisonSSE = useCallback(async (cid: string) => {
    const token = await getAccessToken();
    const url = token
      ? `${API_BASE}/api/${cid}/compare?token=${encodeURIComponent(token)}`
      : `${API_BASE}/api/${cid}/compare`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    setIsThinking(true);

    es.addEventListener('phase', (e) => {
      try {
        const data = JSON.parse(e.data);
        setComparisonPhase(data.phase);
        setIsThinking(true);
        // Track per-scenario phases independently (both run in parallel)
        if (data.phase.startsWith('scenario_a')) {
          setPhaseA(data.phase);
        } else if (data.phase.startsWith('scenario_b')) {
          setPhaseB(data.phase);
        } else if (data.phase === 'comparative_analysis') {
          setActiveScenarioTab('analysis');
        }
        // Don't auto-switch tabs during parallel execution — let user toggle freely
      } catch { /* ignore */ }
    });

    es.addEventListener('comparison_status', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.votes) {
          if (data.scenario === 'A') { setVotesA(data.votes); setScenarioAComplete(true); }
          if (data.scenario === 'B') { setVotesB(data.votes); setScenarioBComplete(true); }
        }
      } catch { /* ignore */ }
    });

    es.addEventListener('agent_start', (e) => {
      try {
        const data = JSON.parse(e.data);
        setThinkingAgent(`${data.agent} is ${data.action}...`);
        setIsThinking(true);
      } catch { /* ignore */ }
    });

    es.addEventListener('agent_message', (e) => {
      try {
        const data = JSON.parse(e.data) as AgentMessage;
        if (data.scenario === 'A') {
          setMessagesA((prev) => [...prev, data]);
        } else if (data.scenario === 'B') {
          setMessagesB((prev) => [...prev, data]);
        } else if (data.agent === 'Comparison Analyst') {
          setComparisonResult(data.text);
        }
        setIsThinking(false);
        setThinkingAgent(null);
        setTimeout(() => setIsThinking(true), 800);
      } catch { /* ignore */ }
    });

    es.addEventListener('pause', (e) => {
      try {
        JSON.parse(e.data);
        setComparisonPaused(true);
        setIsThinking(false);
      } catch { /* ignore */ }
    });

    es.addEventListener('heartbeat', () => {
      // Keep connection alive
    });

    es.addEventListener('resume', () => {
      setComparisonPaused(false);
      setIsThinking(true);
    });

    es.addEventListener('slack_sent', () => {
      setSlackSent(true);
    });

    es.addEventListener('brief_ready', () => { /* pdf ready */ });

    es.addEventListener('complete', () => {
      setIsComplete(true);
      setIsThinking(false);
      es.close();
    });

    let compServerErrorReceived = false;

    es.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        compServerErrorReceived = true;
        setError(data.message || 'Comparison error occurred.');
        setIsThinking(false);
        es.close();
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      if (!compServerErrorReceived && es.readyState !== EventSource.CLOSED) {
        setError('Connection lost — check that the backend is running and OPENAI_API_KEY is set on Render.');
        setIsThinking(false);
      }
    };
  }, []);

  const submitComparisonHumanInput = async (text: string, targetAgent: string = 'all') => {
    if (!comparisonId) return;
    try {
      const response = await authFetch(`${API_BASE}/api/${comparisonId}/comparison_human_input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ human_ip: text, target_agent: targetAgent }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setComparisonPaused(false);
      setIsThinking(true);
    } catch {
      setError('Failed to send input. Please try again.');
    }
  };

  const startComparison = async () => {
    if (!optionA.trim() || !optionB.trim()) return;
    setIsStarting(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/comparison/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          option_a: optionA,
          option_b: optionB,
          context,
          board_type: boardType,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setIsStarting(false);
        return;
      }
      setComparisonId(data.comparison_id);
      initComparisonSSE(data.comparison_id);
    } catch {
      setError('Failed to start comparison. Ensure backend is running.');
      setIsStarting(false);
    }
  };

  const resetAll = () => {
    setSessionId(null);
    setComparisonId(null);
    setMessages([]);
    setMessagesA([]);
    setMessagesB([]);
    setComparisonResult(null);
    setComparisonPhase('');
    setVotesA({});
    setVotesB({});
    setCurrentPhase(0);
    setIsPaused(false);
    setIsComplete(false);
    setIsStarting(false);
    setIsThinking(false);
    setQuestion('');
    setOptionA('');
    setOptionB('');
    setContext('');
    setBoardType('tech');
    setUploadedFile(null);
    setError(null);
    setCompareSession(null);
    setShowHistory(false);
    setCompareWith(null);
    setComparisonPaused(false);
    setActiveScenarioTab('A');
    setScenarioAComplete(false);
    setScenarioBComplete(false);
    setPhaseA('');
    setPhaseB('');
    setSlackSent(false);
    eventSourceRef.current?.close();
  };

  if (!user) return <AuthPage />;
  const agentCount = new Set(messages.map(m => m.agent)).size;
  const roundCount = new Set(messages.filter(m => m.round).map(m => m.round)).size;

  // Landing page (only if no single debate AND no comparison running)
  if (!sessionId && !comparisonId) {
    return (
      <div className="min-h-svh flex flex-col bg-grid-pattern">
        {/* Top bar */}
        <div className="flex flex-col gap-3 px-4 py-4 md:px-6 md:flex-row md:items-center md:justify-between border-b border-border/20 bg-background/90 backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
          <div className="flex items-center gap-3">
            <span className="font-serif text-xl font-semibold gold-gradient-text">Shadow Board</span>
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Decision intelligence</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            <button onClick={() => scrollToSection(howItWorksRef)} className="transition-colors hover:text-primary">How it works</button>
            <button onClick={() => scrollToSection(reviewsRef)} className="transition-colors hover:text-primary">Reviews</button>
            <button onClick={loadHistory} className="transition-colors hover:text-primary">Past sessions</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 glass-card rounded-full px-4 py-2 text-[10px] font-mono text-muted-foreground">
            Welcome, {user?.user_metadata?.name || user?.email?.split('@')[0] || 'Guest'}
          </span>
          <button
            onClick={signOut}
            className="flex items-center gap-2 glass-card rounded-full px-4 py-2 hover:bg-destructive/10 transition-colors"
          >
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Logout</span>
          </button>
          <div className="flex items-center gap-2 glass-card rounded-full px-4 py-2">
            <Shield size={14} className="text-primary" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Powered by AIRIA</span>
          </div>
        </div>
      </div>

      {showHistory && (
    <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto px-6 mb-8">
        <div className="glass-card-strong rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="font-serif text-xl font-bold gold-gradient-text">Past Sessions</h2>
                <button
                    onClick={() => setShowHistory(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                >
                    ✕ Close
                </button>
            </div>
            {history.length === 0 ? (
                <p className="text-muted-foreground text-sm">No past sessions yet.</p>
            ) : (
                <div className="space-y-3">
                    {history.map((s: any) => (
                  <div
                      key={s.session_id}
                      className="glass-card rounded-lg p-4 hover:bg-primary/5 transition-colors"
                  >
                      <div className="flex justify-between items-start mb-2">
                          <p className="text-sm font-medium text-foreground flex-1">{s.question}</p>
                          <span className="text-[10px] font-mono text-muted-foreground ml-2">
                              {new Date(s.created_at).toLocaleDateString()}
                          </span>
                      </div>
                      <div className="flex gap-2 text-xs mb-3 flex-wrap">
                          <span className="uppercase font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50">
                              {s.board_type}
                          </span>
                          {Object.entries(s.votes || {}).map(([agent, vote]: [string, any]) => (
                              <span key={agent} className={`px-2 py-0.5 rounded-full ${
                                  vote === 'GO' ? 'bg-cmo/10 text-cmo' :
                                  vote === 'NO-GO' ? 'bg-devil/10 text-devil' : 'bg-legal/10 text-legal'
                              }`}>
                                  {agent}: {vote}
                              </span>
                          ))}
                      </div>
                      {s.moderator_summary && (
                          <details className="text-xs text-muted-foreground">
                              <summary className="cursor-pointer hover:text-foreground transition-colors font-mono uppercase tracking-wider mb-2">
                                  View Strategy Brief
                              </summary>
                              <div className="bg-secondary/30 rounded-lg p-3 mt-1 text-foreground/70 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                  {s.moderator_summary}
                              </div>
                          </details>
                      )}
                      <div className="flex gap-2 mt-3">
                          <button
                              onClick={() => {
                                  setQuestion(s.question);
                                  setContext(s.context || '');
                                  setBoardType(s.board_type || 'tech');
                                  setShowHistory(false);
                              }}
                              className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                          >
                              Re-run this question
                          </button>
                          <button
                              onClick={() => {
                                  if (compareSession && compareSession.session_id !== s.session_id) {
                                      setCompareWith(s);
                                  } else {
                                      setCompareSession(s);
                                  }
                              }}
                              className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-all"
                          >
                              {compareSession?.session_id === s.session_id ? '✓ Selected' : 'Compare'}
                          </button>
                      </div>
                  </div>
              ))}
                </div>
            )}
            {compareSession && compareWith && (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 border-t border-border/30 pt-6"
    >
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif text-lg font-bold gold-gradient-text">
                Session Comparison
            </h3>
            <button
                onClick={() => { setCompareSession(null); setCompareWith(null); }}
                className="text-xs text-muted-foreground hover:text-foreground"
            >
                ✕ Clear comparison
            </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
            {[compareSession, compareWith].map((s: any, idx: number) => (
                <div key={idx} className="glass-card rounded-lg p-4">
                    <p className="text-sm font-medium text-foreground mb-3">
                        {s.question}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-3">
                        {Object.entries(s.votes || {}).map(([agent, vote]: [string, any]) => (
                            <span key={agent} className={`text-[10px] px-2 py-0.5 rounded-full ${
                                vote === 'GO' ? 'bg-cmo/10 text-cmo' :
                                vote === 'NO-GO' ? 'bg-devil/10 text-devil' : 'bg-legal/10 text-legal'
                            }`}>
                                {agent}: {vote}
                            </span>
                        ))}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto bg-secondary/30 rounded-lg p-3">
                        {s.moderator_summary || 'No summary available'}
                    </div>
                </div>
            ))}
        </div>
        </motion.div>)}
        </div>
    </motion.div>
)}

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl md:text-8xl font-serif font-bold tracking-tight mb-4 gold-gradient-text animate-title-glow">
              SHADOW BOARD
            </h1>
            <p className="text-muted-foreground text-sm md:text-base tracking-wide">
              AI-Powered Executive Decision Simulation
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl"
          >
            <section ref={howItWorksRef} id="how-it-works" className="rounded-3xl border border-border/60 bg-slate-950/90 p-6 mb-6 shadow-[0_30px_120px_-55px_rgba(248,205,77,0.15)]">
              <div className="text-center mb-8">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-2">How it works</p>
                <h2 className="font-serif text-3xl font-semibold text-foreground">From question to clear boardroom insight</h2>
                <p className="max-w-2xl mx-auto text-sm text-muted-foreground mt-3">Enter your strategic question, let the AI board debate it, then review the recommendation and stored insights.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { title: 'Submit a decision challenge', description: 'Type your strategic question, add optional context, and choose a board focus.' },
                  { title: 'AI experts debate', description: 'CFO, CMO, Legal and Devil’s Advocate discuss tradeoffs, risks and opportunity.' },
                  { title: 'Capture a recommendation', description: 'Get a concise summary, preserve the session, and return to it anytime.' },
                ].map((item) => (
                  <div key={item.title} className="rounded-3xl border border-border bg-background/60 p-5 text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-slate-950/95">
                    <h3 className="mb-3 text-lg font-semibold text-foreground">{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex gap-2 mb-4 justify-center">
              <button
                onClick={() => setMode('single')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all ${
                  mode === 'single'
                    ? 'gold-gradient text-primary-foreground font-bold'
                    : 'glass-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare size={14} />
                Single Debate
              </button>
              <button
                onClick={() => setMode('compare')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all ${
                  mode === 'compare'
                    ? 'gold-gradient text-primary-foreground font-bold'
                    : 'glass-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <GitCompare size={14} />
                Scenario Comparison
              </button>
            </div>

            <div className="glass-card-strong rounded-xl p-6 md:p-8">
              {mode === 'single' ? (
                /* ═══ SINGLE DEBATE MODE ═══ */
                <>
              <div className="relative">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={voiceQuestion.isListening ? 'Listening... speak your strategic question' : 'What strategic decision should the board analyze?'}
                  className={`w-full bg-secondary/40 border rounded-lg p-4 pr-12 text-sm md:text-base text-foreground focus:outline-none transition-colors resize-none h-32 placeholder:text-muted-foreground/50 ${
                    voiceQuestion.isListening ? 'border-primary/60 bg-primary/5' : 'border-border focus:border-primary/40'
                  }`}
                />
                {voiceQuestion.supported && (
                  <button
                    type="button"
                    onClick={voiceQuestion.toggle}
                    className={`absolute right-3 top-3 p-1.5 rounded-full transition-all ${
                      voiceQuestion.isListening
                        ? 'text-primary bg-primary/10 animate-pulse'
                        : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary/50'
                    }`}
                    title={voiceQuestion.isListening ? 'Stop listening' : 'Speak your question'}
                  >
                    {voiceQuestion.isListening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                )}
                {voiceQuestion.isListening && (
                  <div className="absolute bottom-2 left-4 flex items-center gap-2 text-xs text-primary">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    Listening...
                  </div>
                )}
              </div>

              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Company context (optional): e.g. We are Spotify. Revenue: $15B. Cash: $4.2B. 500M monthly active users."
                className="w-full bg-secondary/40 border border-border rounded-lg p-4 text-sm md:text-base text-foreground focus:outline-none focus:border-primary/40 transition-colors resize-none h-20 placeholder:text-muted-foreground/50 mt-3"
              />
              <div className="flex items-center gap-2 mt-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files?.[0]) setUploadedFile(e.target.files[0]);
                }}
                accept=".pdf,.txt,.docx"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all text-xs"
              >
                <FileText size={14} />
                {uploadedFile ? uploadedFile.name : 'Attach document (optional)'}
              </button>
              {uploadedFile && (
                <button
                  onClick={() => setUploadedFile(null)}
                  className="text-xs text-destructive hover:text-destructive/80"
                >
                  ✕ Remove
                </button>
              )}
            </div>
            <div className="mt-4 mb-2">
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2 block">
                Board Expertise
              </label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'tech', label: '💻 Tech' },
                  { id: 'healthcare', label: '🏥 Healthcare' },
                  { id: 'finance', label: '🏦 Finance' },
                  { id: 'retail', label: '🛒 Retail' },
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBoardType(b.id)}
                    className={`px-4 py-2 rounded-lg border text-xs transition-all ${
                      boardType === b.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
              {/* Example chips */}
              <div className="flex flex-wrap gap-2 mt-4 mb-6">
                {EXAMPLE_QUESTIONS.map((eq) => (
                  <button
                    key={eq}
                    onClick={() => setQuestion(eq)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
                  >
                    {eq}
                  </button>
                ))}
              </div>

              <button
                onClick={startDebate}
                disabled={!question.trim() || isStarting}
                className="w-full py-4 rounded-lg gold-gradient text-primary-foreground font-bold uppercase tracking-wider text-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed group flex items-center justify-center gap-2 gold-glow"
              >
                {isStarting ? 'Convening the Board...' : 'Convene the Board'}
                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
                </>
              ) : (
                /* ═══ SCENARIO COMPARISON MODE ═══ */
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <GitCompare size={18} className="text-primary" />
                    <h2 className="font-serif text-lg font-bold gold-gradient-text">Scenario Comparison</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Enter two strategic options. The board will debate both simultaneously and deliver a comparative analysis.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-cfo mb-1 block">Option A</label>
                      <textarea
                        value={optionA}
                        onChange={(e) => setOptionA(e.target.value)}
                        placeholder="First strategic option, e.g. Should we expand to Europe?"
                        className="w-full bg-cfo/5 border border-cfo/20 rounded-lg p-4 text-sm text-foreground focus:outline-none focus:border-cfo/40 transition-colors resize-none h-20 placeholder:text-muted-foreground/50"
                      />
                    </div>

                    <div className="flex items-center justify-center">
                      <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider px-3 py-1 rounded-full bg-secondary/40 border border-border">vs</span>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-cmo mb-1 block">Option B</label>
                      <textarea
                        value={optionB}
                        onChange={(e) => setOptionB(e.target.value)}
                        placeholder="Second strategic option, e.g. Should we expand to Asia?"
                        className="w-full bg-cmo/5 border border-cmo/20 rounded-lg p-4 text-sm text-foreground focus:outline-none focus:border-cmo/40 transition-colors resize-none h-20 placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>

                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Shared company context (optional): e.g. We are Spotify. Revenue: $15B."
                    className="w-full bg-secondary/40 border border-border rounded-lg p-4 text-sm text-foreground focus:outline-none focus:border-primary/40 transition-colors resize-none h-16 placeholder:text-muted-foreground/50 mt-3"
                  />

                  <div className="mt-4 mb-2">
                    <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2 block">
                      Board Expertise
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { id: 'tech', label: '💻 Tech' },
                        { id: 'healthcare', label: '🏥 Healthcare' },
                        { id: 'finance', label: '🏦 Finance' },
                        { id: 'retail', label: '🛒 Retail' },
                      ].map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setBoardType(b.id)}
                          className={`px-4 py-2 rounded-lg border text-xs transition-all ${
                            boardType === b.id
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comparison example chips */}
                  <div className="flex flex-wrap gap-2 mt-4 mb-6">
                    {COMPARISON_EXAMPLES.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => { setOptionA(ex.a); setOptionB(ex.b); }}
                        className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
                      >
                        {ex.a.slice(0, 30)}... vs {ex.b.slice(0, 30)}...
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={startComparison}
                    disabled={!optionA.trim() || !optionB.trim() || isStarting}
                    className="w-full py-4 rounded-lg gold-gradient text-primary-foreground font-bold uppercase tracking-wider text-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed group flex items-center justify-center gap-2 gold-glow"
                  >
                    {isStarting ? 'Running Parallel Debates...' : 'Compare Scenarios'}
                    <GitCompare size={16} className="group-hover:scale-110 transition-transform" />
                  </button>
                </>
              )}
            </div>
          </motion.div>

          <ReviewsSection
            sectionRef={reviewsRef as React.RefObject<HTMLElement>}
          />
        </div>

        <AppFooter />
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
      </div>
    );
  }

  // ═══ COMPARISON ARENA ═══
  if (comparisonId) {
    // Determine scenario-level phase for progress indicators
    const getScenarioPhaseIndex = (phase: string, scenario: string) => {
      const s = scenario.toLowerCase();
      if (phase.includes(`scenario_${s}_research`)) return 0;
      if (phase.includes(`scenario_${s}_debate1`)) return 1;
      if (phase.includes(`scenario_${s}_debate2`)) return 3;
      if (phase.includes(`scenario_${s}_debate3`)) return 4;
      if (phase.includes(`scenario_${s}_synthesis`)) return 5;
      return -1;
    };

    const SCENARIO_PHASES = ['Research', 'Round 1', 'Your Input', 'Round 2', 'Round 3', 'Synthesis'];

    const currentScenarioPhaseA = scenarioAComplete ? 6 : getScenarioPhaseIndex(phaseA, 'A');
    const currentScenarioPhaseB = scenarioBComplete ? 6 : getScenarioPhaseIndex(phaseB, 'B');

    const phaseIdxA = comparisonPaused ? 2 : currentScenarioPhaseA;
    const phaseIdxB = comparisonPaused ? 2 : currentScenarioPhaseB;

    const activeMessages = activeScenarioTab === 'A' ? messagesA : activeScenarioTab === 'B' ? messagesB : [];
    const activeVotes = activeScenarioTab === 'A' ? votesA : activeScenarioTab === 'B' ? votesB : {};
    const activeLabel = activeScenarioTab === 'A' ? optionA : activeScenarioTab === 'B' ? optionB : '';
    const activePhase = activeScenarioTab === 'A' ? phaseIdxA : activeScenarioTab === 'B' ? phaseIdxB : -1;

    // Group messages by phase for section headers
    const groupedMessages: { phase: string; label: string; messages: AgentMessage[] }[] = [];
    let currentGroup: typeof groupedMessages[0] | null = null;
    const phaseLabels: Record<string, string> = {
      research: 'Research Phase',
      debate: 'Debate',
      final: 'Final Positions',
      synthesis: 'Moderator Synthesis',
    };
    for (const msg of activeMessages) {
      const roundSuffix = msg.round ? ` - Round ${msg.round}` : '';
      const key = `${msg.phase}${msg.round || ''}`;
      const label = (phaseLabels[msg.phase] || msg.phase) + roundSuffix;
      if (!currentGroup || currentGroup.phase !== key) {
        currentGroup = { phase: key, label, messages: [] };
        groupedMessages.push(currentGroup);
      }
      currentGroup.messages.push(msg);
    }

    return (
      <div className="min-h-svh flex flex-col bg-grid-pattern">
        {/* ═══ Top Header Bar ═══ */}
        <div className="sticky top-0 z-20 w-full glass-card-strong border-b border-border">
          <div className="max-w-5xl mx-auto px-4 py-3">
            {/* Title & top-level progress */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <GitCompare size={18} className="text-primary" />
                <span className="font-serif font-bold gold-gradient-text text-lg">Scenario Comparison</span>
              </div>
              <div className="flex items-center gap-3">
                {[
                  { label: 'Option A', done: scenarioAComplete, active: phaseA !== '' && !scenarioAComplete },
                  { label: 'Option B', done: scenarioBComplete, active: phaseB !== '' && !scenarioBComplete },
                  { label: 'Analysis', done: !!comparisonResult, active: comparisonPhase === 'comparative_analysis' },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      step.done ? 'bg-primary text-primary-foreground' :
                      step.active ? 'border-2 border-primary text-primary pulse-gold' :
                      'border border-border text-muted-foreground/40'
                    }`}>
                      {step.done ? <CheckCircle2 size={12} /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-mono uppercase tracking-wider hidden md:inline ${
                      step.active ? 'text-primary font-semibold' : step.done ? 'text-primary/70' : 'text-muted-foreground/40'
                    }`}>{step.label}</span>
                    {i < 2 && <div className={`w-6 h-[2px] ${step.done ? 'bg-primary' : 'bg-border'} mx-1`} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Scenario Tabs */}
            <div className="flex gap-1">
              <button
                onClick={() => setActiveScenarioTab('A')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  activeScenarioTab === 'A'
                    ? 'bg-cfo/15 text-cfo border border-cfo/30 font-bold'
                    : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-secondary/30'
                }`}
              >
                <span className="truncate max-w-[120px] md:max-w-[200px]">
                  Option A: {optionA.slice(0, 40)}{optionA.length > 40 ? '...' : ''}
                </span>
                {messagesA.length > 0 && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${scenarioAComplete ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {scenarioAComplete ? '✓' : messagesA.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveScenarioTab('B')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  activeScenarioTab === 'B'
                    ? 'bg-cmo/15 text-cmo border border-cmo/30 font-bold'
                    : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-secondary/30'
                }`}
              >
                <span className="truncate max-w-[120px] md:max-w-[200px]">
                  Option B: {optionB.slice(0, 40)}{optionB.length > 40 ? '...' : ''}
                </span>
                {messagesB.length > 0 && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${scenarioBComplete ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {scenarioBComplete ? '✓' : messagesB.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveScenarioTab('analysis')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  activeScenarioTab === 'analysis'
                    ? 'bg-primary/15 text-primary border border-primary/30 font-bold'
                    : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-secondary/30'
                }`}
              >
                <GitCompare size={12} />
                <span className="truncate">Analysis</span>
                {comparisonResult && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">✓</span>
                )}
              </button>
            </div>
          </div>

          {/* Dual scenario phase progress (both A and B shown simultaneously) */}
          {activeScenarioTab !== 'analysis' && (phaseIdxA >= 0 || phaseIdxB >= 0) && (
            <div className="border-t border-border/50 px-4 py-2.5">
              <div className="max-w-5xl mx-auto space-y-2">
                {[
                  { label: 'Option A', phaseIdx: phaseIdxA, complete: scenarioAComplete, isA: true },
                  { label: 'Option B', phaseIdx: phaseIdxB, complete: scenarioBComplete, isA: false },
                ].map((scenario) => (
                  <div key={scenario.label} className="flex items-center gap-2">
                    <span className={`text-[8px] font-mono uppercase tracking-wider w-16 font-semibold ${scenario.isA ? 'text-cfo' : 'text-cmo'}`}>{scenario.label}</span>
                    <div className="flex-1 flex items-center gap-0">
                      {SCENARIO_PHASES.map((phase, i) => {
                        const isCompleted = scenario.complete || i < scenario.phaseIdx;
                        const isCurrent = !scenario.complete && i === scenario.phaseIdx;
                        return (
                          <React.Fragment key={phase}>
                            <div className="flex flex-col items-center z-10">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold transition-all ${
                                isCompleted ? (scenario.isA ? 'bg-cfo/80 text-primary-foreground' : 'bg-cmo/80 text-primary-foreground') :
                                isCurrent ? (scenario.isA ? 'border-2 border-cfo text-cfo pulse-gold' : 'border-2 border-cmo text-cmo pulse-gold') :
                                'border border-border text-muted-foreground/40'
                              }`}>
                                {isCompleted ? <CheckCircle2 size={9} /> : i + 1}
                              </div>
                              <span className={`mt-0.5 text-[7px] md:text-[8px] uppercase tracking-[0.1em] font-mono whitespace-nowrap ${
                                isCurrent ? (scenario.isA ? 'text-cfo font-semibold' : 'text-cmo font-semibold') :
                                isCompleted ? (scenario.isA ? 'text-cfo/60' : 'text-cmo/60') :
                                'text-muted-foreground/30'
                              }`}>{phase}</span>
                            </div>
                            {i < SCENARIO_PHASES.length - 1 && (
                              <div className="flex-1 h-[2px] bg-border mx-0.5 relative overflow-hidden">
                                <motion.div
                                  className={`absolute inset-y-0 left-0 ${scenario.isA ? 'bg-cfo' : 'bg-cmo'}`}
                                  initial={{ width: '0%' }}
                                  animate={{ width: isCompleted || i < scenario.phaseIdx ? '100%' : '0%' }}
                                  transition={{ duration: 0.4 }}
                                />
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ Main Content ═══ */}
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-4">
          {/* Scenario A or B messages */}
          {activeScenarioTab !== 'analysis' && (
            <>
              {/* Scenario label + question */}
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full font-bold ${
                  activeScenarioTab === 'A' ? 'bg-cfo/10 text-cfo' : 'bg-cmo/10 text-cmo'
                }`}>Option {activeScenarioTab}</span>
                <span className="text-sm text-muted-foreground">{activeLabel}</span>
              </div>

              {/* Votes summary bar */}
              {Object.keys(activeVotes).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg glass-card"
                >
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-2 self-center">Board Votes:</span>
                  {Object.entries(activeVotes).map(([agent, vote]) => (
                    <span key={agent} className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${
                      vote === 'GO' ? 'bg-cmo/15 text-cmo border border-cmo/20' :
                      vote === 'NO-GO' ? 'bg-devil/15 text-devil border border-devil/20' :
                      'bg-legal/15 text-legal border border-legal/20'
                    }`}>{agent}: {vote}</span>
                  ))}
                </motion.div>
              )}

              {/* Grouped messages with phase section headers */}
              {groupedMessages.map((group, gi) => (
                <div key={group.phase}>
                  {/* Phase section divider */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                    className="flex items-center gap-3 my-5"
                  >
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary font-semibold px-3 py-1 rounded-full border border-primary/20 bg-primary/5">
                      {group.label}
                    </span>
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-primary/40 to-transparent" />
                  </motion.div>

                  {/* Messages in this phase */}
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {group.messages.map((msg, mi) => (
                        <MessageCard
                          key={`${activeScenarioTab}-${gi}-${mi}`}
                          message={msg}
                          index={mi}
                          sessionId={comparisonId}
                          isComparison={true}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ))}

              {/* HITL Panel — single input for both options after Round 1 */}
              {comparisonPaused && (
                <>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 my-5"
                  >
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary font-semibold px-3 py-1 rounded-full border border-primary/20 bg-primary/5">
                      Your Input — Both Options
                    </span>
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-primary/40 to-transparent" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg p-4 mb-4 text-center"
                    style={{
                      background: 'hsla(40, 52%, 20%, 0.3)',
                      border: '1px solid hsla(40, 52%, 58%, 0.2)',
                    }}
                  >
                    <p className="text-xs text-primary/80 font-mono uppercase tracking-wider">
                      Both options have completed Round 1. Your input will be shared with all board members across both scenarios.
                    </p>
                  </motion.div>
                  <HumanInputPanel
                    onSubmit={(text, targetAgent) => submitComparisonHumanInput(text, targetAgent)}
                    onSkip={() => submitComparisonHumanInput('', 'all')}
                  />
                </>
              )}

              {/* "Waiting for agents" placeholder */}
              {activeMessages.length === 0 && !comparisonPaused && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground/50 text-sm font-mono">
                    Waiting for agents to start...
                  </p>
                </div>
              )}
            </>
          )}

          {/* Comparative Analysis Tab */}
          {activeScenarioTab === 'analysis' && (
            <>
              {comparisonResult ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="rounded-lg overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, hsla(30, 50%, 25%, 0.6), hsla(30, 50%, 15%, 0.8))',
                    border: '1px solid hsla(40, 52%, 58%, 0.3)',
                  }}
                >
                  <div className="p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl ring-2 ring-primary bg-primary/10">
                        <GitCompare size={24} />
                      </div>
                      <div>
                        <h3 className="text-primary font-serif text-xl font-semibold">Comparative Analysis</h3>
                        <p className="text-primary/60 text-xs font-mono uppercase tracking-wider">Side-by-Side Verdict</p>
                      </div>
                    </div>
                    <div className="text-foreground/90 text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                      <ReactMarkdownBlock text={comparisonResult} />
                    </div>
                    <button
                      onClick={() => window.open(`${API_BASE}/api/${comparisonId}/download_comparison_pdf`, '_blank')}
                      className="mt-6 px-5 py-2.5 rounded-md bg-primary/20 text-primary text-xs font-semibold uppercase tracking-wider hover:bg-primary/30 transition-colors flex items-center gap-2"
                    >
                      📄 Download Comparison Brief (Full PDF)
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-16">
                  <GitCompare size={40} className="mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">
                    The comparative analysis will appear here once both scenarios are debated.
                  </p>
                  {!scenarioAComplete && (
                    <button onClick={() => setActiveScenarioTab('A')} className="mt-3 text-xs text-primary hover:underline">
                      View Option A debate in progress
                    </button>
                  )}
                  {scenarioAComplete && !scenarioBComplete && (
                    <button onClick={() => setActiveScenarioTab('B')} className="mt-3 text-xs text-primary hover:underline">
                      View Option B debate in progress
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Thinking indicator */}
          <AnimatePresence>
            {isThinking && !isComplete && !comparisonPaused && (
              <TypingIndicator
                agentName={thinkingAgent}
                phase={comparisonPhase === 'comparative_analysis' ? 'synthesis' :
                       comparisonPhase.includes('research') ? 'research' : 'debate'}
              />
            )}
          </AnimatePresence>

          {/* Completion */}
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="rounded-xl overflow-hidden gold-glow"
              style={{
                background: 'linear-gradient(135deg, hsla(40, 52%, 30%, 0.3), hsla(40, 52%, 20%, 0.5))',
                border: '1px solid hsla(40, 52%, 58%, 0.3)',
              }}
            >
              <div className="p-8 md:p-10 text-center">
                <CheckCircle2 className="mx-auto mb-4 text-primary" size={48} />
                <h2 className="text-3xl md:text-4xl font-serif font-bold mb-2 gold-gradient-text">
                  Scenario Comparison Complete
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Both scenarios have been fully debated with your input and compared
                </p>
                <div className="flex items-center justify-center gap-6 text-xs font-mono text-muted-foreground uppercase tracking-wider flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <GitCompare size={14} className="text-primary" />
                    2 scenarios
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users size={14} className="text-primary" />
                    {new Set([...messagesA, ...messagesB].map(m => m.agent)).size} agents
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-primary" />
                    {messagesA.length + messagesB.length} messages
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText size={14} className="text-primary" />
                    1 comparative analysis
                  </span>
                  {slackSent && (
                    <span className="flex items-center gap-1.5 text-primary">
                      <CheckCircle2 size={14} />
                      Slack notified
                    </span>
                  )}
                </div>
                <div className="flex gap-3 justify-center mt-6">
                  <button
                    onClick={() => window.open(`${API_BASE}/api/${comparisonId}/download_comparison_pdf`, '_blank')}
                    className="px-6 py-3 rounded-lg gold-gradient text-primary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90 transition-all flex items-center gap-2"
                  >
                    📄 Download Full PDF
                  </button>
                  <button
                    onClick={resetAll}
                    className="px-6 py-3 rounded-lg border border-primary/30 text-primary font-semibold uppercase tracking-wider text-sm hover:bg-primary/10 transition-all"
                  >
                    Start New Session
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={scrollRef} className="h-20" />
        </main>

        <AppFooter />
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
      </div>
    );
  }

  // Debate Arena
  return (
    <div className="min-h-svh flex flex-col bg-grid-pattern">
      <PhaseIndicator currentPhase={currentPhase} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12 space-y-4">
        <AnimatePresence mode="popLayout">
          {messages.map((msg, i) => (
            <MessageCard key={i} message={msg} index={i} sessionId={sessionId} />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {isThinking && !isPaused && !isComplete && (
            <TypingIndicator
              agentName={thinkingAgent}
              phase={currentPhase === 0 ? 'research' : 'debate'}
            />
          )}
        </AnimatePresence>

        {isPaused && (
          <HumanInputPanel
            onSubmit={(text,targetAgent) => submitHumanInput(text,targetAgent)}
            onSkip={() => submitHumanInput('', 'all')}
          />
        )}

        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="rounded-xl overflow-hidden gold-glow"
            style={{
              background: 'linear-gradient(135deg, hsla(40, 52%, 30%, 0.3), hsla(40, 52%, 20%, 0.5))',
              border: '1px solid hsla(40, 52%, 58%, 0.3)',
            }}
          >
            <div className="p-8 md:p-10 text-center">
              <CheckCircle2 className="mx-auto mb-4 text-primary" size={48} />
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-2 gold-gradient-text">
                Shadow Board Session Complete
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                The board has reached its conclusions
              </p>
              <div className="flex items-center justify-center gap-6 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Users size={14} className="text-primary" />
                  {agentCount} agents
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-primary" />
                  {roundCount} rounds
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText size={14} className="text-primary" />
                  1 synthesis
                </span>
              </div>
              <button
                onClick={resetAll}
              className="mt-6 px-6 py-3 rounded-lg border border-primary/30 text-primary font-semibold uppercase tracking-wider text-sm hover:bg-primary/10 transition-all">
            Start New Session
            </button>
            </div>
          </motion.div>
        )}

        <div ref={scrollRef} className="h-20" />
      </main>

      <AppFooter />
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
    </div>
  );
};

// Lazy-loaded to avoid top-level import issues with markdown in this file
const ReactMarkdownBlock = ({ text }: { text: string }) => {
  const [mod, setMod] = React.useState<{ MD: any; gfm: any } | null>(null);
  React.useEffect(() => {
    Promise.all([import('react-markdown'), import('remark-gfm')]).then(([md, gfm]) => {
      setMod({ MD: md.default, gfm: gfm.default });
    });
  }, []);
  if (!mod) return <p className="text-muted-foreground text-sm">Loading...</p>;
  return <mod.MD remarkPlugins={[mod.gfm]}>{text}</mod.MD>;
};

const AppFooter = () => (
  <footer className="py-6 text-center border-t border-border/30">
    <p className="text-xs text-muted-foreground/60 font-mono">
      Shadow Board by Agent Quorum · Powered by AIRIA
    </p>
    <p className="text-[10px] text-muted-foreground/30 mt-1">
      Built for the AIRIA AI Agent Challenge 2026
    </p>
  </footer>
);

const ErrorBanner = ({ error, onDismiss }: { error: string | null; onDismiss: () => void }) => {
  if (!error) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-8 right-8 glass-card-strong text-foreground px-6 py-4 rounded-lg flex items-center gap-3 shadow-2xl z-50 text-xs cursor-pointer border border-destructive/30"
      onClick={onDismiss}
    >
      <AlertCircle size={16} className="text-destructive" /> {error}
    </motion.div>
  );
};

export default Index;

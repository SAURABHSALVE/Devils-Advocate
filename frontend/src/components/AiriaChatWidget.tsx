import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE = 'http://localhost:8000';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  'What is Shadow Board?',
  'How does the AI debate work?',
  'What agents are on the board?',
  'How do I start a session?',
];

const AiriaChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Welcome to **Shadow Board**! \n\nI'm your AI assistant. I can help you understand how the executive decision simulation works. Try asking me anything!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setHasNewMessage(false);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px';
    }
  }, [input]);

  const sendMessage = async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: msgText, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msgText,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const reply = data.reply || 'Sorry, I could not generate a response.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }]);

      if (!isOpen) setHasNewMessage(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Unable to reach the server. Make sure the backend is running on port **8000**.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          "Welcome to **Shadow Board**! \n\nI'm your AI assistant. I can help you understand how the executive decision simulation works. Try asking me anything!",
        timestamp: new Date(),
      },
    ]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const showSuggestions = messages.length <= 1 && !isLoading;

  return (
    <>
      {/* Floating toggle button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-[9999] group"
            aria-label="Open chat"
          >
            <div className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, hsl(40, 52%, 58%), hsl(35, 60%, 45%))',
                boxShadow: '0 8px 32px -4px hsla(40, 52%, 58%, 0.4), 0 0 0 1px hsla(40, 52%, 58%, 0.2)',
              }}
            >
              <MessageCircle size={22} className="text-white" />
              {hasNewMessage && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-white" />
                </span>
              )}
            </div>
            <div
              className="absolute bottom-full right-0 mb-3 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{
                background: 'hsla(222, 47%, 14%, 0.95)',
                border: '1px solid hsla(40, 52%, 58%, 0.2)',
                color: 'hsl(40, 52%, 68%)',
                backdropFilter: 'blur(8px)',
              }}
            >
              Chat with AIRIA
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.92 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 right-6 z-[9999] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{
              width: 'min(420px, calc(100vw - 48px))',
              height: 'min(600px, calc(100vh - 100px))',
              background: 'hsl(222, 47%, 11%)',
              border: '1px solid hsla(40, 52%, 58%, 0.18)',
              boxShadow:
                '0 25px 60px -12px rgba(0, 0, 0, 0.7), 0 0 60px -15px hsla(40, 52%, 58%, 0.15)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, hsla(222, 47%, 16%, 1), hsla(222, 47%, 13%, 1))',
                borderBottom: '1px solid hsla(40, 52%, 58%, 0.12)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, hsl(40, 52%, 58%), hsl(35, 60%, 45%))' }}
                  >
                    <Sparkles size={18} className="text-white" />
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 shadow-sm"
                    style={{ borderColor: 'hsl(222, 47%, 16%)' }}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-tight tracking-wide" style={{ color: 'hsl(210, 40%, 98%)' }}>
                    AIRIA Assistant
                  </h3>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] mt-0.5" style={{ color: 'hsl(160, 84%, 45%)' }}>
                    Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: 'hsl(215, 20%, 55%)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(210, 40%, 90%)'; e.currentTarget.style.background = 'hsla(210, 40%, 98%, 0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(215, 20%, 55%)'; e.currentTarget.style.background = 'transparent'; }}
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: 'hsl(215, 20%, 55%)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(210, 40%, 90%)'; e.currentTarget.style.background = 'hsla(210, 40%, 98%, 0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(215, 20%, 55%)'; e.currentTarget.style.background = 'transparent'; }}
                  aria-label="Close chat"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-5"
              style={{
                background: 'linear-gradient(180deg, hsl(222, 47%, 12%) 0%, hsl(222, 47%, 10%) 100%)',
              }}
            >
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5 shadow-sm"
                    style={{
                      background:
                        msg.role === 'assistant'
                          ? 'linear-gradient(135deg, hsla(40, 52%, 58%, 0.15), hsla(40, 52%, 58%, 0.08))'
                          : 'linear-gradient(135deg, hsla(222, 50%, 25%, 0.9), hsla(222, 50%, 20%, 0.9))',
                      border:
                        msg.role === 'assistant'
                          ? '1px solid hsla(40, 52%, 58%, 0.15)'
                          : '1px solid hsla(210, 40%, 98%, 0.08)',
                    }}
                  >
                    {msg.role === 'assistant' ? (
                      <Bot size={14} style={{ color: 'hsl(40, 52%, 62%)' }} />
                    ) : (
                      <User size={14} style={{ color: 'hsl(215, 20%, 65%)' }} />
                    )}
                  </div>

                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
                    <div
                      className={`px-4 py-3 text-[13px] leading-relaxed ${
                        msg.role === 'assistant' ? 'rounded-2xl rounded-tl-sm' : 'rounded-2xl rounded-tr-sm'
                      }`}
                      style={{
                        background:
                          msg.role === 'assistant'
                            ? 'hsla(222, 47%, 16%, 0.75)'
                            : 'linear-gradient(135deg, hsla(40, 52%, 58%, 0.14), hsla(40, 52%, 58%, 0.08))',
                        border:
                          msg.role === 'assistant'
                            ? '1px solid hsla(210, 40%, 98%, 0.07)'
                            : '1px solid hsla(40, 52%, 58%, 0.18)',
                        color: 'hsl(210, 40%, 95%)',
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="airia-markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <span>{msg.content}</span>
                      )}
                    </div>
                    <span className="text-[10px] mt-1.5 px-1 font-mono" style={{ color: 'hsla(215, 20%, 55%, 0.5)' }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5"
                    style={{
                      background: 'linear-gradient(135deg, hsla(40, 52%, 58%, 0.15), hsla(40, 52%, 58%, 0.08))',
                      border: '1px solid hsla(40, 52%, 58%, 0.15)',
                    }}
                  >
                    <Bot size={14} style={{ color: 'hsl(40, 52%, 62%)' }} />
                  </div>
                  <div
                    className="px-5 py-3.5 rounded-2xl rounded-tl-sm"
                    style={{
                      background: 'hsla(222, 47%, 16%, 0.75)',
                      border: '1px solid hsla(210, 40%, 98%, 0.07)',
                    }}
                  >
                    <div className="flex gap-1.5 items-center h-4">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{
                            background: 'hsl(40, 52%, 58%)',
                            animationDelay: `${i * 0.2}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggestion chips */}
            {showSuggestions && (
              <div
                className="px-4 pb-2 pt-2.5 flex flex-wrap gap-2 flex-shrink-0"
                style={{
                  background: 'hsl(222, 47%, 10%)',
                  borderTop: '1px solid hsla(40, 52%, 58%, 0.06)',
                }}
              >
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-[11px] px-3.5 py-2 rounded-xl transition-all hover:scale-[1.03] active:scale-95 font-medium"
                    style={{
                      background: 'hsla(40, 52%, 58%, 0.07)',
                      border: '1px solid hsla(40, 52%, 58%, 0.15)',
                      color: 'hsl(40, 52%, 70%)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'hsla(40, 52%, 58%, 0.14)';
                      e.currentTarget.style.borderColor = 'hsla(40, 52%, 58%, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'hsla(40, 52%, 58%, 0.07)';
                      e.currentTarget.style.borderColor = 'hsla(40, 52%, 58%, 0.15)';
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input area */}
            <div
              className="px-4 pb-4 pt-3 flex-shrink-0"
              style={{
                background: 'hsl(222, 47%, 11%)',
                borderTop: '1px solid hsla(40, 52%, 58%, 0.08)',
              }}
            >
              <div
                className="flex items-end gap-2 rounded-xl px-4 py-2.5 transition-all focus-within:ring-1"
                style={{
                  background: 'hsla(222, 47%, 16%, 0.6)',
                  border: '1px solid hsla(210, 40%, 98%, 0.08)',
                  '--tw-ring-color': 'hsla(40, 52%, 58%, 0.3)',
                } as React.CSSProperties}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/40 outline-none disabled:opacity-50 resize-none leading-relaxed py-0.5"
                  style={{ maxHeight: '100px', color: 'hsl(210, 40%, 95%)' }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                  style={{
                    background:
                      input.trim() && !isLoading
                        ? 'linear-gradient(135deg, hsl(40, 52%, 58%), hsl(35, 60%, 50%))'
                        : 'transparent',
                    color:
                      input.trim() && !isLoading ? 'hsl(222, 47%, 11%)' : 'hsl(215, 20%, 45%)',
                    boxShadow:
                      input.trim() && !isLoading ? '0 4px 12px -2px hsla(40, 52%, 58%, 0.3)' : 'none',
                  }}
                  aria-label="Send message"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              <p
                className="text-center mt-2.5 text-[9px] font-mono uppercase tracking-[0.25em]"
                style={{ color: 'hsla(215, 20%, 55%, 0.35)' }}
              >
                Powered by AIRIA
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AiriaChatWidget;

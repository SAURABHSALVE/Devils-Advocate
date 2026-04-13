import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export interface AgentMessage {
  agent: string;
  phase: string;
  text: string;
  round?: number;
  scenario?: string;
}

const AGENTS: Record<string, { name: string; title: string; emoji: string; color: string; borderColor: string; bgColor: string; ringColor: string }> = {
  cfo: { name: 'CFO', title: 'Chief Financial Officer', emoji: '📊', color: 'text-cfo', borderColor: 'border-l-cfo', bgColor: 'bg-cfo/5', ringColor: 'ring-cfo' },
  cmo: { name: 'CMO', title: 'Chief Marketing Officer', emoji: '📈', color: 'text-cmo', borderColor: 'border-l-cmo', bgColor: 'bg-cmo/5', ringColor: 'ring-cmo' },
  legal: { name: 'Legal', title: 'General Counsel', emoji: '⚖️', color: 'text-legal', borderColor: 'border-l-legal', bgColor: 'bg-legal/5', ringColor: 'ring-legal' },
  'devils advocate': { name: "Devil's Advocate", title: 'Strategic Contrarian', emoji: '😈', color: 'text-devil', borderColor: 'border-l-devil', bgColor: 'bg-devil/5', ringColor: 'ring-devil' },
  devils_advocate: { name: "Devil's Advocate", title: 'Strategic Contrarian', emoji: '😈', color: 'text-devil', borderColor: 'border-l-devil', bgColor: 'bg-devil/5', ringColor: 'ring-devil' },
  moderator: { name: 'Moderator', title: 'Board Chair', emoji: '🏛️', color: 'text-mod', borderColor: 'border-l-mod', bgColor: 'bg-mod/10', ringColor: 'ring-mod' },
};

function getAgent(name: string) {
  const key = name.toLowerCase().replace(/[']/g, '');
  return AGENTS[key] || AGENTS.moderator;
}

function getStanceBadge(text: string): { label: string; className: string } | null {
  const lower = text.toLowerCase().slice(0, 200);
  if (lower.includes('strongly support') || lower.includes('recommend proceeding') || lower.includes('in favor'))
    return { label: 'FOR', className: 'bg-cmo/20 text-cmo' };
  if (lower.includes('advise against') || lower.includes('oppose') || lower.includes('strongly caution'))
    return { label: 'AGAINST', className: 'bg-devil/20 text-devil' };
  if (lower.includes('conditional') || lower.includes('with conditions') || lower.includes('provided that'))
    return { label: 'CONDITIONAL', className: 'bg-legal/20 text-legal' };
  return null;
}

interface MessageCardProps {
  message: AgentMessage;
  index: number;
  sessionId: string | null;
  isComparison?: boolean;
}

const MessageCard: React.FC<MessageCardProps> = ({ message, index, sessionId, isComparison }) => {
  const agent = getAgent(message.agent);
  const isModerator = message.agent.toLowerCase() === 'moderator';
  const isSynthesis = message.phase?.toLowerCase().includes('synthesis');
  const stance = getStanceBadge(message.text);

  // Determine the scenario label for comparison mode moderator cards
  const scenarioLabel = message.scenario === 'A' ? 'Option A' : message.scenario === 'B' ? 'Option B' : '';

  // Moderator synthesis gets special treatment
  if (isModerator && isSynthesis) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        className="rounded-lg overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, hsla(258, 40%, 25%, 0.6), hsla(258, 50%, 18%, 0.8))',
          border: '1px solid hsla(258, 90%, 66%, 0.3)',
        }}
      >
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl ring-2 ring-mod bg-mod/10">
              🏛️
            </div>
            <div>
              <h3 className="text-mod font-serif text-xl font-semibold">Board Moderator</h3>
              <p className="text-mod/60 text-xs font-mono uppercase tracking-wider">
                {isComparison && scenarioLabel ? `${scenarioLabel} — Strategy Brief` : 'Final Strategy Brief'}
              </p>
            </div>
          </div>
          <div className="text-foreground/90 text-sm md:text-base leading-relaxed prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
          {!isComparison && (
            <button
              onClick={() => {
                window.open(`${API_BASE}/api/${sessionId}/download_pdf`, '_blank')
              }}
              className="mt-6 px-5 py-2.5 rounded-md bg-mod/20 text-mod text-xs font-semibold uppercase tracking-wider hover:bg-mod/30 transition-colors flex items-center gap-2"
            >
              📄 Download Strategy Brief
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
      className={`glass-card rounded-lg border-l-[3px] ${agent.borderColor} p-5 md:p-6`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ring-2 ${agent.ringColor} ${agent.bgColor}`}>
          {agent.emoji}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`font-serif text-lg font-semibold ${agent.color}`}>
              {agent.name}
            </h3>
            <span className="text-muted-foreground/50 text-xs font-mono">
              {agent.title}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted/50">
              {message.phase}{message.round ? ` · R${message.round}` : ''}
            </span>
            {stance && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${stance.className}`}>
                {stance.label}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="text-sm md:text-[15px] leading-relaxed text-foreground/80 prose prose-invert prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
      </div>
    </motion.div>
  );
};

export default MessageCard;

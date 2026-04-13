import React from 'react';
import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  agentName?: string;
  phase?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ agentName, phase }) => {
  const statusText = agentName
    ? `🔍 ${agentName}`
    : 'Agents are deliberating...';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="glass-card rounded-lg px-5 py-4 flex items-center gap-3"
    >
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-primary typing-dot" />
        <span className="w-2 h-2 rounded-full bg-primary typing-dot" />
        <span className="w-2 h-2 rounded-full bg-primary typing-dot" />
      </div>
      <span className="text-sm text-muted-foreground">{statusText}</span>
    </motion.div>
  );
};

export default TypingIndicator;

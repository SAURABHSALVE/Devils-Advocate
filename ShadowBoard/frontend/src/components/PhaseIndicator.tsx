import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const PHASES = ['Research', 'Round 1', 'HITL', 'Round 2', 'Round 3', 'Synthesis'];

interface PhaseIndicatorProps {
  currentPhase: number;
}

const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({ currentPhase }) => {
  return (
    <div className="sticky top-0 z-20 w-full glass-card-strong border-b border-border py-4 px-4">
      <div className="max-w-4xl mx-auto flex items-center gap-0">
        {PHASES.map((phase, i) => {
          const isCompleted = i < currentPhase;
          const isCurrent = i === currentPhase;
          const isFuture = i > currentPhase;

          return (
            <React.Fragment key={phase}>
              {/* Step node */}
              <div className="flex flex-col items-center z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-500 ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                      ? 'border-2 border-primary text-primary pulse-gold'
                      : 'border border-border text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <Check size={14} strokeWidth={3} />
                  ) : (
                    <span className="text-[10px]">{i + 1}</span>
                  )}
                </div>
                <span
                  className={`mt-2 text-[9px] md:text-[10px] uppercase tracking-[0.15em] font-mono whitespace-nowrap transition-colors duration-300 ${
                    isCurrent
                      ? 'text-primary font-semibold'
                      : isCompleted
                      ? 'text-primary/70'
                      : 'text-muted-foreground/40'
                  }`}
                >
                  {phase}
                </span>
              </div>

              {/* Connector line */}
              {i < PHASES.length - 1 && (
                <div className="flex-1 h-[2px] bg-border mx-1 relative overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-primary"
                    initial={{ width: '0%' }}
                    animate={{ width: i < currentPhase ? '100%' : '0%' }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default PhaseIndicator;

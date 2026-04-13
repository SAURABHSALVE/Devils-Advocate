import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send, SkipForward, Mic, MicOff } from 'lucide-react';

interface HumanInputPanelProps {
  onSubmit: (text: string, targetAgent: string) => void;
  onSkip: () => void;
}

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const HumanInputPanel: React.FC<HumanInputPanelProps> = ({ onSubmit, onSkip }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [targetAgent, setTargetAgent] = useState('all');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleVoice = () => {
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    let finalTranscript = input;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript;
        } else {
          interim = transcript;
        }
      }
      setInput(finalTranscript + (interim ? ' ' + interim : ''));
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    setIsListening(true);
  };

  const handleSubmit = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    onSubmit(input, targetAgent);
    setInput('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-lg p-6 md:p-8 pulse-gold"
      style={{
        background: 'hsla(222, 47%, 16%, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '2px solid hsla(40, 52%, 58%, 0.4)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={18} className="text-primary" />
        <h2 className="font-serif text-xl font-semibold text-primary">
          The Board Awaits Your Input
        </h2>
      </div>

      <p className="text-muted-foreground text-sm mb-5">
        Ask the board a question or challenge a specific agent's reasoning. You can type or use the mic to speak.
      </p>

      <div className="flex gap-3 mb-4">
        <select
          value={targetAgent}
          onChange={(e) => setTargetAgent(e.target.value)}
          className="bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
        >
          <option value="all">Ask All Agents</option>
          <option value="CFO">Challenge CFO</option>
          <option value="CMO">Challenge CMO</option>
          <option value="Legal">Challenge Legal</option>
          <option value="Devils Advocate">Challenge Devil's Advocate</option>
        </select>
      </div>

      <div className="relative mb-5">
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={isListening ? 'Listening...' : (targetAgent === 'all'
            ? "Ask the board a question..."
            : `Challenge the ${targetAgent}'s position...`)}
          className={`w-full bg-secondary/50 border rounded-lg px-4 py-4 pr-12 text-sm text-foreground focus:outline-none transition-colors placeholder:text-muted-foreground/50 ${
            isListening ? 'border-primary/60 bg-primary/5' : 'border-border focus:border-primary/50'
          }`}
        />
        <button
          onClick={toggleVoice}
          className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
            isListening
              ? 'text-primary animate-pulse'
              : 'text-muted-foreground/40 hover:text-muted-foreground'
          }`}
          title={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
      </div>
      {isListening && (
        <div className="flex items-center gap-2 mb-4 text-xs text-primary">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          Listening... speak now
        </div>
      )}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          className="flex-1 gold-gradient text-primary-foreground py-3 rounded-lg font-semibold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Send size={14} />
          {targetAgent === 'all' ? 'Send to Board' : `Challenge ${targetAgent}`}
        </button>
        <button
          onClick={onSkip}
          className="px-6 border border-border rounded-lg text-muted-foreground font-semibold text-sm uppercase tracking-wider hover:bg-secondary/50 transition-colors flex items-center gap-2"
        >
          <SkipForward size={14} />
          Skip
        </button>
      </div>
    </motion.div>
  );
};

export default HumanInputPanel;
import { useState, useRef, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export const useSpeechRecognition = (onTranscript: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const supported = !!navigator.mediaDevices?.getUserMedia;

  const startListening = useCallback(async () => {
    if (!supported) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach((t) => t.stop());

        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 100) return; // too small, skip

        // Send to Whisper API
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');

        try {
          const res = await fetch(`${API_BASE}/api/speech-to-text`, {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (data.text && data.text.trim()) {
            onTranscript(data.text.trim());
          }
        } catch {
          console.error('Whisper transcription failed');
        }
      };

      mediaRecorder.start(250); // collect chunks every 250ms
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [onTranscript, supported]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return { isListening, toggle, supported };
};

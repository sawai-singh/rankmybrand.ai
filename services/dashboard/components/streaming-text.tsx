'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StreamingTextProps {
  text: string;
  className?: string;
  speed?: number; // milliseconds per character
  onComplete?: () => void;
  showCursor?: boolean;
  cursorChar?: string;
  startImmediately?: boolean;
}

export function StreamingText({
  text,
  className,
  speed = 30,
  onComplete,
  showCursor = true,
  cursorChar = '▊',
  startImmediately = true,
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (startImmediately) {
      startStreaming();
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text, startImmediately]);

  const startStreaming = () => {
    setDisplayedText('');
    setCurrentIndex(0);
    setIsStreaming(true);

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        if (prevIndex >= text.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          setIsStreaming(false);
          onComplete?.();
          return prevIndex;
        }
        
        setDisplayedText(text.slice(0, prevIndex + 1));
        return prevIndex + 1;
      });
    }, speed);
  };

  const stopStreaming = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setDisplayedText(text);
    setIsStreaming(false);
    setCurrentIndex(text.length);
    onComplete?.();
  };

  return (
    <div className={cn('relative', className)}>
      <span className="whitespace-pre-wrap">
        {displayedText}
        <AnimatePresence>
          {showCursor && isStreaming && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="text-primary"
            >
              {cursorChar}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      
      {isStreaming && (
        <button
          onClick={stopStreaming}
          className="absolute -bottom-6 left-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip animation
        </button>
      )}
    </div>
  );
}

// Variant for streaming word by word
export function StreamingWords({
  text,
  className,
  speed = 100, // milliseconds per word
  onComplete,
}: {
  text: string;
  className?: string;
  speed?: number;
  onComplete?: () => void;
}) {
  const words = text.split(' ');
  const [visibleWords, setVisibleWords] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleWords((prev) => {
        if (prev >= words.length) {
          clearInterval(interval);
          onComplete?.();
          return prev;
        }
        return prev + 1;
      });
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, words.length, onComplete]);

  return (
    <div className={cn('space-x-1', className)}>
      {words.slice(0, visibleWords).map((word, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="inline-block"
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
}

// Variant for code streaming with syntax highlighting
export function StreamingCode({
  code,
  language = 'typescript',
  className,
  speed = 10,
  onComplete,
}: {
  code: string;
  language?: string;
  className?: string;
  speed?: number;
  onComplete?: () => void;
}) {
  return (
    <pre className={cn('overflow-x-auto rounded-lg bg-muted p-4', className)}>
      <code className={`language-${language}`}>
        <StreamingText
          text={code}
          speed={speed}
          onComplete={onComplete}
          showCursor={true}
          cursorChar="│"
        />
      </code>
    </pre>
  );
}

// Hook for streaming from SSE or WebSocket
export function useStreamingText(url: string, options?: RequestInit) {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const startStream = async () => {
    setIsStreaming(true);
    setError(null);
    setText('');

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          'Accept': 'text/event-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          setIsStreaming(false);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        setText((prev) => prev + chunk);
      }
    } catch (err) {
      setError(err as Error);
      setIsStreaming(false);
    }
  };

  return {
    text,
    isStreaming,
    error,
    startStream,
  };
}
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Sparkles, Clock, Mail, CheckCircle, Activity,
  TrendingUp, Shield, Zap, ArrowRight, X,
  FileText, Users, Brain, AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Lazy load heavy components (removed confetti - not implemented yet)

// Constants
const REPORT_GENERATION_TIME = 60; // minutes
const PROGRESS_CHECK_INTERVAL = 5000; // 5 seconds
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Types
interface ProgressState {
  id: string;
  label: string;
  icon: typeof Clock;
  description: string;
  estimatedDuration: number;
}

interface SessionData {
  email?: string;
  brandId?: string;
  sessionId?: string;
  startedAt?: string;
}

interface GenerationStatus {
  status: 'queued' | 'processing' | 'analyzing' | 'benchmarking' | 'finalizing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  estimatedTimeRemaining?: number;
  error?: string;
}

// Progress states with enhanced metadata
const PROGRESS_STATES: ProgressState[] = [
  { 
    id: 'queued', 
    label: 'Queued', 
    icon: Clock, 
    description: 'Your report is in the queue',
    estimatedDuration: 15 
  },
  { 
    id: 'analyzing', 
    label: 'Analyzing Brand', 
    icon: Brain, 
    description: 'Scanning AI platforms for brand mentions',
    estimatedDuration: 20 
  },
  { 
    id: 'benchmarking', 
    label: 'Benchmarking Competitors', 
    icon: Users, 
    description: 'Comparing against industry leaders',
    estimatedDuration: 15 
  },
  { 
    id: 'finalizing', 
    label: 'Finalizing Report', 
    icon: FileText, 
    description: 'Generating insights and recommendations',
    estimatedDuration: 10 
  }
];

// Custom hooks
const useGenerationStatus = (sessionId: string | null) => {
  const [status, setStatus] = useState<GenerationStatus>({
    status: 'queued',
    progress: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!sessionId || !isPolling) return;

    const checkStatus = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/api/report/status/${sessionId}`, {
          headers: {
            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch status');
        
        const data: GenerationStatus = await response.json();
        setStatus(data);
        
        if (data.status === 'completed' || data.status === 'failed') {
          setIsPolling(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    // Initial check
    checkStatus();

    // Set up polling
    const interval = setInterval(checkStatus, PROGRESS_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [sessionId, isPolling]);

  return { status, error, isPolling };
};

const useSessionData = (): SessionData | null => {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  useEffect(() => {
    try {
      // Validate and parse session data
      const rawSession = sessionStorage.getItem('onboarding_session');
      const rawUser = localStorage.getItem('user');
      
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed && typeof parsed === 'object') {
          setSessionData({
            email: parsed.email && EMAIL_REGEX.test(parsed.email) ? parsed.email : undefined,
            brandId: parsed.brandId,
            sessionId: parsed.sessionId,
            startedAt: parsed.startedAt
          });
        }
      } else if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed && typeof parsed === 'object' && parsed.email && EMAIL_REGEX.test(parsed.email)) {
          setSessionData({ email: parsed.email });
        }
      }
    } catch (error) {
      console.error('Failed to parse session data:', error);
    }
  }, []);

  return sessionData;
};

// Components
const ProgressIndicator = ({ 
  currentStatus, 
  progress 
}: { 
  currentStatus: string; 
  progress: number; 
}) => {
  const shouldReduceMotion = useReducedMotion();
  const currentStateIndex = useMemo(
    () => PROGRESS_STATES.findIndex(state => state.id === currentStatus),
    [currentStatus]
  );
  
  const CurrentIcon = PROGRESS_STATES[Math.max(0, currentStateIndex)].icon;
  const currentState = PROGRESS_STATES[Math.max(0, currentStateIndex)];

  return (
    <div className="space-y-6">
      {/* Professional icon display */}
      <div className="flex justify-center">
        <motion.div
          key={currentStatus}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-neutral-900/10 dark:bg-neutral-0/10 rounded-full blur-xl" />
          <div className="relative w-24 h-24 bg-neutral-900 dark:bg-neutral-0 rounded-full flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
            <CurrentIcon
              className={`w-12 h-12 text-white dark:text-neutral-900 ${!shouldReduceMotion && 'animate-pulse'}`}
              aria-hidden="true"
            />
          </div>
        </motion.div>
      </div>

      {/* Professional progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-neutral-500">
          <span>{currentState.label}</span>
          <span className="font-mono tabular-nums">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-neutral-900 dark:bg-neutral-0 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>
        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">{currentState.description}</p>
      </div>

      {/* Professional status dots */}
      <div className="flex justify-center gap-2" role="presentation">
        {PROGRESS_STATES.map((state, idx) => (
          <div
            key={state.id}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              idx <= currentStateIndex
                ? 'w-8 bg-neutral-900 dark:bg-neutral-0'
                : 'w-1.5 bg-neutral-300 dark:bg-neutral-700'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
};

const EmailChangeModal = ({ 
  isOpen, 
  onClose, 
  currentEmail, 
  onSubmit 
}: {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  onSubmit: (email: string) => Promise<void>;
}) => {
  const [email, setEmail] = useState(currentEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Focus trap
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(email);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update email');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between mb-4">
              <h2 id="modal-title" className="text-xl font-bold text-neutral-900 dark:text-neutral-0">
                Change Email Address
              </h2>
              <button
                ref={firstFocusableRef}
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-0"
                aria-label="Close dialog"
                disabled={isSubmitting}
              >
                <X className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              </button>
            </header>
            
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                    New email address
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-0 placeholder-neutral-500"
                    placeholder="you@company.com"
                    variant={error ? 'error' : 'default'}
                    error={error || undefined}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? 'Updating...' : 'Update Email'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Main component
export default function GeneratingPage() {
  const router = useRouter();
  const sessionData = useSessionData();
  const { status, error: statusError } = useGenerationStatus(sessionData?.sessionId || null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Calculate estimated time remaining
  const estimatedTimeRemaining = useMemo(() => {
    if (status.estimatedTimeRemaining) {
      return status.estimatedTimeRemaining;
    }
    return Math.max(0, REPORT_GENERATION_TIME - (status.progress / 100 * REPORT_GENERATION_TIME));
  }, [status]);

  const handleEmailUpdate = useCallback(async (newEmail: string) => {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';
    
    const response = await fetch(`${apiUrl}/api/report/update-email`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken || ''
      },
      body: JSON.stringify({ 
        email: newEmail,
        sessionId: sessionData?.sessionId 
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update email');
    }
    
    // Update session storage
    if (sessionData) {
      const updatedSession = { ...sessionData, email: newEmail };
      sessionStorage.setItem('onboarding_session', JSON.stringify(updatedSession));
    }
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  }, [sessionData]);

  // Handle completion
  useEffect(() => {
    if (status.status === 'completed') {
      // Redirect to report or show success
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    }
  }, [status.status, router]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      {/* Professional neutral background */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-900" />
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-neutral-900/5 dark:bg-neutral-0/5 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-neutral-900/3 dark:bg-neutral-0/3 blur-3xl rounded-full" />
      </div>

      {/* Main content */}
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Professional progress breadcrumb */}
          <nav aria-label="Onboarding progress" className="mb-8">
            <ol className="flex items-center justify-center space-x-2">
              {['Brand', 'Description', 'Competitors', 'Generating'].map((step, idx) => (
                <li key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all ${
                    idx < 3
                      ? 'bg-success-50 text-success-800 border border-success-200'
                      : 'bg-neutral-900 dark:bg-neutral-0 text-white dark:text-neutral-900 border border-neutral-900 dark:border-neutral-0'
                  }`}>
                    {idx < 3 ? (
                      <CheckCircle className="w-4 h-4" aria-label={`${step} completed`} />
                    ) : (
                      <Sparkles className="w-4 h-4" aria-label={`${step} in progress`} />
                    )}
                  </div>
                  {idx < 3 && (
                    <div className="w-12 h-0.5 bg-success-600 ml-2" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </nav>

          {/* Main card */}
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass rounded-3xl p-8 md:p-12 shadow-2xl"
          >
            {/* Error state */}
            {(statusError || status.status === 'failed') && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium">Generation Error</p>
                    <p className="text-red-300/80 text-sm mt-1">
                      {status.error || statusError || 'Something went wrong. Please try again or contact support.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Progress indicator */}
            <ProgressIndicator 
              currentStatus={status.status} 
              progress={status.progress} 
            />

            {/* Professional content */}
            <div className="mt-8 text-center space-y-4">
              <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-0">
                We're Generating Your Report
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 text-lg">
                You'll receive a secure link by email in about{' '}
                <strong className="text-neutral-900 dark:text-neutral-0 font-mono tabular-nums">{Math.ceil(estimatedTimeRemaining)} minutes</strong>
              </p>

              {/* Can close page message */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-success-50 border border-success-200 rounded-full">
                <CheckCircle className="w-4 h-4 text-success-600" />
                <p className="text-sm text-success-800 font-medium">
                  You can close this page - we'll email you when ready
                </p>
              </div>

              {/* Live status message */}
              {status.message && (
                <div
                  className="flex items-center justify-center gap-2 text-sm text-neutral-600 dark:text-neutral-400"
                  role="status"
                  aria-live="polite"
                >
                  <Activity className={`w-4 h-4 ${!shouldReduceMotion && 'animate-spin'}`} />
                  <span>{status.message}</span>
                </div>
              )}
            </div>

            {/* Professional info cards */}
            <div className="grid gap-4 mt-8">
              {[
                {
                  icon: TrendingUp,
                  title: 'Comprehensive Analysis',
                  description: 'Benchmarking against top competitors and AI platforms'
                },
                {
                  icon: Shield,
                  title: 'Enterprise Security',
                  description: 'Bank-level encryption and GDPR compliant'
                },
                {
                  icon: Zap,
                  title: 'Real-time Processing',
                  description: 'Analyzing 5+ AI platforms simultaneously'
                }
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="mt-1 p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex-shrink-0">
                    <item.icon className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                  </div>
                  <div>
                    <p className="text-neutral-900 dark:text-neutral-0 font-medium">{item.title}</p>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Professional email section */}
            <div className="mt-8 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  <div>
                    <p className="text-xs text-neutral-500">Report will be sent to:</p>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-0">
                      {sessionData?.email || 'Loading...'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="text-xs text-interactive-600 hover:text-interactive-700 transition-colors focus:outline-none focus:ring-2 focus:ring-interactive-600 rounded px-2 py-1"
                  aria-label="Change email address"
                >
                  Change
                </button>
              </div>

              {/* Success message */}
              <AnimatePresence>
                {showSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3 text-sm text-success-600 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Email updated successfully
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Professional actions */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link href="/features" className="flex-1">
                <Button
                  rightIcon={<ArrowRight className="w-5 h-5" />}
                  size="lg"
                  className="w-full"
                >
                  Explore Features
                </Button>
              </Link>
              <Link href="/docs" className="flex-1">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  View Documentation
                </Button>
              </Link>
            </div>
          </motion.article>
        </div>
      </main>

      {/* Email change modal */}
      <EmailChangeModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        currentEmail={sessionData?.email || ''}
        onSubmit={handleEmailUpdate}
      />

      {/* Success animation - confetti would go here when implemented */}
    </div>
  );
}
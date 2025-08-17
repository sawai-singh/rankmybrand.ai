'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Clock, Mail, CheckCircle, Activity, 
  TrendingUp, Shield, Zap, ArrowRight, X,
  FileText, Users, Target, Brain
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Progress states with semantic naming
const PROGRESS_STATES = [
  { id: 'queued', label: 'Queued', icon: Clock, duration: 15000 },
  { id: 'analyzing', label: 'Analyzing Brand', icon: Brain, duration: 20000 },
  { id: 'competing', label: 'Benchmarking Competitors', icon: Users, duration: 15000 },
  { id: 'finalizing', label: 'Finalizing Report', icon: FileText, duration: 10000 }
] as const;

export default function GeneratingPage() {
  const router = useRouter();
  const [currentState, setCurrentState] = useState(0);
  const [email, setEmail] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    // Get user email from session or localStorage
    const sessionData = sessionStorage.getItem('onboarding_session');
    const userData = localStorage.getItem('user');
    
    if (sessionData) {
      const session = JSON.parse(sessionData);
      setEmail(session.email || '');
    } else if (userData) {
      const user = JSON.parse(userData);
      setEmail(user.email || '');
    }

    // Progress simulation (time-based, no server polling)
    let stateIndex = 0;
    const progressInterval = setInterval(() => {
      if (stateIndex < PROGRESS_STATES.length - 1) {
        stateIndex++;
        setCurrentState(stateIndex);
      } else {
        clearInterval(progressInterval);
      }
    }, PROGRESS_STATES[stateIndex]?.duration || 15000);

    return () => clearInterval(progressInterval);
  }, []);

  const handleEmailChange = async (newEmail: string) => {
    // Update email preference
    try {
      const response = await fetch('/api/report/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail })
      });
      
      if (response.ok) {
        setEmail(newEmail);
        setShowEmailModal(false);
      }
    } catch (error) {
      console.error('Failed to update email:', error);
    }
  };

  if (!mounted) return null;

  const CurrentIcon = PROGRESS_STATES[currentState].icon;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Gradient mesh background with GPU acceleration */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900"
        style={{ transform: 'translateZ(0)' }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
      </div>

      {/* Main content with semantic HTML */}
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          {/* Progress stepper */}
          <nav aria-label="Onboarding progress" className="mb-8">
            <ol className="flex items-center justify-center space-x-2">
              {['Brand', 'Description', 'Competitors', 'Generating'].map((step, idx) => (
                <li key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all ${
                    idx < 3 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : 'bg-purple-500/20 text-purple-400 border border-purple-500/30 animate-pulse'
                  }`}>
                    {idx < 3 ? <CheckCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  </div>
                  {idx < 3 && (
                    <div className="w-12 h-0.5 bg-green-500/30 ml-2" />
                  )}
                </li>
              ))}
            </ol>
          </nav>

          {/* Glass card with subtle animation */}
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl"
          >
            {/* Status indicator with ARIA live region */}
            <div className="flex justify-center mb-8">
              <motion.div
                key={currentState}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl animate-pulse" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center border border-purple-500/30">
                  <CurrentIcon className={`w-12 h-12 text-purple-400 ${!prefersReducedMotion && 'animate-pulse'}`} />
                </div>
              </motion.div>
            </div>

            {/* Main heading and description */}
            <header className="text-center space-y-4 mb-8">
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                We're Generating Your Report
              </h1>
              <p className="text-gray-400 text-lg">
                You'll receive a secure link by email in about <strong>60 minutes</strong>
              </p>
              
              {/* Current status with live region for screen readers */}
              <div 
                aria-live="polite" 
                aria-atomic="true"
                className="flex items-center justify-center gap-2 text-sm text-purple-400"
              >
                <Activity className={`w-4 h-4 ${!prefersReducedMotion && 'animate-spin'}`} />
                <span>{PROGRESS_STATES[currentState].label}...</span>
              </div>
            </header>

            {/* Info bullets with icons */}
            <ul className="space-y-4 mb-8" role="list">
              <li className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-purple-500/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-gray-300 font-medium">Comprehensive Analysis</p>
                  <p className="text-gray-500 text-sm">We benchmark your brand against competitors and industry trends</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-blue-500/20 rounded-lg">
                  <Shield className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-300 font-medium">Secure & Private</p>
                  <p className="text-gray-500 text-sm">Your data is encrypted and never shared with third parties</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1 p-1.5 bg-green-500/20 rounded-lg">
                  <Zap className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-300 font-medium">No Action Required</p>
                  <p className="text-gray-500 text-sm">You can close this tab—your place is saved</p>
                </div>
              </li>
            </ul>

            {/* Email display */}
            <div className="p-4 bg-black/20 rounded-xl border border-white/10 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Report will be sent to:</p>
                    <p className="text-sm font-medium text-gray-300">{email || 'your email'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  aria-label="Change email address"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Action buttons with proper focus management */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/features"
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all focus:outline-none focus:ring-4 focus:ring-purple-500/20"
              >
                Explore Features
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/docs"
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/5 text-gray-300 font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition-all focus:outline-none focus:ring-4 focus:ring-white/20"
              >
                View Documentation
              </Link>
            </div>
          </motion.article>

          {/* Progress indicator dots */}
          <div className="mt-8 flex justify-center gap-2" role="presentation">
            {PROGRESS_STATES.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  idx <= currentState
                    ? 'w-8 bg-purple-500'
                    : 'w-1.5 bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </main>

      {/* Email change modal with focus trap */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowEmailModal(false)}
          >
            <motion.dialog
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
              open
            >
              <header className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Change Email Address</h2>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleEmailChange(formData.get('email') as string);
              }}>
                <label htmlFor="email" className="block text-sm text-gray-400 mb-2">
                  New email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={email}
                  className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500 text-white"
                  placeholder="you@company.com"
                />
                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-4 focus:ring-purple-500/20"
                  >
                    Update Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="flex-1 px-4 py-2 bg-white/5 text-gray-300 font-medium rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-4 focus:ring-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.dialog>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
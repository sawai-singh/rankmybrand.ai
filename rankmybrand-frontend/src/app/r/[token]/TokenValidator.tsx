'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, CheckCircle, XCircle, AlertCircle, 
  ArrowRight, RefreshCw, Lock, Clock
} from 'lucide-react';
import Link from 'next/link';

// Declare gtag type
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

interface TokenValidatorProps {
  token: string;
  utmParams?: Record<string, string>;
}

interface ValidationResponse {
  valid: boolean;
  reportId?: string;
  companyId?: string;
  brandName?: string;
  userEmail?: string;
  expiresAt?: string;
  error?: string;
  errorCode?: string;
}

type ValidationState = 'validating' | 'success' | 'expired' | 'invalid' | 'error';

type ErrorMessage = {
  title: string;
  message: string;
  action?: string;
};

const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  TOKEN_EXPIRED: {
    title: 'Link Expired',
    message: 'This report link has expired for security reasons.',
    action: 'Request a new report'
  },
  TOKEN_INVALID: {
    title: 'Invalid Link',
    message: 'This link appears to be invalid or has already been used.',
    action: 'Contact support'
  },
  TOKEN_REVOKED: {
    title: 'Access Revoked',
    message: 'Access to this report has been revoked.',
    action: 'Request new access'
  },
  RATE_LIMITED: {
    title: 'Too Many Attempts',
    message: 'Please wait a moment before trying again.',
    action: 'Try again in 60 seconds'
  },
  SERVER_ERROR: {
    title: 'Technical Issue',
    message: 'We encountered a technical issue. Please try again.',
    action: 'Retry'
  }
};

export default function TokenValidator({ token, utmParams }: TokenValidatorProps) {
  const router = useRouter();
  const [state, setState] = useState<ValidationState>('validating');
  const [error, setError] = useState<ErrorMessage | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [validationData, setValidationData] = useState<ValidationResponse | null>(null);

  const validateToken = useCallback(async () => {
    setState('validating');
    setProgress(10);

    try {
      // Add artificial minimum loading time for better UX
      const minLoadTime = new Promise(resolve => setTimeout(resolve, 1500));
      
      setProgress(30);

      // Get device fingerprint for security
      const deviceInfo = {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        language: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
        platform: typeof navigator !== 'undefined' ? (navigator as any).platform || '' : '',
        screenResolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: new Date().toISOString()
      };

      setProgress(50);

      const response = await fetch('/api/report/validate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        },
        body: JSON.stringify({ 
          token,
          deviceInfo,
          utmParams,
          retryCount
        }),
        credentials: 'include'
      });

      setProgress(70);

      const data: ValidationResponse = await response.json();

      // Wait for minimum load time
      await minLoadTime;
      setProgress(90);

      if (response.ok && data.valid) {
        setValidationData(data);
        setState('success');
        setProgress(100);
        
        // Track successful validation
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'report_access', {
            event_category: 'engagement',
            event_label: 'email_link',
            value: 1,
            ...utmParams
          });
        }

        // Redirect after brief success message
        setTimeout(() => {
          const dashboardUrl = new URL('/dashboard', window.location.origin);
          dashboardUrl.searchParams.set('report', data.reportId!);
          dashboardUrl.searchParams.set('from', 'email');
          if (data.companyId) {
            dashboardUrl.searchParams.set('company', data.companyId);
          }
          // Preserve UTM params
          Object.entries(utmParams || {}).forEach(([key, value]) => {
            dashboardUrl.searchParams.set(key, value);
          });
          
          router.push(dashboardUrl.toString());
        }, 1500);
      } else {
        // Handle various error states
        const errorCode = data.errorCode || 'TOKEN_INVALID';
        setError(ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.TOKEN_INVALID);
        
        if (errorCode === 'TOKEN_EXPIRED') {
          setState('expired');
        } else if (errorCode === 'RATE_LIMITED') {
          setState('error');
          // Auto-retry after delay
          setTimeout(() => {
            if (retryCount < 3) {
              setRetryCount(prev => prev + 1);
              validateToken();
            }
          }, 60000);
        } else {
          setState('invalid');
        }
        
        setProgress(0);
      }
    } catch (err) {
      console.error('Token validation error:', err);
      setError(ERROR_MESSAGES.SERVER_ERROR);
      setState('error');
      setProgress(0);
      
      // Track error
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'exception', {
          description: 'token_validation_error',
          fatal: false
        });
      }
    }
  }, [token, utmParams, retryCount, router]);

  useEffect(() => {
    validateToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    validateToken();
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-900">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900" />
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, -30, 0],
            y: [0, 20, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      </div>

      {/* Main content */}
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
          >
            <AnimatePresence mode="wait">
              {/* Validating State */}
              {state === 'validating' && (
                <motion.div
                  key="validating"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center space-y-6"
                >
                  <div className="relative mx-auto w-20 h-20">
                    <motion.div
                      className="absolute inset-0 border-4 border-purple-500/30 rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'linear'
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Shield className="w-10 h-10 text-purple-400" />
                    </div>
                  </div>

                  <div>
                    <h1 className="text-2xl font-bold text-white mb-2">
                      Validating Secure Link
                    </h1>
                    <p className="text-gray-400 text-sm">
                      Verifying your access credentials...
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <Lock className="w-3 h-3" />
                    <span>Encrypted connection established</span>
                  </div>
                </motion.div>
              )}

              {/* Success State */}
              {state === 'success' && validationData && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center space-y-6"
                >
                  <motion.div
                    className="mx-auto w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <CheckCircle className="w-10 h-10 text-green-400" />
                  </motion.div>

                  <div>
                    <h1 className="text-2xl font-bold text-white mb-2">
                      Access Granted
                    </h1>
                    <p className="text-gray-400">
                      {validationData.brandName && (
                        <>Report for <span className="text-white">{validationData.brandName}</span></>
                      )}
                    </p>
                    {validationData.userEmail && (
                      <p className="text-gray-500 text-sm mt-1">
                        {validationData.userEmail}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-2 text-purple-400">
                    <span className="text-sm">Redirecting to dashboard</span>
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* Error States */}
              {(state === 'expired' || state === 'invalid' || state === 'error') && error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center space-y-6"
                >
                  <div className="mx-auto w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                    {state === 'expired' ? (
                      <Clock className="w-10 h-10 text-red-400" />
                    ) : state === 'error' ? (
                      <AlertCircle className="w-10 h-10 text-yellow-400" />
                    ) : (
                      <XCircle className="w-10 h-10 text-red-400" />
                    )}
                  </div>

                  <div>
                    <h1 className="text-2xl font-bold text-white mb-2">
                      {error.title}
                    </h1>
                    <p className="text-gray-400">
                      {error.message}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {state === 'error' && retryCount < 3 && (
                      <button
                        onClick={handleRetry}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <RefreshCw className="w-5 h-5" />
                        {error.action || 'Try Again'}
                      </button>
                    )}

                    {state === 'expired' && (
                      <Link
                        href="/request-report"
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {error.action}
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    )}

                    <Link
                      href="/access"
                      className="w-full flex items-center justify-center px-6 py-3 bg-white/5 text-gray-300 font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                    >
                      Request Access
                    </Link>

                    {(state === 'invalid' || (state === 'error' && retryCount >= 3)) && (
                      <a
                        href="mailto:support@rankmybrand.ai"
                        className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
                      >
                        Need help? Contact support
                      </a>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Security badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-center"
          >
            <div className="inline-flex items-center gap-2 text-xs text-gray-500">
              <Shield className="w-3 h-3" />
              <span>Secured by RankMyBrand Enterprise Security</span>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Sparkles, Building2, CheckCircle2, AlertCircle, ArrowRight, Shield, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface EmailCaptureHeroProps {
  onSubmit?: (email: string) => void;
}

export function EmailCaptureHero({ onSubmit }: EmailCaptureHeroProps) {
  const [email, setEmail] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setValidationError(null);
  };

  const validateAndEnrich = async () => {
    if (!email) return;

    setIsValidating(true);
    setValidationError(null);

    try {
      // First check if it's a valid email format client-side
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setValidationError('Please enter a valid email address');
        setIsValidating(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';
      console.log('Validating email with API:', apiUrl);

      // Validate email
      const validateResponse = await fetch(`${apiUrl}/api/onboarding/validate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      console.log('Validation response status:', validateResponse.status);

      if (!validateResponse.ok) {
        // Check if it's a network error or server error
        if (!validateResponse.status) {
          setValidationError('Cannot connect to server. Please ensure the API is running.');
          setIsValidating(false);
          return;
        }
      }

      const validation = await validateResponse.json();
      console.log('Validation response:', validation);

      if (!validation.valid) {
        setValidationError(validation.message || validation.error || 'Please use your company email address');
        setIsValidating(false);
        return;
      }

      // Enrich company data
      const enrichResponse = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/onboarding/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const enrichData = await enrichResponse.json();

      if (enrichData.error) {
        setValidationError(enrichData.error);
        setIsValidating(false);
        return;
      }

      setHasSubmitted(true);
      
      // Store session data
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('onboarding_session', JSON.stringify({
          sessionId: enrichData.sessionId,
          email,
          enrichmentData: enrichData.enrichmentData
        }));
      }

      // Navigate to company details page
      setTimeout(() => {
        router.push('/onboarding/company');
      }, 1000);

      if (onSubmit) {
        onSubmit(email);
      }
    } catch (error: any) {
      console.error('Validation/Enrichment failed:', error);
      
      // Check if it's a network error
      if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
        setValidationError('Cannot connect to server. Please check if the API Gateway is running on port 4000.');
      } else if (error.message.includes('CORS')) {
        setValidationError('CORS error. Please check API Gateway configuration.');
      } else {
        setValidationError(`Error: ${error.message || 'Something went wrong. Please try again.'}`);
      }
      
      toast.error('Failed to process your email. Check console for details.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && email && !isValidating) {
      validateAndEnrich();
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="relative w-full max-w-6xl mx-auto">
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 via-purple-500/20 to-pink-500/20 blur-3xl -z-10" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.h1 
            className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          >
            See How AI Sees Your Brand
          </motion.h1>
          <motion.p 
            className="text-xl text-gray-600 dark:text-gray-300"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Get your AI visibility score and outrank competitors in <span className="font-bold text-primary-600">10 seconds</span>
          </motion.p>
        </div>

        {/* Input Section */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-purple-500/20 rounded-2xl blur-xl" />
            <div className="relative flex items-center">
              <div className="absolute left-4 text-gray-400">
                <Mail className="w-5 h-5" />
              </div>
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Enter your work email (e.g., john@company.com)"
                className={cn(
                  "w-full pl-12 pr-32 py-5 text-lg rounded-2xl border-2",
                  "bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm",
                  "focus:outline-none focus:ring-4 transition-all duration-300",
                  validationError 
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-primary-200 dark:border-primary-800 focus:border-primary-500 focus:ring-primary-500/20"
                )}
                disabled={isValidating || hasSubmitted}
              />
              
              <motion.button
                onClick={validateAndEnrich}
                disabled={!email || isValidating || hasSubmitted}
                className="absolute right-2 px-8 py-3 bg-gradient-to-r from-primary-600 to-purple-600 
                         text-white font-semibold rounded-xl
                         hover:from-primary-700 hover:to-purple-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 transform hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isValidating ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                  />
                ) : hasSubmitted ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <span className="flex items-center gap-2">
                    Get Started
                    <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </motion.button>
            </div>
          </div>

          {/* Validation Error */}
          <AnimatePresence>
            {validationError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-2 flex items-center gap-2 text-red-500 text-sm"
              >
                <AlertCircle className="w-4 h-4" />
                <span>{validationError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Message */}
          <AnimatePresence>
            {hasSubmitted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-200">Great! We found your company.</p>
                    <p className="text-sm text-green-600 dark:text-green-400">Redirecting to setup...</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trust Indicators */}
          {!hasSubmitted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>10-second setup</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Join 1,000+ brands</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Value Props */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid md:grid-cols-3 gap-6 mt-12"
        >
          <ValueCard
            icon={<Building2 className="w-6 h-6" />}
            title="Company Enrichment"
            description="We automatically pull your company details from trusted sources"
          />
          <ValueCard
            icon={<Sparkles className="w-6 h-6" />}
            title="AI-Powered Analysis"
            description="Get instant insights on how AI platforms see your brand"
          />
          <ValueCard
            icon={<Users className="w-6 h-6" />}
            title="Competitor Discovery"
            description="Find and track your real competitors automatically"
          />
        </motion.div>

        {/* Social Proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center mt-12"
        >
          <p className="text-sm text-gray-500">
            Trusted by leading brands from
          </p>
          <div className="mt-4 flex items-center justify-center gap-8 opacity-60 grayscale">
            <span className="text-2xl font-bold">TechCorp</span>
            <span className="text-2xl font-bold">FinanceHub</span>
            <span className="text-2xl font-bold">E-Shop Pro</span>
            <span className="text-2xl font-bold">HealthPlus</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function ValueCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="relative group"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:border-primary-500 transition-all">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/20 rounded-lg text-primary-600 dark:text-primary-400">
            {icon}
          </div>
        </div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </motion.div>
  );
}
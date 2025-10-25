'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, ArrowRight, CheckCircle, AlertCircle,
  Sparkles, Shield, Clock, TrendingUp, Users,
  BarChart, Send, Loader2, Info
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function RequestAccessPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    
    try {
      // Check if user exists
      const checkResponse = await fetch(`${apiUrl}/api/auth/check-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const checkData = await checkResponse.json();
      
      if (checkData.exists) {
        // User exists - send magic link for report access
        const magicLinkResponse = await fetch(`${apiUrl}/api/auth/magic-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        if (magicLinkResponse.ok) {
          setUserExists(true);
          setSuccess(true);
          toast.success('Report access link sent to your email!');
        } else {
          throw new Error('Failed to send access link');
        }
      } else {
        // User doesn't exist - suggest onboarding
        setUserExists(false);
        setSuccess(true);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setSuccess(false);
    setUserExists(null);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      {/* Professional neutral background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-neutral-900/5 dark:bg-neutral-0/5 rounded-full blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-96 h-96 bg-neutral-900/3 dark:bg-neutral-0/3 rounded-full blur-3xl"
          animate={{
            x: [0, -50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      </div>

      {/* Main content */}
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Professional logo/brand */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-neutral-900 dark:bg-neutral-0 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white dark:text-neutral-900" />
              </div>
              <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-0">RankMyBrand</span>
            </Link>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-0 mb-2">Access Your AI Report</h1>
            <p className="text-neutral-600 dark:text-neutral-400">Enter your email to view your visibility scores</p>
          </div>

          {/* Main Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass rounded-2xl p-8 shadow-2xl"
          >
            <AnimatePresence mode="wait">
              {!success ? (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-6"
                >
                  {/* Professional email input */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Work Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      leftIcon={<Mail className="h-5 w-5" />}
                      inputSize="lg"
                      className="bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-0 placeholder-neutral-500"
                      required
                      disabled={loading}
                    />
                    <p className="mt-2 text-xs text-neutral-500 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      We'll send a secure link to access your report
                    </p>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={loading}
                    loading={loading}
                    rightIcon={!loading ? <ArrowRight className="w-5 h-5" /> : undefined}
                    size="lg"
                    className="w-full"
                  >
                    {loading ? 'Checking...' : 'Request Access'}
                  </Button>

                  {/* Professional divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-neutral-200 dark:border-neutral-800"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white dark:bg-neutral-900 text-neutral-500">New to RankMyBrand?</span>
                    </div>
                  </div>

                  {/* Professional sign up link */}
                  <Link href="/" className="w-full">
                    <Button
                      variant="outline"
                      leftIcon={<Sparkles className="w-5 h-5" />}
                      size="lg"
                      className="w-full"
                    >
                      Get Your Free Report
                    </Button>
                  </Link>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center space-y-6"
                >
                  {userExists ? (
                    <>
                      {/* Existing User - Link Sent */}
                      <div className="flex justify-center">
                        <div className="w-20 h-20 bg-success-50 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-10 h-10 text-success-600" />
                        </div>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-0 mb-2">Check Your Email!</h2>
                        <p className="text-neutral-600 dark:text-neutral-400">
                          We've sent a secure link to <span className="text-neutral-900 dark:text-neutral-0 font-medium">{email}</span>
                        </p>
                        <p className="text-sm text-neutral-500 mt-2">
                          Click the link in your email to access your AI visibility report
                        </p>
                      </div>
                      <div className="p-4 bg-interactive-50 border border-interactive-200 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Mail className="w-5 h-5 text-interactive-600 flex-shrink-0 mt-0.5" />
                          <div className="text-left">
                            <p className="text-sm text-interactive-800 font-medium">Didn't receive it?</p>
                            <p className="text-xs text-interactive-700 mt-1">
                              Check your spam folder or{' '}
                              <button
                                onClick={resetForm}
                                className="underline hover:text-interactive-800 transition-colors"
                              >
                                try again
                              </button>
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* New User - Suggest Onboarding */}
                      <div className="flex justify-center">
                        <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
                          <Sparkles className="w-10 h-10 text-neutral-600 dark:text-neutral-400" />
                        </div>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-0 mb-2">Welcome to RankMyBrand!</h2>
                        <p className="text-neutral-600 dark:text-neutral-400">
                          No report found for <span className="text-neutral-900 dark:text-neutral-0 font-medium">{email}</span>
                        </p>
                        <p className="text-sm text-neutral-500 mt-2">
                          Let's create your first AI visibility report - it only takes <span className="font-mono tabular-nums">60</span> seconds!
                        </p>
                      </div>
                      <div className="space-y-3">
                        <Link href={`/?email=${encodeURIComponent(email)}`} className="w-full">
                          <Button
                            leftIcon={<Sparkles className="w-5 h-5" />}
                            rightIcon={<ArrowRight className="w-5 h-5" />}
                            size="lg"
                            className="w-full"
                          >
                            Get My Free Report
                          </Button>
                        </Link>
                        <Button
                          variant="link"
                          onClick={resetForm}
                          className="w-full text-sm text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400"
                        >
                          Try a different email
                        </Button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Professional features */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { icon: TrendingUp, label: 'AI Visibility' },
              { icon: Users, label: 'Competitor Analysis' },
              { icon: BarChart, label: 'Instant Reports' }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * idx }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-lg mb-2">
                  <item.icon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                </div>
                <p className="text-xs text-neutral-500">{item.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Professional security badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-center"
          >
            <div className="inline-flex items-center gap-2 text-xs text-neutral-500">
              <Shield className="w-3 h-3" />
              <span><span className="font-mono tabular-nums">256</span>-bit encrypted • GDPR compliant • No passwords stored</span>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
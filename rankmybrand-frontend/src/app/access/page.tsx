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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Animated background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
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
          className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
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
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">RankMyBrand</span>
            </Link>
            <h1 className="text-3xl font-bold text-white mb-2">Access Your AI Report</h1>
            <p className="text-gray-400">Enter your email to view your visibility scores</p>
          </div>

          {/* Main Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl"
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
                  {/* Email Input */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                      Work Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        required
                        disabled={loading}
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      We'll send a secure link to access your report
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        Request Access
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-transparent text-gray-500">New to RankMyBrand?</span>
                    </div>
                  </div>

                  {/* Sign Up Link */}
                  <Link
                    href="/"
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white/5 text-gray-300 font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    <Sparkles className="w-5 h-5" />
                    Get Your Free Report
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
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-10 h-10 text-green-400" />
                        </div>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Check Your Email!</h2>
                        <p className="text-gray-400">
                          We've sent a secure link to <span className="text-white font-medium">{email}</span>
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          Click the link in your email to access your AI visibility report
                        </p>
                      </div>
                      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Mail className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <div className="text-left">
                            <p className="text-sm text-purple-300 font-medium">Didn't receive it?</p>
                            <p className="text-xs text-purple-300/80 mt-1">
                              Check your spam folder or{' '}
                              <button
                                onClick={resetForm}
                                className="underline hover:text-purple-400 transition-colors"
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
                        <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center">
                          <Sparkles className="w-10 h-10 text-purple-400" />
                        </div>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Welcome to RankMyBrand!</h2>
                        <p className="text-gray-400">
                          No report found for <span className="text-white font-medium">{email}</span>
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          Let's create your first AI visibility report - it only takes 60 seconds!
                        </p>
                      </div>
                      <div className="space-y-3">
                        <Link
                          href={`/?email=${encodeURIComponent(email)}`}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all"
                        >
                          <Sparkles className="w-5 h-5" />
                          Get My Free Report
                          <ArrowRight className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={resetForm}
                          className="w-full text-sm text-gray-500 hover:text-gray-400 transition-colors"
                        >
                          Try a different email
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Features */}
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
                <div className="inline-flex items-center justify-center w-10 h-10 bg-white/5 rounded-lg mb-2">
                  <item.icon className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500">{item.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Security Badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-center"
          >
            <div className="inline-flex items-center gap-2 text-xs text-gray-500">
              <Shield className="w-3 h-3" />
              <span>256-bit encrypted • GDPR compliant • No passwords stored</span>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
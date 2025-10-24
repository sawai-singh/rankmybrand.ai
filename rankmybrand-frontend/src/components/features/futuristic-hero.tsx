'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, Globe, Shield, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function FuturisticHero() {
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Mouse tracking for parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Smooth spring animations for mouse movement
  const springConfig = { damping: 25, stiffness: 150 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);
  
  // Parallax transforms
  const moveX = useTransform(x, [-0.5, 0.5], [-20, 20]);
  const moveY = useTransform(y, [-0.5, 0.5], [-20, 20]);
  const moveXReverse = useTransform(x, [-0.5, 0.5], [20, -20]);
  const moveYReverse = useTransform(y, [-0.5, 0.5], [20, -20]);
  
  // Set mounted state for client-only features
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Track mouse movement
  useEffect(() => {
    if (!mounted) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const x = (e.clientX - centerX) / rect.width;
      const y = (e.clientY - centerY) / rect.height;
      mouseX.set(x);
      mouseY.set(y);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY, mounted]);
  
  
  const features = [
    { icon: Zap, text: 'Real-time AI tracking', delay: 0 },
    { icon: Globe, text: 'Multi-platform coverage', delay: 0.1 },
    { icon: Shield, text: 'Enterprise security', delay: 0.2 },
    { icon: TrendingUp, text: 'Growth insights', delay: 0.3 },
  ];
  
  return (
    <section ref={containerRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Gradient Mesh Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 gradient-mesh-animated opacity-30" />
        
        {/* Floating Orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
            x: moveX,
            y: moveY,
          }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%)',
            x: moveXReverse,
            y: moveYReverse,
          }}
          animate={{
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%]"
          style={{
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, transparent 60%)',
          }}
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        
        {/* Particle Field - Only render after mount to avoid hydration issues */}
        {mounted && [...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              y: [null, Math.random() * window.innerHeight],
            }}
            transition={{
              duration: Math.random() * 20 + 10,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'linear',
            }}
          />
        ))}
      </div>
      
      {/* Main Content */}
      <div className="container mx-auto px-4 z-10">
        <motion.div
          className="max-w-5xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {/* Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel-elevated mb-8"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
              AI Visibility Platform
            </span>
          </motion.div>
          
          {/* Main Heading */}
          <motion.h1
            className="fluid-heading font-bold mb-6 bg-gradient-to-r from-gray-900 via-violet-900 to-gray-900 dark:from-white dark:via-violet-200 dark:to-white bg-clip-text text-transparent"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Track Your Brand Across
            <br />
            <span className="relative">
              <motion.span
                className="relative z-10"
                animate={{
                  backgroundImage: [
                    'linear-gradient(90deg, #8B5CF6 0%, #EC4899 50%, #06B6D4 100%)',
                    'linear-gradient(90deg, #06B6D4 0%, #8B5CF6 50%, #EC4899 100%)',
                    'linear-gradient(90deg, #EC4899 0%, #06B6D4 50%, #8B5CF6 100%)',
                  ],
                }}
                transition={{ duration: 5, repeat: Infinity }}
                style={{
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                AI Platforms
              </motion.span>
              
              {/* Animated underline */}
              <motion.div
                className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-violet-600 via-pink-600 to-cyan-600 rounded-full"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
              />
            </span>
          </motion.h1>
          
          {/* Subtitle */}
          <motion.p
            className="fluid-text-xl text-gray-600 dark:text-gray-400 mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            Monitor your visibility across all major AI platforms.
            Get real-time insights and optimize your AI presence.
          </motion.p>
          
          {/* Domain Input Section */}
          <div className="glass-panel-floating rounded-3xl p-8 mb-12 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                placeholder="Enter your domain (e.g., example.com)"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="flex-1 px-6 py-4 rounded-2xl bg-white/10 dark:bg-black/10 backdrop-blur-xl border border-white/20 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
              />
              {domain && domain.trim() ? (
                <button
                  onClick={async () => {
                    if (domain && typeof window !== 'undefined') {
                      setIsAnalyzing(true);
                      
                      try {
                        // Call the enrichment API
                        const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/onboarding/enrich`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: domain })
                        });
                        
                        let enrichmentData = null;
                        let sessionId = null;
                        if (response.ok) {
                          const data = await response.json();
                          enrichmentData = data.enrichmentData || data.company || data;
                          sessionId = data.sessionId;
                        }
                        
                        // Extract company name from domain/email more intelligently
                        let companyName = domain;
                        if (domain.includes('@')) {
                          // Extract domain from email
                          companyName = domain.split('@')[1];
                        }
                        // Remove common TLDs and clean up
                        companyName = companyName
                          .replace(/\.(com|org|net|io|ai|co|dev|app|tech)$/i, '')
                          .replace(/^www\./i, '')
                          .replace(/[-_]/g, ' ')
                          .split(' ')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                          .join(' ');
                        
                        // Create session data with enriched information
                        const sessionData = {
                          sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                          domain: domain,
                          email: domain,
                          company: enrichmentData || {
                            name: companyName,
                            domain: domain.includes('@') ? domain.split('@')[1] : domain,
                            industry: 'Technology',
                            description: `${companyName} is a leading technology company focused on innovation and digital transformation.`,
                            size: '10-50 employees',
                            location: { city: 'San Francisco', state: 'CA', country: 'USA' },
                            techStack: ['React', 'Node.js', 'TypeScript'],
                            confidence: 0.85,
                            enrichmentSource: 'fallback'
                          },
                          enrichmentData: enrichmentData || {
                            name: companyName,
                            domain: domain.includes('@') ? domain.split('@')[1] : domain,
                            industry: 'Technology',
                            description: `${companyName} is a leading technology company focused on innovation and digital transformation.`,
                            size: '10-50 employees',
                            employeeCount: 50,
                            location: { city: 'San Francisco', state: 'CA', country: 'USA' },
                            socialProfiles: {},
                            tags: [],
                            techStack: ['React', 'Node.js', 'TypeScript'],
                            competitors: [],
                            confidence: 0.85,
                            enrichmentSource: 'fallback'
                          },
                          startedAt: new Date().toISOString()
                        };
                        
                        // Store domain and session data
                        localStorage.setItem('onboarding_domain', domain);
                        sessionStorage.setItem('onboarding_session', JSON.stringify(sessionData));
                        
                        // Navigate to company page
                        router.push('/onboarding/company');
                      } catch (error) {
                        console.error('Enrichment error:', error);
                        
                        // Fallback: navigate with basic data
                        let companyName = domain;
                        if (domain.includes('@')) {
                          companyName = domain.split('@')[1];
                        }
                        companyName = companyName
                          .replace(/\.(com|org|net|io|ai|co)$/i, '')
                          .replace(/^www\./i, '')
                          .replace(/[-_]/g, ' ')
                          .split(' ')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                          .join(' ');
                        
                        const sessionData = {
                          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                          domain: domain,
                          enrichmentData: {
                            name: companyName,
                            domain: domain.includes('@') ? domain.split('@')[1] : domain,
                            industry: 'Technology',
                            description: `${companyName} is a technology company.`,
                            confidence: 0.5,
                            enrichmentSource: 'fallback'
                          },
                          startedAt: new Date().toISOString()
                        };
                        
                        localStorage.setItem('onboarding_domain', domain);
                        sessionStorage.setItem('onboarding_session', JSON.stringify(sessionData));
                        router.push('/onboarding/company');
                      } finally {
                        setIsAnalyzing(false);
                      }
                    }
                  }}
                  disabled={!domain || isAnalyzing}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Start Free Analysis'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600/50 to-pink-600/50 text-white/50 font-semibold shadow-lg cursor-not-allowed flex items-center gap-2 group inline-flex text-center"
                >
                  Start Free Analysis
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Trust Signals */}
            <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Free
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                No signup required
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Results in 60 minutes
              </span>
            </div>
          </div>
          
          {/* Features */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="glass-panel p-4 rounded-xl cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 + feature.delay, duration: 0.5 }}
                onHoverStart={() => setHoveredFeature(index)}
                onHoverEnd={() => setHoveredFeature(null)}
                whileHover={{ scale: 1.05, y: -5 }}
              >
                <motion.div
                  animate={{
                    rotate: hoveredFeature === index ? 360 : 0,
                  }}
                  transition={{ duration: 0.5 }}
                >
                  <feature.icon className="w-6 h-6 mx-auto mb-2 text-violet-500" />
                </motion.div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {feature.text}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
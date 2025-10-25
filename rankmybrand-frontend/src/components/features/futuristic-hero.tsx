'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, Globe, Shield, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
      {/* Professional Subtle Background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-neutral-900">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
            backgroundSize: '64px 64px'
          }}
        />

        {/* Subtle floating elements for depth */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0, 0, 0, 0.03) 0%, transparent 70%)',
            x: moveX,
            y: moveY,
          }}
          animate={{
            scale: [1, 1.1, 1],
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
            background: 'radial-gradient(circle, rgba(0, 0, 0, 0.02) 0%, transparent 70%)',
            x: moveXReverse,
            y: moveYReverse,
          }}
          animate={{
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
      
      {/* Main Content */}
      <div className="container mx-auto px-4 z-10">
        <motion.div
          className="max-w-5xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {/* Professional badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 mb-8"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            <Sparkles className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
            <span className="section-header">
              AI Visibility Platform
            </span>
          </motion.div>
          
          {/* Professional heading */}
          <motion.h1
            className="fluid-heading font-bold mb-6 text-neutral-900 dark:text-neutral-0"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Track Your Brand Across
            <br />
            <span className="relative">
              <span className="relative z-10">
                AI Platforms
              </span>

              {/* Professional underline */}
              <motion.div
                className="absolute -bottom-2 left-0 right-0 h-1 bg-neutral-900 dark:bg-neutral-0 rounded-full"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
              />
            </span>
          </motion.h1>
          
          {/* Professional subtitle */}
          <motion.p
            className="fluid-text-xl text-neutral-600 dark:text-neutral-400 mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            Monitor your visibility across all major AI platforms.
            Get real-time insights and optimize your AI presence.
          </motion.p>
          
          {/* Professional input section */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 mb-12 max-w-2xl mx-auto bg-white dark:bg-neutral-900">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                type="text"
                placeholder="Enter your domain (e.g., example.com)"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                inputSize="xl"
                className="flex-1 bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
              />
              <Button
                disabled={!domain || !domain.trim() || isAnalyzing}
                loading={isAnalyzing}
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
                size="xl"
                rightIcon={!isAnalyzing ? <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> : undefined}
                className="px-8 rounded-2xl"
              >
                {isAnalyzing ? 'Analyzing...' : 'Start Free Analysis'}
              </Button>
            </div>

            {/* Professional trust signals */}
            <div className="flex items-center justify-center gap-4 mt-4 text-sm text-neutral-600 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Free
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                No signup required
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Results in <span className="font-mono tabular-nums">60</span> minutes
              </span>
            </div>
          </div>
          
          {/* Professional features */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 rounded-xl cursor-pointer"
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
                  <feature.icon className="w-6 h-6 mx-auto mb-2 text-neutral-600 dark:text-neutral-400" />
                </motion.div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
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
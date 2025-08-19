'use client';

/**
 * Description Page - AI-Powered Company Description
 * [51:Microcopy] Transparent AI assistance messaging
 * [13:Doherty] Sub-400ms interactions with optimistic updates
 * [43:Keyboard navigation] Full keyboard support
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, Loader2, ArrowRight, ArrowLeft, FileText, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function DescriptionPage() {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [sessionId, setSessionId] = useState('');
  const [company, setCompany] = useState<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Load session data
    const sessionData = sessionStorage.getItem('onboarding_session');
    if (!sessionData) {
      router.push('/');
      return;
    }

    const session = JSON.parse(sessionData);
    setSessionId(session.sessionId);
    setCompany(session.company || session.enrichmentData);
    
    // Load or generate initial description
    if (session.description) {
      setDescription(session.description);
      setOriginalDescription(session.description);
      setWordCount(session.description.split(' ').filter(Boolean).length);
      setLoading(false);
    } else {
      generateDescription(session);
    }
  }, [router]);

  const generateDescription = async (session?: any) => {
    setGenerating(true);
    
    try {
      const currentSession = session || JSON.parse(sessionStorage.getItem('onboarding_session') || '{}');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/onboarding/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.sessionId,
          company: currentSession.company || currentSession.enrichmentData,
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setDescription(data.description);
      setOriginalDescription(data.description);
      setWordCount(data.wordCount || data.description.split(' ').filter(Boolean).length);
      setLoading(false);
    } catch (error) {
      console.error('Failed to generate description:', error);
      
      // Fallback description
      const fallbackDesc = `${company?.name || 'Your company'} operates in the ${company?.industry || 'technology'} sector, providing innovative solutions to customers worldwide.`;
      setDescription(fallbackDesc);
      setOriginalDescription(fallbackDesc);
      setWordCount(fallbackDesc.split(' ').filter(Boolean).length);
      setLoading(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setWordCount(value.split(' ').filter(Boolean).length);
  };

  const handleRegenerate = () => {
    generateDescription();
  };

  const handleContinue = async () => {
    setSaving(true);
    
    try {
      // Save description to session
      const sessionData = JSON.parse(sessionStorage.getItem('onboarding_session') || '{}');
      sessionData.description = description;
      sessionData.descriptionEdited = description !== originalDescription;
      sessionStorage.setItem('onboarding_session', JSON.stringify(sessionData));
      
      // Track the description save
      await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/onboarding/save-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          description,
          wasEdited: description !== originalDescription
        })
      });
      
      // Navigate to competitors page
      router.push('/onboarding/competitors');
    } catch (error) {
      console.error('Failed to save description:', error);
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [description]);

  if (loading && !generating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-primary-500 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Preparing description...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 md:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <nav aria-label="Progress" className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Step 2 of 3</span>
            <span>Company Description</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: '66%' }}
              role="progressbar"
              aria-valuenow={66}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </nav>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header - [51:Microcopy] Clear, honest messaging */}
          <header className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Describe Your Company
            </h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              We've drafted a description based on your company information. Edit it to better represent your brand and values.
            </p>
          </header>

          {/* Description Card */}
          <article className="glass rounded-2xl p-6 md:p-8 mb-8">
            {/* Tools Bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {wordCount} words
                </span>
              </div>
              
              <button
                onClick={handleRegenerate}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Regenerate description"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Regenerate
              </button>
            </div>

            {/* Textarea - [43:Keyboard navigation] Full keyboard support */}
            <div className="relative">
              {generating && (
                <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                  <div className="text-center">
                    <Wand2 className="w-8 h-8 text-primary-500 animate-pulse mx-auto mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">AI is writing...</p>
                  </div>
                </div>
              )}
              
              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                disabled={generating}
                className="w-full min-h-[200px] p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="Describe your company, products, and mission..."
                aria-label="Company description"
              />
            </div>

            {/* AI Indicator - [51:Microcopy] Transparent about AI assistance */}
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <Sparkles className="w-4 h-4" />
              <span>
                {description === originalDescription ? 'AI generated' : 'User edited'}
              </span>
            </div>
          </article>

          {/* Actions - [52:CTA] Clear primary action */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => router.push('/onboarding/company')}
              className="btn-ghost"
              aria-label="Go back to company details"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            
            <motion.button
              onClick={handleContinue}
              disabled={saving || generating || !description.trim()}
              className="btn-primary flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-label="Continue to competitors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
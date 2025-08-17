'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, Loader2, ArrowRight, ArrowLeft, FileText, Wand2, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function DescriptionPage() {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [sessionId, setSessionId] = useState('');
  const [company, setCompany] = useState<any>(null);
  const [crawlProgress, setCrawlProgress] = useState(0);
  const [editCount, setEditCount] = useState(0);
  const [pageStartTime] = useState(Date.now());

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
    
    // Generate initial description
    generateDescription(session);
  }, []);

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
          crawledPages: [] // Will be populated from background crawl
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setDescription(data.description);
      setOriginalDescription(data.description);  // Store original for tracking
      setWordCount(data.wordCount);
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to generate description:', error);
      toast.error('Failed to generate description');
      
      // Fallback to basic description
      const fallbackDesc = `${company?.name || 'Your company'} is a leading organization in the ${company?.industry || 'technology'} industry, dedicated to delivering innovative solutions and exceptional value to customers.`;
      setDescription(fallbackDesc);
      setWordCount(fallbackDesc.split(' ').length);
      setLoading(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleDescriptionChange = async (value: string) => {
    const oldValue = description;
    setDescription(value);
    setWordCount(value.split(' ').filter(word => word.length > 0).length);
    setEditCount(prev => prev + 1);
    
    // Track the edit if it's different from original
    if (value !== originalDescription && sessionId) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/onboarding/track-edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            field: 'description',
            oldValue: oldValue,
            newValue: value,
            step: 'description_editing'
          })
        });
      } catch (error) {
        console.error('Failed to track description edit:', error);
      }
    }
  };

  const handleRegenerate = () => {
    generateDescription();
  };

  const handleContinue = async () => {
    if (!description || wordCount < 10) {
      toast.error('Please provide a meaningful description (at least 10 words)');
      return;
    }

    // Calculate time spent on this step
    const timeSpent = Math.round((Date.now() - pageStartTime) / 1000);
    
    // Track final description if edited
    if (description !== originalDescription && sessionId) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/onboarding/track-edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            field: 'final_description',
            oldValue: originalDescription,
            newValue: description,
            step: 'description_final',
            metadata: {
              editCount,
              timeSpent,
              wordCount
            }
          })
        });
      } catch (error) {
        console.error('Failed to track final description:', error);
      }
    }

    // Save description to session
    const sessionData = JSON.parse(sessionStorage.getItem('onboarding_session') || '{}');
    sessionData.description = description;
    sessionData.originalDescription = originalDescription;
    sessionData.editedDescription = description !== originalDescription ? description : null;
    sessionData.descriptionEditCount = editCount;
    sessionData.timeOnDescriptionStep = timeSpent;
    sessionStorage.setItem('onboarding_session', JSON.stringify(sessionData));
    
    // Navigate to competitor selection
    router.push('/onboarding/competitors');
  };

  const handleBack = () => {
    router.push('/onboarding/company');
  };

  if (loading && !generating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Analyzing your website...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Step 2 of 4</span>
            <span>Company Description</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
            <motion.div 
              className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full"
              initial={{ width: '25%' }}
              animate={{ width: '50%' }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-500 rounded-2xl mb-4">
              <Wand2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">
              AI-Generated Description
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              We've analyzed your website and created a description. Feel free to edit it.
            </p>
          </div>

          {/* Description Editor */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 mb-8">
            {/* Tools Bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium">
                    {wordCount} words
                  </span>
                </div>
                <div className={`text-sm ${wordCount > 120 ? 'text-orange-500' : wordCount < 50 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {wordCount > 120 ? 'Too long' : wordCount < 50 ? 'Too short' : 'Perfect length'}
                </div>
              </div>
              
              <button
                onClick={handleRegenerate}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Regenerate
              </button>
            </div>

            {/* Text Area */}
            <AnimatePresence mode="wait">
              {generating ? (
                <motion.div
                  key="generating"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-64 flex items-center justify-center"
                >
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 dark:bg-primary-900/20 rounded-full mb-4">
                      <Sparkles className="w-6 h-6 text-primary-600 animate-pulse" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">AI is crafting your description...</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <textarea
                    value={description}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    className="w-full h-64 px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl
                             bg-gray-50 dark:bg-gray-800 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20
                             transition-all duration-300 resize-none"
                    placeholder="Describe your company, products, and unique value proposition..."
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tips */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Tips for a great description:</h3>
              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Keep it between 50-100 words for optimal AI understanding</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Include your main products, services, or solutions</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Mention what makes you unique in your industry</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Use keywords that your customers would search for</span>
                </li>
              </ul>
            </div>

            {/* Sample Descriptions */}
            <div className="mt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Need inspiration? Here are some examples:</p>
              <div className="grid gap-3">
                <SampleDescription
                  industry="SaaS"
                  text="We provide cloud-based project management software that helps teams collaborate efficiently, track progress in real-time, and deliver projects on schedule. Our AI-powered insights help identify bottlenecks before they impact deadlines."
                  onUse={() => handleDescriptionChange("We provide cloud-based project management software that helps teams collaborate efficiently, track progress in real-time, and deliver projects on schedule. Our AI-powered insights help identify bottlenecks before they impact deadlines.")}
                />
                <SampleDescription
                  industry="E-commerce"
                  text="Our online marketplace connects sustainable brands with conscious consumers. We curate eco-friendly products across fashion, home, and lifestyle categories, ensuring every purchase makes a positive environmental impact."
                  onUse={() => handleDescriptionChange("Our online marketplace connects sustainable brands with conscious consumers. We curate eco-friendly products across fashion, home, and lifestyle categories, ensuring every purchase makes a positive environmental impact.")}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            
            <motion.button
              onClick={handleContinue}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white font-semibold rounded-xl
                       hover:from-primary-700 hover:to-purple-700 transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Continue
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function SampleDescription({ industry, text, onUse }: { industry: string; text: string; onUse: () => void }) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">{industry}</span>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{text}</p>
        </div>
        <button
          onClick={onUse}
          className="px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
        >
          Use this
        </button>
      </div>
    </div>
  );
}
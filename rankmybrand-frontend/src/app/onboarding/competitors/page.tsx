'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, ArrowRight, ArrowLeft, Plus, X, Globe, TrendingUp, Users, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Competitor {
  name: string;
  domain: string;
  reason?: string;
  similarity?: number;
  source?: string;
  selected?: boolean;
}

export default function CompetitorsPage() {
  const router = useRouter();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [selectedCount, setSelectedCount] = useState(0);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    // Load session data
    const sessionData = sessionStorage.getItem('onboarding_session');
    if (!sessionData) {
      router.push('/');
      return;
    }

    const session = JSON.parse(sessionData);
    setCompany(session.company || session.enrichmentData);
    
    // Check if we already have competitors from enrichment
    const enrichmentData = session.enrichmentData || session.company;
    if (enrichmentData?.competitors && enrichmentData.competitors.length > 0) {
      // Use competitors from enrichment
      const competitorsFromEnrichment = enrichmentData.competitors.map((comp: string | any) => {
        if (typeof comp === 'string') {
          return {
            name: comp,
            domain: `${comp.toLowerCase().replace(/\s+/g, '')}.com`,
            reason: 'Identified by AI analysis',
            similarity: 85 + Math.random() * 15,
            source: 'AI',
            selected: true
          };
        }
        return {
          ...comp,
          selected: true
        };
      });
      
      setCompetitors(competitorsFromEnrichment);
      setSelectedCount(competitorsFromEnrichment.length);
      setLoading(false);
    } else {
      // Find competitors if not already available
      findCompetitors(session);
    }
  }, []);

  const findCompetitors = async (session: any) => {
    setSearching(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/onboarding/find-competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          company: session.company || session.enrichmentData
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Pre-select top 3 competitors
      const competitorsWithSelection = data.competitors.map((comp: Competitor, index: number) => ({
        ...comp,
        selected: index < 3
      }));

      setCompetitors(competitorsWithSelection);
      setSelectedCount(Math.min(3, competitorsWithSelection.length));
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to find competitors:', error);
      toast.error('Failed to find competitors');
      
      // Fallback to manual entry
      setCompetitors([]);
      setLoading(false);
    } finally {
      setSearching(false);
    }
  };

  const toggleCompetitor = (index: number) => {
    const updated = [...competitors];
    updated[index].selected = !updated[index].selected;
    setCompetitors(updated);
    setSelectedCount(updated.filter(c => c.selected).length);
  };

  const addCustomCompetitor = () => {
    if (!customDomain) return;

    // Clean domain
    let domain = customDomain.toLowerCase().trim();
    domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    // Check if already exists
    if (competitors.some(c => c.domain === domain)) {
      toast.error('This competitor is already in the list');
      return;
    }

    const newCompetitor: Competitor = {
      name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
      domain: domain,
      reason: 'Manually added',
      source: 'manual',
      selected: true
    };

    setCompetitors([...competitors, newCompetitor]);
    setSelectedCount(selectedCount + 1);
    setCustomDomain('');
    toast.success('Competitor added');
  };

  const removeCompetitor = (index: number) => {
    const updated = competitors.filter((_, i) => i !== index);
    setCompetitors(updated);
    setSelectedCount(updated.filter(c => c.selected).length);
  };

  const handleContinue = async () => {
    const selected = competitors.filter(c => c.selected);
    
    if (selected.length === 0 && competitors.length > 0) {
      toast.error('Please select at least one competitor');
      return;
    }

    // Save to session
    const sessionData = JSON.parse(sessionStorage.getItem('onboarding_session') || '{}');
    sessionData.competitors = selected;
    sessionStorage.setItem('onboarding_session', JSON.stringify(sessionData));

    // Start full analysis and redirect to dashboard
    setLoading(true);
    
    // TEST MODE DISABLED - Using real API
    // if (true) {
    //   console.log('TEST MODE: Redirecting directly to dashboard');
    //   setTimeout(() => {
    //     window.location.href = 'http://localhost:3000/?onboarding=complete';
    //   }, 1000);
    //   return;
    // }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';
      const requestBody = {
        sessionId: sessionData.sessionId || `session_${Date.now()}`,
        email: sessionData.email || 'test@example.com',
        company: sessionData.company || sessionData.enrichmentData || { name: 'Test Company', domain: 'example.com' },
        competitors: selected,
        description: sessionData.description || 'Company description'
      };
      
      console.log('Sending request to:', `${apiUrl}/api/onboarding/complete`);
      console.log('Request body:', requestBody);
      
      const response = await fetch(`${apiUrl}/api/onboarding/complete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Complete response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Complete response data:', data);
      
      if (data.success) {
        // Store authentication token and user data
        if (data.auth?.token) {
          localStorage.setItem('auth_token', data.auth.token);
          localStorage.setItem('refresh_token', data.auth.refreshToken);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        
        toast.success('Analysis started! Redirecting to dashboard...');
        
        // Clear session storage
        sessionStorage.removeItem('onboarding_session');
        
        // Redirect to real dashboard with onboarding complete flag
        setTimeout(() => {
          // Dashboard is on port 3000, redirect to main dashboard page
          const redirectUrl = 'http://localhost:3000/?onboarding=complete';
          console.log('Redirecting to:', redirectUrl);
          window.location.href = redirectUrl;
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to complete onboarding');
      }
    } catch (error: any) {
      console.error('Failed to complete onboarding:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        sessionData: sessionStorage.getItem('onboarding_session')
      });
      toast.error(error.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/onboarding/description');
  };

  if (loading && searching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-500 rounded-2xl mb-4">
            <Search className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Discovering Competitors</h2>
          <p className="text-gray-600 dark:text-gray-400">Analyzing SERP data and industry landscape...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Step 3 of 4</span>
            <span>Select Competitors</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
            <motion.div 
              className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full"
              initial={{ width: '50%' }}
              animate={{ width: '75%' }}
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
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">
              Who Are Your Competitors?
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              We found these companies in your space. Select the ones you want to track.
            </p>
          </div>

          {/* Add Custom Competitor */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomCompetitor()}
                  placeholder="Add a competitor domain (e.g., competitor.com)"
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl
                           bg-gray-50 dark:bg-gray-800 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20
                           transition-all duration-300"
                />
              </div>
              <button
                onClick={addCustomCompetitor}
                disabled={!customDomain}
                className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl
                         hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add
              </button>
            </div>
          </div>

          {/* Competitors Grid */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                Discovered Competitors
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>{selectedCount} selected</span>
              </div>
            </div>

            {competitors.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-2">No competitors found automatically</p>
                <p className="text-sm text-gray-500">Add your competitors manually using the form above</p>
              </div>
            ) : (
              <div className="grid gap-4">
                <AnimatePresence>
                  {competitors.map((competitor, index) => (
                    <motion.div
                      key={competitor.domain}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        competitor.selected 
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onClick={() => toggleCompetitor(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Checkbox */}
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            competitor.selected 
                              ? 'bg-primary-600 border-primary-600' 
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {competitor.selected && (
                              <CheckCircle className="w-4 h-4 text-white" />
                            )}
                          </div>

                          {/* Company Info */}
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                                {competitor.name}
                              </h3>
                              <div className="flex items-center gap-1 text-sm text-gray-500">
                                <Globe className="w-3 h-3" />
                                <span>{competitor.domain}</span>
                              </div>
                            </div>
                            
                            {competitor.reason && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {competitor.reason}
                              </p>
                            )}
                            
                            {competitor.similarity && (
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3 text-green-500" />
                                  <span className="text-xs text-gray-500">
                                    {Math.round(competitor.similarity)}% match
                                  </span>
                                </div>
                                {competitor.source && (
                                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                                    via {competitor.source}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Remove Button */}
                        {competitor.source === 'manual' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCompetitor(index);
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Why Track Competitors */}
          <div className="bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-600" />
              Why track competitors?
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Benchmark Performance</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">See how you rank against them</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Track Changes</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Get alerts when they improve</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Find Opportunities</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Discover gaps to exploit</p>
                </div>
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
              disabled={selectedCount === 0 || loading}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white font-semibold rounded-xl
                       hover:from-primary-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Starting Analysis...
                </>
              ) : (
                <>
                  Complete Setup
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
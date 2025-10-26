'use client';

/**
 * Company Details Page - Authentic AI Onboarding
 * [51:Microcopy] Honest, specific copy without hype
 * [43:Keyboard navigation] Fully keyboard accessible
 * [13:Doherty] Optimistic UI for instant feedback
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Globe, Users, MapPin, Tag, Loader2, Edit2, Check, ArrowRight, X, Sparkles, ShoppingCart, Briefcase, GitMerge, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CompanyData {
  name: string;
  domain: string;
  industry?: string;
  size?: string;
  employeeCount?: number;
  logo?: string;
  description?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
  tags?: string[];
  techStack?: string[];
  products_services?: string[];
  enrichmentSource: string;
  confidence: number;
  userEdited?: boolean;
  originalName?: string;
  originalDescription?: string;
  originalIndustry?: string;

  // Business Model Classification (NEW)
  business_model?: 'B2C' | 'B2B' | 'B2B2C';
  customer_type?: {
    primary: 'individual_consumers' | 'small_businesses' | 'enterprises' | 'developers' | 'mixed';
    description: string;
  };
  transaction_type?: 'product_purchase' | 'service_subscription' | 'software_license' | 'marketplace';
}

export default function CompanyDetailsPage() {
  const router = useRouter();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [stepStartTime] = useState(Date.now());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Load session data - if not found, create from localStorage domain
    let sessionData = sessionStorage.getItem('onboarding_session');
    
    if (!sessionData) {
      // Try to recover from localStorage
      const domain = localStorage.getItem('onboarding_domain');
      if (domain) {
        // Extract company name from domain/email
        let companyName = domain;
        if (domain.includes('@')) {
          companyName = domain.split('@')[1];
        }
        companyName = companyName
          .replace(/\.(com|org|net|io|ai|co|dev|app|tech)$/i, '')
          .replace(/^www\./i, '')
          .replace(/[-_]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        // Create session from domain with better defaults
        const newSession = {
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          domain: domain,
          enrichmentData: {
            name: companyName,
            domain: domain.includes('@') ? domain.split('@')[1] : domain,
            industry: 'Technology',
            description: `${companyName} is a technology company focused on innovation.`,
            size: '10-50 employees',
            location: { city: 'San Francisco', state: 'CA', country: 'USA' },
            techStack: ['React', 'Node.js', 'TypeScript'],
            confidence: 0.6,
            enrichmentSource: 'recovered'
          },
          startedAt: new Date().toISOString()
        };
        sessionStorage.setItem('onboarding_session', JSON.stringify(newSession));
        sessionData = JSON.stringify(newSession);
      } else {
        // No domain found, redirect to home
        router.push('/');
        return;
      }
    }

    const session = JSON.parse(sessionData);
    setSessionId(session.sessionId);
    
    // Check if we have edited company data or use enrichment data
    const companyData = session.company || session.enrichmentData;
    
    // Store original values for tracking
    if (!companyData.originalName) {
      companyData.originalName = companyData.name;
    }
    if (!companyData.originalDescription) {
      companyData.originalDescription = companyData.description;
    }
    if (!companyData.originalIndustry) {
      companyData.originalIndustry = companyData.industry;
    }
    
    // Use the enriched data directly - don't override with defaults
    const enrichedData = {
      ...companyData,
      // Only add defaults for truly missing fields
      description: companyData.description,
      location: companyData.location,
      size: companyData.size,
      employeeCount: companyData.employeeCount,
      techStack: companyData.techStack,
      products_services: companyData.products_services,
      socialProfiles: companyData.socialProfiles,
      tags: companyData.tags,
      competitors: companyData.competitors,
      yearFounded: companyData.yearFounded,
      logo: companyData.logo,
      confidence: companyData.confidence || 0.85
    };
    
    setCompany(enrichedData);
    setLoading(false);

    // Disable WebSocket for now as it might cause issues
    // startCrawlMonitoring(session.sessionId);
    
    // Track time spent on this step
    const startTime = Date.now();
    return () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      console.log(`Time spent on company step: ${timeSpent}s`);
      wsRef.current?.close();
    };
  }, [router]);

  const startCrawlMonitoring = useCallback((sessionId: string) => {
    // Connect to WebSocket for real-time updates
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000'}/ws/onboarding/${sessionId}`);
    wsRef.current = ws;
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'crawl_progress') {
        // Update progress indicator
        console.log('Crawl progress:', data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, []);

  const handleFieldEdit = useCallback(async (field: string, value: any) => {
    if (!company) return;
    
    // [13:Doherty] Optimistic update for instant feedback
    const oldValue = field.includes('.') 
      ? (company as any)[field.split('.')[0]]?.[field.split('.')[1]]
      : (company as any)[field];
    
    const updatedCompany = { ...company };
    
    // Handle nested fields
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      (updatedCompany as any)[parent] = {
        ...(updatedCompany as any)[parent],
        [child]: value
      };
    } else {
      (updatedCompany as any)[field] = value;
    }
    
    // Mark company as user-edited
    updatedCompany.userEdited = true;
    
    // Store original values if not already stored
    if (!updatedCompany.originalName && field === 'name') {
      updatedCompany.originalName = oldValue;
    }
    if (!updatedCompany.originalDescription && field === 'description') {
      updatedCompany.originalDescription = oldValue;
    }
    if (!updatedCompany.originalIndustry && field === 'industry') {
      updatedCompany.originalIndustry = oldValue;
    }
    
    setCompany(updatedCompany);
    
    // Track the edit in backend (fire and forget)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/onboarding/track-field-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          field,
          oldValue,
          newValue: value,
          step: 'company_details'
        })
      });
    } catch (error) {
      console.error('Failed to track edit:', error);
    }
  }, [company, sessionId]);

  const handleContinue = async () => {
    setSaving(true);

    // Track time spent on this step
    const timeSpent = Date.now() - stepStartTime;

    try {
      // Generate description with the edited company data
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/onboarding/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          company,
          userEditedCompany: company?.userEdited ? company : null,
          crawledPages: []
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate description');
      }

      const data = await response.json();

      // Save company data to session
      const sessionData = JSON.parse(sessionStorage.getItem('onboarding_session') || '{}');
      sessionData.company = company;
      sessionData.description = data.description;
      sessionData.userEditedCompany = company?.userEdited;
      sessionData.enrichmentData = company;
      sessionStorage.setItem('onboarding_session', JSON.stringify(sessionData));

      // Navigate to description page
      router.push('/onboarding/description');
    } catch (error) {
      console.error('Failed to continue:', error);
      toast.error('Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {/* Professional loading state */}
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4">
            <Sparkles className="w-full h-full text-neutral-600 dark:text-neutral-400 animate-pulse" />
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">Analyzing your company...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600 dark:text-neutral-400">No company data found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 md:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Professional progress bar */}
        <nav aria-label="Progress" className="mb-8">
          <div className="flex items-center justify-between text-sm text-neutral-700 dark:text-neutral-300 mb-2">
            <span className="section-header">Step <span className="font-mono tabular-nums">1</span> of <span className="font-mono tabular-nums">3</span></span>
            <span className="font-semibold">Company Details</span>
          </div>
          <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-900 dark:bg-neutral-0 rounded-full transition-all duration-500"
              style={{ width: '33%' }}
              role="progressbar"
              aria-valuenow={33}
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
          {/* Professional header */}
          <header className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-neutral-900 dark:text-neutral-0">
              Review Your Company Details
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
              We've gathered information about your company. Please review and correct any details to help us provide accurate AI visibility insights.
            </p>
          </header>

          {/* Company Card - [11:Aesthetic-Usability] Clean, modern design */}
          <article className="glass rounded-2xl p-6 md:p-8 mb-8">
            {/* Logo and Name - [14:Visual hierarchy] Primary information first */}
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mb-8">
              {company.logo ? (
                <img 
                  src={company.logo} 
                  alt=""
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-neutral-900 dark:bg-neutral-0 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-white dark:text-neutral-900" />
                </div>
              )}
              
              <div className="flex-1 w-full">
                <EditableField
                  value={company.name}
                  field="name"
                  label="Company Name"
                  editing={editingField === 'name'}
                  onEdit={() => setEditingField('name')}
                  onSave={(value) => {
                    handleFieldEdit('name', value);
                    setEditingField(null);
                  }}
                  onCancel={() => setEditingField(null)}
                  className="text-2xl sm:text-3xl font-bold"
                  inputClassName="text-2xl sm:text-3xl font-bold"
                />
                
                <div className="flex items-center gap-2 mt-2 text-neutral-600 dark:text-neutral-400">
                  <Globe className="w-4 h-4" aria-hidden="true" />
                  <span>{company.domain}</span>
                </div>
              </div>
            </div>

            {/* Company Description */}
            {company.description && (
              <div className="mb-8 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {company.description}
                </p>
              </div>
            )}

            {/* Professional business model section */}
            <div className="mb-8 p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border-2 border-neutral-200 dark:border-neutral-700">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1 flex items-center gap-2 text-neutral-900 dark:text-neutral-0">
                    <Sparkles className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                    Business Model
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    This determines what type of queries we'll track for your AI visibility
                  </p>
                </div>
              </div>

              {/* Business Model Selector - Custom Dropdown */}
              <div className="mb-4" ref={dropdownRef}>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">
                  Who are your customers?
                </label>
                <div className="relative">
                  {/* Dropdown Button */}
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-full px-4 py-3 border-2 border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-0 focus:border-transparent text-base transition-all hover:border-neutral-400 dark:hover:border-neutral-600 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      {company.business_model === 'B2C' && <ShoppingCart className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />}
                      {company.business_model === 'B2B' && <Briefcase className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />}
                      {company.business_model === 'B2B2C' && <GitMerge className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />}
                      <div className="text-left">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-0">
                          {company.business_model || 'B2B'}
                        </span>
                        <span className="text-neutral-600 dark:text-neutral-400 ml-2">
                          {company.business_model === 'B2C' && '— Individual consumers, shoppers, families'}
                          {company.business_model === 'B2B' && '— Businesses and enterprises'}
                          {company.business_model === 'B2B2C' && '— Businesses serving consumers'}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-10 w-full mt-2 bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl overflow-hidden"
                      >
                        {/* B2C Option */}
                        <button
                          type="button"
                          onClick={() => {
                            handleFieldEdit('business_model', 'B2C');
                            setDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                            company.business_model === 'B2C' ? 'bg-neutral-50 dark:bg-neutral-800' : ''
                          }`}
                        >
                          <ShoppingCart className="w-5 h-5 text-neutral-600 dark:text-neutral-400 flex-shrink-0" />
                          <div>
                            <div className="font-semibold text-neutral-900 dark:text-neutral-0">B2C</div>
                            <div className="text-sm text-neutral-600 dark:text-neutral-400">Individual consumers, shoppers, families</div>
                          </div>
                          {company.business_model === 'B2C' && (
                            <Check className="w-5 h-5 text-neutral-900 dark:text-neutral-0 ml-auto" />
                          )}
                        </button>

                        {/* B2B Option */}
                        <button
                          type="button"
                          onClick={() => {
                            handleFieldEdit('business_model', 'B2B');
                            setDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 ${
                            company.business_model === 'B2B' ? 'bg-neutral-50 dark:bg-neutral-800' : ''
                          }`}
                        >
                          <Briefcase className="w-5 h-5 text-neutral-600 dark:text-neutral-400 flex-shrink-0" />
                          <div>
                            <div className="font-semibold text-neutral-900 dark:text-neutral-0">B2B</div>
                            <div className="text-sm text-neutral-600 dark:text-neutral-400">Businesses and enterprises</div>
                          </div>
                          {company.business_model === 'B2B' && (
                            <Check className="w-5 h-5 text-neutral-900 dark:text-neutral-0 ml-auto" />
                          )}
                        </button>

                        {/* B2B2C Option */}
                        <button
                          type="button"
                          onClick={() => {
                            handleFieldEdit('business_model', 'B2B2C');
                            setDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 ${
                            company.business_model === 'B2B2C' ? 'bg-neutral-50 dark:bg-neutral-800' : ''
                          }`}
                        >
                          <GitMerge className="w-5 h-5 text-neutral-600 dark:text-neutral-400 flex-shrink-0" />
                          <div>
                            <div className="font-semibold text-neutral-900 dark:text-neutral-0">B2B2C</div>
                            <div className="text-sm text-neutral-600 dark:text-neutral-400">Businesses serving consumers (e.g., Shopify, Stripe)</div>
                          </div>
                          {company.business_model === 'B2B2C' && (
                            <Check className="w-5 h-5 text-neutral-900 dark:text-neutral-0 ml-auto" />
                          )}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Business Model Explanation */}
              <div className="p-4 bg-white dark:bg-neutral-900/50 rounded-lg">
                {company.business_model === 'B2C' && (
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-0 mb-2 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      Consumer Shopping Queries
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                      {company.customer_type?.description || "Your customers are individual people shopping for products or services."}
                    </p>
                    <div className="text-sm">
                      <p className="text-neutral-500 dark:text-neutral-400 mb-2">Example queries we'll track:</p>
                      <ul className="space-y-1 text-neutral-700 dark:text-neutral-300">
                        <li>• "best {(() => {
                          const product = company.products_services?.[0];
                          return (typeof product === 'string' ? product : product?.name) || company.industry || 'products';
                        })()} for consumers"</li>
                        <li>• "where to buy {company.name} products"</li>
                        <li>• "{company.name} reviews 2025"</li>
                        <li>• "{company.name} near me"</li>
                      </ul>
                    </div>
                  </div>
                )}

                {company.business_model === 'B2B' && (
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-0 mb-2 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Enterprise & Business Queries
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                      {company.customer_type?.description || "Your customers are businesses, enterprises, or developers."}
                    </p>
                    <div className="text-sm">
                      <p className="text-neutral-500 dark:text-neutral-400 mb-2">Example queries we'll track:</p>
                      <ul className="space-y-1 text-neutral-700 dark:text-neutral-300">
                        <li>• "best {company.industry || 'enterprise'} platform for businesses"</li>
                        <li>• "{company.name} API documentation"</li>
                        <li>• "{company.name} vs competitors comparison"</li>
                        <li>• "{company.name} enterprise pricing"</li>
                      </ul>
                    </div>
                  </div>
                )}

                {company.business_model === 'B2B2C' && (
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-0 mb-2 flex items-center gap-2">
                      <GitMerge className="w-4 h-4" />
                      Hybrid Business & Consumer Queries
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                      {company.customer_type?.description || "You sell to businesses who then serve end consumers."}
                    </p>
                    <div className="text-sm">
                      <p className="text-neutral-500 dark:text-neutral-400 mb-2">Example queries we'll track:</p>
                      <ul className="space-y-1 text-neutral-700 dark:text-neutral-300">
                        <li>• "platform to sell products online" (B2C-influenced)</li>
                        <li>• "{company.name} for small businesses"</li>
                        <li>• "{company.name} merchant API"</li>
                        <li>• "how to start online store with {company.name}"</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Warning if LLM confidence is low - semantic color */}
              {company.confidence < 0.7 && (
                <div className="mt-4 p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                  <p className="text-sm text-warning-800 dark:text-warning-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>We're not <span className="font-mono tabular-nums">100%</span> sure about this classification. Please verify it's correct for your business.</span>
                  </p>
                </div>
              )}
            </div>

            {/* Company Info Grid - [66:Mobile-first] Responsive layout */}
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Industry */}
              <div>
                <label className="text-sm text-neutral-500 dark:text-neutral-400 mb-1 block">
                  Industry
                </label>
                <EditableField
                  value={company.industry || 'Not specified'}
                  field="industry"
                  editing={editingField === 'industry'}
                  onEdit={() => setEditingField('industry')}
                  onSave={(value) => {
                    handleFieldEdit('industry', value);
                    setEditingField(null);
                  }}
                  onCancel={() => setEditingField(null)}
                  icon={<Tag className="w-4 h-4" />}
                />
              </div>

              {/* Company Size */}
              <div>
                <label className="text-sm text-neutral-500 dark:text-neutral-400 mb-1 block">
                  Company Size
                </label>
                <EditableField
                  value={company.size || company.employeeCount?.toString() || 'Not specified'}
                  field="size"
                  editing={editingField === 'size'}
                  onEdit={() => setEditingField('size')}
                  onSave={(value) => {
                    handleFieldEdit('size', value);
                    setEditingField(null);
                  }}
                  onCancel={() => setEditingField(null)}
                  icon={<Users className="w-4 h-4" />}
                />
              </div>

              {/* Location */}
              <div>
                <label className="text-sm text-neutral-500 dark:text-neutral-400 mb-1 block">
                  Location
                </label>
                <EditableField
                  value={
                    company.location
                      ? `${company.location.city || ''}${company.location.state ? ', ' + company.location.state : ''}${company.location.country ? ', ' + company.location.country : ''}`
                      : 'Not specified'
                  }
                  field="location"
                  editing={editingField === 'location'}
                  onEdit={() => setEditingField('location')}
                  onSave={(value) => {
                    const parts = value.split(',').map(p => p.trim());
                    handleFieldEdit('location', {
                      city: parts[0] || '',
                      state: parts[1] || '',
                      country: parts[2] || ''
                    });
                    setEditingField(null);
                  }}
                  onCancel={() => setEditingField(null)}
                  icon={<MapPin className="w-4 h-4" />}
                />
              </div>

              {/* Products & Services */}
              <div className="sm:col-span-2">
                <label className="text-sm text-neutral-500 dark:text-neutral-400 mb-1 block">
                  Products & Services
                </label>
                <div className="flex flex-wrap gap-2">
                  {company.products_services && company.products_services.length > 0 ? (
                    company.products_services.map((product, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-0 rounded-full text-sm font-medium"
                      >
                        {typeof product === 'string' ? product : product.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-neutral-500">Not specified</span>
                  )}
                </div>
              </div>
            </div>

            {/* Professional data source indicator */}
            <div className="mt-6 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 pt-4">
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <div
                  className={`w-2 h-2 rounded-full ${
                    company.confidence > 0.8 ? 'bg-success-600' :
                    company.confidence > 0.5 ? 'bg-warning-600' : 'bg-danger-600'
                  }`}
                  aria-hidden="true"
                />
                <span>
                  Data confidence: <span className="font-mono tabular-nums font-semibold">{Math.round(company.confidence * 100)}%</span>
                </span>
              </div>
              {company.userEdited && (
                <span className="text-sm text-neutral-900 dark:text-neutral-0 font-medium flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  User verified
                </span>
              )}
            </div>
          </article>

          {/* Actions - [52:CTA] Clear primary action */}
          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              leftIcon={<ArrowRight className="w-5 h-5 rotate-180" />}
              aria-label="Go back to home"
            >
              Back
            </Button>

            <Button
              onClick={handleContinue}
              disabled={!!editingField}
              loading={saving}
              rightIcon={!saving ? <ArrowRight className="w-5 h-5" /> : undefined}
              size="lg"
              aria-label="Continue to next step"
            >
              {saving ? 'Processing...' : 'Continue'}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

interface EditableFieldProps {
  value: string;
  field: string;
  label?: string;
  editing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  icon?: React.ReactNode;
  className?: string;
  inputClassName?: string;
}

function EditableField({ 
  value, 
  editing, 
  onEdit, 
  onSave, 
  onCancel,
  icon, 
  className = '',
  inputClassName = ''
}: EditableFieldProps) {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // [43:Keyboard navigation] Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(editValue);
    } else if (e.key === 'Escape') {
      setEditValue(value);
      onCancel();
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={inputClassName}
          variant="success"
          aria-label="Edit value"
        />
        <Button
          size="icon"
          onClick={() => onSave(editValue)}
          className="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
          variant="ghost"
          aria-label="Save changes"
        >
          <Check className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          onClick={() => {
            setEditValue(value);
            onCancel();
          }}
          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          variant="ghost"
          aria-label="Cancel editing"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={onEdit}
      className={`flex items-center gap-2 group w-full text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-lg px-3 py-2 transition-colors ${className}`}
      aria-label={`Edit ${value}`}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span className="flex-1">{value}</span>
      <Edit2
        className="w-4 h-4 opacity-0 group-hover:opacity-100 text-neutral-400 transition-opacity"
        aria-hidden="true"
      />
    </button>
  );
}
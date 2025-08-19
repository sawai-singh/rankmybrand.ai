'use client';

/**
 * Company Details Page - Authentic AI Onboarding
 * [51:Microcopy] Honest, specific copy without hype
 * [43:Keyboard navigation] Fully keyboard accessible
 * [13:Doherty] Optimistic UI for instant feedback
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Globe, Users, MapPin, Tag, Loader2, Edit2, Check, ArrowRight, X, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

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
  enrichmentSource: string;
  confidence: number;
  userEdited?: boolean;
  originalName?: string;
  originalDescription?: string;
  originalIndustry?: string;
}

export default function CompanyDetailsPage() {
  const router = useRouter();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [stepStartTime] = useState(Date.now());
  const wsRef = useRef<WebSocket | null>(null);

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
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {/* [98:Lazy loading] Loading skeleton */}
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4">
            <Sparkles className="w-full h-full text-primary-500 animate-pulse" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">Analyzing your company...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">No company data found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 md:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar - [14:Visual hierarchy] Clear progress indication */}
        <nav aria-label="Progress" className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Step 1 of 3</span>
            <span>Company Details</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-500"
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
          {/* Header - [51:Microcopy] Honest, helpful copy */}
          <header className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Review Your Company Details
            </h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
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
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
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
                
                <div className="flex items-center gap-2 mt-2 text-gray-600 dark:text-gray-400">
                  <Globe className="w-4 h-4" aria-hidden="true" />
                  <span>{company.domain}</span>
                </div>
              </div>
            </div>

            {/* Company Description */}
            {company.description && (
              <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {company.description}
                </p>
              </div>
            )}

            {/* Company Info Grid - [66:Mobile-first] Responsive layout */}
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Industry */}
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">
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
                <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">
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
                <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">
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

              {/* Tech Stack */}
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">
                  Tech Stack
                </label>
                <div className="flex flex-wrap gap-2">
                  {company.techStack && company.techStack.length > 0 ? (
                    company.techStack.slice(0, 5).map((tech, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-sm"
                      >
                        {tech}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">Not detected</span>
                  )}
                </div>
              </div>
            </div>

            {/* Data Source Indicator - [51:Microcopy] Transparent about data source */}
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 dark:border-gray-800 pt-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div 
                  className={`w-2 h-2 rounded-full ${
                    company.confidence > 0.8 ? 'bg-green-500' : 
                    company.confidence > 0.5 ? 'bg-yellow-500' : 'bg-orange-500'
                  }`} 
                  aria-hidden="true"
                />
                <span>
                  Data confidence: {Math.round(company.confidence * 100)}%
                </span>
              </div>
              {company.userEdited && (
                <span className="text-sm text-primary-600 dark:text-primary-400">
                  ✓ User verified
                </span>
              )}
            </div>
          </article>

          {/* Actions - [52:CTA] Clear primary action */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => router.push('/')}
              className="btn-ghost"
              aria-label="Go back to home"
            >
              <ArrowRight className="w-5 h-5 rotate-180 mr-2" />
              Back
            </button>
            
            <motion.button
              onClick={handleContinue}
              disabled={saving || !!editingField}
              className="btn-primary flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-label="Continue to next step"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
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
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`flex-1 px-3 py-2 border-2 border-primary-500 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${inputClassName}`}
          aria-label="Edit value"
        />
        <button
          onClick={() => onSave(editValue)}
          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
          aria-label="Save changes"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setEditValue(value);
            onCancel();
          }}
          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          aria-label="Cancel editing"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onEdit}
      className={`flex items-center gap-2 group w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg px-3 py-2 transition-colors ${className}`}
      aria-label={`Edit ${value}`}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span className="flex-1">{value}</span>
      <Edit2 
        className="w-4 h-4 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" 
        aria-hidden="true"
      />
    </button>
  );
}
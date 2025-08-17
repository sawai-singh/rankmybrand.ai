'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Globe, Users, MapPin, Tag, Loader2, Edit2, Check, ArrowRight } from 'lucide-react';
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
}

export default function CompanyDetailsPage() {
  const router = useRouter();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [stepStartTime] = useState(Date.now());

  useEffect(() => {
    // Load session data
    const sessionData = sessionStorage.getItem('onboarding_session');
    if (!sessionData) {
      router.push('/');
      return;
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
    
    setCompany(companyData);
    setLoading(false);

    // Start background crawl progress monitoring
    startCrawlMonitoring(session.sessionId);
    
    // Track time spent on this step
    const startTime = Date.now();
    return () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      // You could send this to backend here
      console.log(`Time spent on company step: ${timeSpent}s`);
    };
  }, []);

  const startCrawlMonitoring = (sessionId: string) => {
    // Connect to WebSocket for real-time updates
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000'}/ws/onboarding/${sessionId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'crawl_progress') {
        // Update progress indicator
        console.log('Crawl progress:', data);
      }
    };

    return () => ws.close();
  };

  const handleFieldEdit = async (field: string, value: any) => {
    if (!company) return;
    
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
    
    // Track the edit in backend
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
  };

  const handleContinue = async () => {
    setSaving(true);
    
    // Track time spent on this step
    const timeSpent = Date.now() - stepStartTime;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/onboarding/track-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          fromStep: 'company',
          toStep: 'description',
          timeSpent
        })
      });
    } catch (error) {
      console.error('Failed to track step time:', error);
    }
    
    try {
      // Generate description with the edited company data
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/onboarding/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          company,
          userEditedCompany: company.userEdited ? company : null,
          crawledPages: [] // This would come from the crawl monitoring
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
      sessionData.userEditedCompany = company.userEdited;
      // Also preserve enrichmentData
      sessionData.enrichmentData = company;
      sessionStorage.setItem('onboarding_session', JSON.stringify(sessionData));
      
      // Navigate to description page
      router.push('/onboarding/description');
    } catch (error) {
      console.error('Failed to continue:', error);
      toast.error('Failed to generate description');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading company details...</p>
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
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Step 1 of 4</span>
            <span>Company Details</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div className="h-full w-1/4 bg-gradient-to-r from-primary-500 to-purple-500 rounded-full" />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">
              Confirm Your Company Details
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              We found your company! Review and edit the details below if needed.
            </p>
          </div>

          {/* Company Card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 mb-8">
            {/* Logo and Name */}
            <div className="flex items-center gap-6 mb-8">
              {company.logo ? (
                <img 
                  src={company.logo} 
                  alt={company.name}
                  className="w-20 h-20 rounded-xl object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
                  <Building2 className="w-10 h-10 text-white" />
                </div>
              )}
              
              <div className="flex-1">
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
                  className="text-3xl font-bold"
                />
                
                <div className="flex items-center gap-2 mt-2 text-gray-600 dark:text-gray-400">
                  <Globe className="w-4 h-4" />
                  <span>{company.domain}</span>
                </div>
              </div>
            </div>

            {/* Company Info Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Industry */}
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">Industry</label>
                <EditableField
                  value={company.industry || 'Not specified'}
                  field="industry"
                  editing={editingField === 'industry'}
                  onEdit={() => setEditingField('industry')}
                  onSave={(value) => {
                    handleFieldEdit('industry', value);
                    setEditingField(null);
                  }}
                  icon={<Tag className="w-4 h-4" />}
                />
              </div>

              {/* Company Size */}
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">Company Size</label>
                <EditableField
                  value={company.size || company.employeeCount?.toString() || 'Not specified'}
                  field="size"
                  editing={editingField === 'size'}
                  onEdit={() => setEditingField('size')}
                  onSave={(value) => {
                    handleFieldEdit('size', value);
                    setEditingField(null);
                  }}
                  icon={<Users className="w-4 h-4" />}
                />
              </div>

              {/* Location */}
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">Location</label>
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
                    // Parse location string back to object
                    const parts = value.split(',').map(p => p.trim());
                    handleFieldEdit('location', {
                      city: parts[0] || '',
                      state: parts[1] || '',
                      country: parts[2] || ''
                    });
                    setEditingField(null);
                  }}
                  icon={<MapPin className="w-4 h-4" />}
                />
              </div>

              {/* Tech Stack */}
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">Tech Stack</label>
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

            {/* Description */}
            {company.description && (
              <div className="mt-6">
                <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">Current Description</label>
                <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  {company.description}
                </p>
              </div>
            )}

            {/* Data Source Indicator */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className={`w-2 h-2 rounded-full ${company.confidence > 0.8 ? 'bg-green-500' : company.confidence > 0.5 ? 'bg-yellow-500' : 'bg-orange-500'}`} />
                <span>
                  Data from {company.enrichmentSource} 
                  ({Math.round(company.confidence * 100)}% confidence)
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Back
            </button>
            
            <motion.button
              onClick={handleContinue}
              disabled={saving}
              className="px-8 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white font-semibold rounded-xl
                       hover:from-primary-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-300 flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
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
  icon?: React.ReactNode;
  className?: string;
}

function EditableField({ value, editing, onEdit, onSave, icon, className = '' }: EditableFieldProps) {
  const [editValue, setEditValue] = useState(value);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="flex-1 px-3 py-2 border border-primary-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          autoFocus
        />
        <button
          onClick={() => onSave(editValue)}
          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 group ${className}`}>
      {icon}
      <span className="flex-1">{value}</span>
      <button
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary-600 transition-all"
      >
        <Edit2 className="w-4 h-4" />
      </button>
    </div>
  );
}
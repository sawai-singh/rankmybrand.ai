'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { CategoryInsightsResponse, CategoryInsights, CategoryInsight, BuyerJourneyPhase, PHASE_METADATA } from '@/types/strategic-intelligence';

interface CategoryInsightsGridProps {
  auditId: string;
  isLoading?: boolean;
}

// 5-Phase Buyer Journey Framework
// Strategic weighting: Comparison (29%) > Evaluation (24%) > Research (19%) > Discovery (14%) = Purchase (14%)
const PHASE_INFO: Record<string, { label: string; color: string; description: string; weight: string; badge?: string }> = {
  discovery: {
    label: 'Discovery',
    color: 'blue',
    description: 'Users identifying pain points and recognizing problems (14% strategic weight)',
    weight: '14%'
  },
  research: {
    label: 'Research',
    color: 'purple',
    description: 'Exploring solution landscape and category options (19% strategic weight)',
    weight: '19%'
  },
  evaluation: {
    label: 'Evaluation',
    color: 'green',
    description: 'Investigating your brand and specific capabilities (24% strategic weight)',
    weight: '24%'
  },
  comparison: {
    label: 'Comparison',
    color: 'orange',
    description: 'Head-to-head competitive comparison - 60-70% of B2B deals won/lost here (29% strategic weight)',
    weight: '29%',
    badge: 'CRITICAL'
  },
  purchase: {
    label: 'Purchase',
    color: 'red',
    description: 'Ready to buy, seeking final validation and conversion signals (14% strategic weight)',
    weight: '14%'
  },
};

export function CategoryInsightsGrid({ auditId, isLoading: externalLoading }: CategoryInsightsGridProps) {
  const [data, setData] = useState<CategoryInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'competitive_gaps' | 'content_opportunities'>('recommendations');

  useEffect(() => {
    if (!auditId) return;

    const fetchCategoryInsights = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await api.getCategoryInsights(auditId);
        setData(result);
        // Auto-select first category with data
        if (result.categories) {
          const firstCategory = Object.keys(result.categories)[0];
          if (firstCategory) setSelectedCategory(firstCategory);
        }
      } catch (err: any) {
        console.error('Error fetching category insights:', err);
        setError(err.message || 'Failed to load category insights');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategoryInsights();
  }, [auditId]);

  if (externalLoading || isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data || !data.categories) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <p className="text-gray-600 text-center">{error || 'Category insights not available yet.'}</p>
      </div>
    );
  }

  const { categories } = data;
  const categoryKeys = Object.keys(categories);
  const selectedInsights: CategoryInsights | null = selectedCategory ? categories[selectedCategory] : null;

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-700 border-blue-300',
      purple: 'bg-purple-100 text-purple-700 border-purple-300',
      green: 'bg-green-100 text-green-700 border-green-300',
      orange: 'bg-orange-100 text-orange-700 border-orange-300 font-semibold', // CRITICAL phase
      red: 'bg-red-100 text-red-700 border-red-300',
    };
    return colors[color as keyof typeof colors] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const renderInsightCard = (insight: CategoryInsight, index: number) => (
    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-gray-900 text-sm flex-1">{insight.title}</h4>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          insight.priority === 'high' ? 'bg-red-100 text-red-700' :
          insight.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
          'bg-green-100 text-green-700'
        }`}>
          {insight.priority}
        </span>
      </div>

      <p className="text-gray-600 text-xs mb-3 leading-relaxed">{insight.rationale}</p>

      <div className="space-y-2 text-xs">
        {insight.estimated_impact && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Impact:</span>
            <span className="font-medium text-gray-900">{insight.estimated_impact}</span>
          </div>
        )}
        {insight.timeline && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Timeline:</span>
            <span className="font-medium text-gray-900">{insight.timeline}</span>
          </div>
        )}
        {insight.budget_estimate && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Budget:</span>
            <span className="font-medium text-gray-900">{insight.budget_estimate}</span>
          </div>
        )}
        {insight.implementation_complexity && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Complexity:</span>
            <span className={`px-2 py-0.5 rounded ${
              insight.implementation_complexity === 'high' ? 'bg-red-100 text-red-700' :
              insight.implementation_complexity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {insight.implementation_complexity}
            </span>
          </div>
        )}
      </div>

      {insight.personalized_for && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>For {insight.personalized_for.persona} ({insight.personalized_for.company_size})</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-neutral-900 dark:bg-neutral-0 p-6 text-white dark:text-neutral-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <h2 className="text-xl font-bold text-white dark:text-neutral-900">Category Insights</h2>
            </div>
            <p className="text-white dark:text-neutral-900 text-sm">
              Top 3 personalized insights per buyer journey phase • 5-Phase Framework • Layer 1 Intelligence
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-white dark:text-neutral-900">Phases</div>
            <div className="text-2xl font-bold">{categoryKeys.length}/5</div>
          </div>
        </div>
      </div>

      {/* Phase Selector */}
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {categoryKeys.map((category) => {
            const info = PHASE_INFO[category] || { label: category, color: 'gray', description: '', weight: '' };
            const colorClass = getColorClasses(info.color);
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`p-3 rounded-lg border-2 transition-all text-left relative ${
                  selectedCategory === category
                    ? `${colorClass} border-current shadow-md`
                    : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className="text-xs font-medium">{info.label}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{info.weight}</div>
                {info.badge && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-orange-500 text-white text-[8px] font-bold rounded">
                    {info.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {selectedCategory && selectedInsights && (
        <div className="p-6">
          {/* Phase Description */}
          <div className="mb-6 p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-900">{PHASE_INFO[selectedCategory]?.label}</h3>
              {PHASE_INFO[selectedCategory]?.badge && (
                <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded">
                  {PHASE_INFO[selectedCategory].badge}
                </span>
              )}
              <span className="ml-auto text-xs text-gray-500">
                Strategic Weight: {PHASE_INFO[selectedCategory]?.weight}
              </span>
            </div>
            <p className="text-sm text-gray-600">{PHASE_INFO[selectedCategory]?.description}</p>
          </div>

          {/* Type Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { id: 'recommendations', label: 'Recommendations' },
              { id: 'competitive_gaps', label: 'Competitive Gaps' },
              { id: 'content_opportunities', label: 'Content Opportunities' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-neutral-900 dark:bg-neutral-0 text-white dark:text-neutral-900 shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                
                {tab.label}
              </button>
            ))}
          </div>

          {/* Insights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedInsights[activeTab] && selectedInsights[activeTab].length > 0 ? (
              selectedInsights[activeTab].map((insight, index) => renderInsightCard(insight, index))
            ) : (
              <div className="col-span-full text-center py-8 text-gray-500">
                No {activeTab.replace('_', ' ')} available for this phase.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span>Personalized by phase • 15 LLM Calls (5 phases × 3 types) • Layer 1</span>
          </div>
          <div className="text-gray-500">
            Company: {data.company_name}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryInsightsGrid;

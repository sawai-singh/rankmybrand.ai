'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { StrategicPrioritiesResponse, StrategicPriorityWithType, PriorityType } from '@/types/strategic-intelligence';

interface StrategicPrioritiesPanelProps {
  auditId: string;
  isLoading?: boolean;
}

export function StrategicPrioritiesPanel({ auditId, isLoading: externalLoading }: StrategicPrioritiesPanelProps) {
  const [data, setData] = useState<StrategicPrioritiesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<PriorityType>('recommendations');

  useEffect(() => {
    if (!auditId) return;

    const fetchPriorities = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await api.getStrategicPriorities(auditId);
        setData(result);
      } catch (err: any) {
        console.error('Error fetching strategic priorities:', err);
        setError(err.message || 'Failed to load strategic priorities');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPriorities();
  }, [auditId]);

  if (externalLoading || isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data || !data.priorities) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <p className="text-gray-600 text-center">{error || 'Strategic priorities not available yet.'}</p>
      </div>
    );
  }

  const { priorities } = data;
  const currentPriorities = priorities[activeType] || [];

  const priorityTypes: { id: PriorityType; label: string; icon: string; color: string }[] = [
    { id: 'recommendations', label: 'Recommendations', icon: '💡', color: 'purple' },
    { id: 'competitive_gaps', label: 'Competitive Gaps', icon: '🎯', color: 'red' },
    { id: 'content_opportunities', label: 'Content Opportunities', icon: '✨', color: 'blue' },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        badge: 'bg-purple-100 text-purple-700',
        header: 'bg-gradient-to-r from-purple-500 to-purple-600',
      },
      red: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        badge: 'bg-red-100 text-red-700',
        header: 'bg-gradient-to-r from-red-500 to-red-600',
      },
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        badge: 'bg-blue-100 text-blue-700',
        header: 'bg-gradient-to-r from-blue-500 to-blue-600',
      },
    };
    return colors[color as keyof typeof colors] || colors.purple;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h2 className="text-xl font-bold">Strategic Priorities</h2>
            </div>
            <p className="text-indigo-100 text-sm">
              Top 3-5 cross-category priorities • Layer 2 Intelligence
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-indigo-100">Overall Score</div>
            <div className="text-2xl font-bold">{data.overall_score?.toFixed(1) || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Type Selector */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex gap-2 p-3">
          {priorityTypes.map((type) => {
            const colors = getColorClasses(type.color);
            return (
              <button
                key={type.id}
                onClick={() => setActiveType(type.id)}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  activeType === type.id
                    ? `${colors.header} text-white shadow-md`
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span className="mr-2">{type.icon}</span>
                {type.label}
                {priorities[type.id] && (
                  <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                    {priorities[type.id]?.length || 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Priorities List */}
      <div className="p-6 space-y-4">
        {currentPriorities.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-gray-600">No {priorityTypes.find(t => t.id === activeType)?.label.toLowerCase()} available yet.</p>
          </div>
        ) : (
          currentPriorities.map((item, index) => {
            const priority = item.priority;
            const colors = getColorClasses(priorityTypes.find(t => t.id === activeType)?.color || 'purple');

            return (
              <div
                key={index}
                className={`${colors.bg} border ${colors.border} rounded-lg p-5 hover:shadow-md transition-all`}
              >
                {/* Rank Badge */}
                <div className="flex items-start gap-4">
                  <div className={`${colors.badge} w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0`}>
                    #{item.rank}
                  </div>

                  <div className="flex-1 space-y-3">
                    {/* Title */}
                    <h3 className={`text-lg font-semibold ${colors.text}`}>
                      {priority.title}
                    </h3>

                    {/* Why Strategic */}
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {priority.why_strategic}
                    </p>

                    {/* Metrics Row */}
                    <div className="flex flex-wrap gap-2">
                      {priority.combined_impact && (
                        <div className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700 border border-gray-200">
                          📈 {priority.combined_impact}
                        </div>
                      )}
                      {priority.roi_estimate && (
                        <div className="px-3 py-1 bg-green-100 rounded-full text-xs font-medium text-green-700">
                          💰 ROI: {priority.roi_estimate}
                        </div>
                      )}
                    </div>

                    {/* Implementation Details */}
                    {priority.implementation && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-gray-200">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Budget</div>
                          <div className="text-sm font-medium text-gray-900">{priority.implementation.budget}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Timeline</div>
                          <div className="text-sm font-medium text-gray-900">{priority.implementation.timeline}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Team</div>
                          <div className="text-sm font-medium text-gray-900">
                            {priority.implementation.team_required
                              ? (Array.isArray(priority.implementation.team_required)
                                  ? priority.implementation.team_required.join(', ')
                                  : priority.implementation.team_required)
                              : 'TBD'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Source Categories */}
                    {item.source_categories && item.source_categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        <span className="text-xs text-gray-500">Across:</span>
                        {item.source_categories.map((cat, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {cat.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Funnel Stages */}
                    {item.funnel_stages_impacted && item.funnel_stages_impacted.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-gray-500">Impact:</span>
                        {item.funnel_stages_impacted.map((stage, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded text-xs">
                            {stage}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Cross-category pattern recognition • 3 LLM Calls • Layer 2</span>
          </div>
          <div className="text-gray-500">
            Company: {data.company_name}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StrategicPrioritiesPanel;

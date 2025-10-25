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
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data || !data.priorities) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-6">
        <p className="text-neutral-600 dark:text-neutral-400 text-center">{error || 'Strategic priorities not available yet.'}</p>
      </div>
    );
  }

  const { priorities } = data;
  const currentPriorities = priorities[activeType] || [];

  const priorityTypes: { id: PriorityType; label: string; color: string }[] = [
    { id: 'recommendations', label: 'Recommendations', color: 'neutral' },
    { id: 'competitive_gaps', label: 'Competitive Gaps', color: 'danger' },
    { id: 'content_opportunities', label: 'Content Opportunities', color: 'neutral' },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      neutral: {
        bg: 'bg-neutral-50 dark:bg-neutral-800/50',
        border: 'border-neutral-200 dark:border-neutral-700',
        text: 'text-neutral-900 dark:text-neutral-0',
        badge: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-0',
        header: 'bg-neutral-900 dark:bg-neutral-0',
      },
      danger: {
        bg: 'bg-danger-50 dark:bg-danger-900/20',
        border: 'border-danger-200 dark:border-danger-800',
        text: 'text-danger-900 dark:text-danger-300',
        badge: 'bg-danger-100 text-danger-900 dark:bg-danger-900/40 dark:text-danger-200',
        header: 'bg-danger-600',
      },
    };
    return colors[color as keyof typeof colors] || colors.neutral;
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {/* Professional header */}
      <div className="bg-neutral-900 dark:bg-neutral-0 p-6 text-white dark:text-neutral-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h2 className="text-xl font-bold text-white dark:text-neutral-900">Strategic Priorities</h2>
            </div>
            <p className="text-white dark:text-neutral-900 text-sm">
              Top <span className="font-mono tabular-nums">3-5</span> cross-category priorities • Layer <span className="font-mono tabular-nums">2</span> Intelligence
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-white dark:text-neutral-900">Overall Score</div>
            <div className="text-2xl font-bold font-mono tabular-nums">{data.overall_score?.toFixed(1) || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Professional type selector */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="flex gap-2 p-3">
          {priorityTypes.map((type) => {
            const colors = getColorClasses(type.color);
            return (
              <button
                key={type.id}
                onClick={() => setActiveType(type.id)}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  activeType === type.id
                    ? `${colors.header} ${type.color === 'danger' ? 'text-white' : 'text-white dark:text-neutral-900'} shadow-md`
                    : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                }`}
              >
                {type.label}
                {priorities[type.id] && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-mono tabular-nums ${
                    activeType === type.id
                      ? 'bg-white/20 dark:bg-black/20'
                      : 'bg-neutral-100 dark:bg-neutral-800'
                  }`}>
                    {priorities[type.id]?.length || 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Professional priorities list */}
      <div className="p-6 space-y-4">
        {currentPriorities.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400">No {priorityTypes.find(t => t.id === activeType)?.label.toLowerCase()} available yet.</p>
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
                {/* Professional rank badge */}
                <div className="flex items-start gap-4">
                  <div className={`${colors.badge} w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg font-mono tabular-nums flex-shrink-0`}>
                    #{item.rank}
                  </div>

                  <div className="flex-1 space-y-3">
                    {/* Title */}
                    <h3 className={`text-lg font-semibold ${colors.text}`}>
                      {priority.title}
                    </h3>

                    {/* Why Strategic */}
                    <p className="text-neutral-700 dark:text-neutral-300 text-sm leading-relaxed">
                      {priority.why_strategic}
                    </p>

                    {/* Professional metrics row */}
                    <div className="flex flex-wrap gap-2">
                      {priority.combined_impact && (
                        <div className="px-3 py-1 bg-white dark:bg-neutral-900 rounded-full text-xs font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                          Impact: {priority.combined_impact}
                        </div>
                      )}
                      {priority.roi_estimate && (
                        <div className="px-3 py-1 bg-success-50 dark:bg-success-900/20 rounded-full text-xs font-medium text-success-700 dark:text-success-300 border border-success-200 dark:border-success-800">
                          ROI: {priority.roi_estimate}
                        </div>
                      )}
                    </div>

                    {/* Professional implementation details */}
                    {priority.implementation && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                        <div>
                          <div className="text-xs text-neutral-500 mb-1">Budget</div>
                          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-0">{priority.implementation.budget}</div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-500 mb-1">Timeline</div>
                          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-0">{priority.implementation.timeline}</div>
                        </div>
                        <div>
                          <div className="text-xs text-neutral-500 mb-1">Team</div>
                          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-0">
                            {priority.implementation.team_required
                              ? (Array.isArray(priority.implementation.team_required)
                                  ? priority.implementation.team_required.join(', ')
                                  : priority.implementation.team_required)
                              : 'TBD'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Professional source categories */}
                    {item.source_categories && item.source_categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        <span className="text-xs text-neutral-500">Across:</span>
                        {item.source_categories.map((cat, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-xs">
                            {cat.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Professional funnel stages */}
                    {item.funnel_stages_impacted && item.funnel_stages_impacted.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-neutral-500">Impact:</span>
                        {item.funnel_stages_impacted.map((stage, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-0 rounded text-xs">
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

      {/* Professional footer */}
      <div className="bg-neutral-50 dark:bg-neutral-800/50 px-6 py-3 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Cross-category pattern recognition • <span className="font-mono tabular-nums">3</span> LLM Calls • Layer <span className="font-mono tabular-nums">2</span></span>
          </div>
          <div className="text-neutral-500">
            Company: {data.company_name}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StrategicPrioritiesPanel;

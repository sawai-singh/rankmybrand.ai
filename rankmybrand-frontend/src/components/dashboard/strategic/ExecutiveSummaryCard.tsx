'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { ExecutiveSummaryResponse, ExecutiveBrief } from '@/types/strategic-intelligence';

interface ExecutiveSummaryCardProps {
  auditId: string;
  isLoading?: boolean;
}

export function ExecutiveSummaryCard({ auditId, isLoading: externalLoading }: ExecutiveSummaryCardProps) {
  const [data, setData] = useState<ExecutiveSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'roadmap' | 'resources' | 'outcomes'>('overview');

  useEffect(() => {
    if (!auditId) return;

    const fetchExecutiveSummary = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await api.getExecutiveSummary(auditId);
        setData(result);
      } catch (err: any) {
        console.error('Error fetching executive summary:', err);
        setError(err.message || 'Failed to load executive summary');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExecutiveSummary();
  }, [auditId]);

  if (externalLoading || isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="space-y-2 mt-6">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-gray-600">
            {error || 'Executive summary not available yet. Run an audit to generate strategic intelligence.'}
          </p>
        </div>
      </div>
    );
  }

  const { executive_brief, persona, company, scores } = data;
  const brief = executive_brief as ExecutiveBrief;

  return (
    <div className="bg-gradient-to-br from-white to-purple-50/30 rounded-xl shadow-lg border border-purple-100/50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-2xl font-bold">Executive Summary</h2>
            </div>
            <p className="text-purple-100 text-sm">
              Board-Ready Strategic Intelligence • Personalized for {persona}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{scores.overall.toFixed(1)}</div>
            <div className="text-xs text-purple-100">Overall Score</div>
          </div>
        </div>

        {/* Company Info */}
        <div className="mt-4 flex items-center gap-4 text-sm text-purple-100">
          <span>{company.name}</span>
          <span>•</span>
          <span>{company.industry}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <span>GEO: {scores.geo.toFixed(1)}%</span>
            <span>SOV: {scores.sov.toFixed(1)}%</span>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="flex gap-1 p-2">
          {[
            { id: 'overview', label: 'Current State', icon: '📊' },
            { id: 'roadmap', label: 'Strategic Roadmap', icon: '🗺️' },
            { id: 'resources', label: 'Resources', icon: '💰' },
            { id: 'outcomes', label: 'Expected Outcomes', icon: '🎯' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && brief.current_state && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Strengths</h3>
              <div className="space-y-2">
                {brief.current_state.key_strengths?.map((strength, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <p className="text-gray-700">{strength}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Critical Weaknesses</h3>
              <div className="space-y-2">
                {brief.current_state.critical_weaknesses?.map((weakness, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">⚠</span>
                    <p className="text-gray-700">{weakness}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'roadmap' && brief.strategic_roadmap && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-2xl">🚀</span>
                Quick Wins (Immediate)
              </h3>
              <ul className="space-y-2">
                {brief.strategic_roadmap.quick_wins?.map((win, idx) => (
                  <li key={idx} className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-green-600 font-bold">{idx + 1}.</span>
                    <span className="text-gray-700">{win}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-2xl">📅</span>
                Q1 Priorities
              </h3>
              <ul className="space-y-2">
                {brief.strategic_roadmap.q1_priorities?.map((priority, idx) => (
                  <li key={idx} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-blue-600 font-bold">{idx + 1}.</span>
                    <span className="text-gray-700">{priority}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-2xl">📈</span>
                Q2 Priorities
              </h3>
              <ul className="space-y-2">
                {brief.strategic_roadmap.q2_priorities?.map((priority, idx) => (
                  <li key={idx} className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <span className="text-purple-600 font-bold">{idx + 1}.</span>
                    <span className="text-gray-700">{priority}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'resources' && brief.resource_allocation && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="text-sm text-purple-600 font-medium mb-1">Budget Required</div>
                <div className="text-2xl font-bold text-purple-900">{brief.resource_allocation.budget_required}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-600 font-medium mb-1">Timeline</div>
                <div className="text-2xl font-bold text-blue-900">{brief.resource_allocation.timeline}</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="text-sm text-green-600 font-medium mb-1">Team Members</div>
                <div className="text-2xl font-bold text-green-900">{brief.resource_allocation.team_needs?.length || 0}</div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Team Requirements</h3>
              <div className="flex flex-wrap gap-2">
                {brief.resource_allocation.team_needs?.map((role, idx) => (
                  <span key={idx} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'outcomes' && brief.expected_outcomes && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
                <div className="text-sm text-green-600 font-medium mb-2">Score Improvement</div>
                <div className="text-3xl font-bold text-green-900">{brief.expected_outcomes.score_improvement}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-600 font-medium mb-2">Revenue Impact</div>
                <div className="text-3xl font-bold text-blue-900">{brief.expected_outcomes.revenue_impact}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
                <div className="text-sm text-purple-600 font-medium mb-2">Market Position</div>
                <div className="text-lg font-bold text-purple-900">{brief.expected_outcomes.competitive_position}</div>
              </div>
            </div>

            {brief.board_presentation && (
              <>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Messages for Board</h3>
                  <ul className="space-y-2">
                    {brief.board_presentation.key_messages?.map((message, idx) => (
                      <li key={idx} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                        <span className="text-purple-600 font-bold">{idx + 1}.</span>
                        <span className="text-gray-700">{message}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Success Metrics</h3>
                  <div className="flex flex-wrap gap-2">
                    {brief.board_presentation.success_metrics?.map((metric, idx) => (
                      <div key={idx} className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
                        <span className="text-indigo-700 font-medium">{metric}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Powered by 118-Call Strategic Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
              1 LLM Call • Layer 3
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExecutiveSummaryCard;

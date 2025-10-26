'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { BuyerJourneyInsightsResponse } from '@/types/strategic-intelligence';

interface BuyerJourneyInsightsViewProps {
  auditId: string;
  isLoading?: boolean;
}

// 5-Phase Buyer Journey Framework
const PHASE_INFO: Record<string, { label: string; color: string; badge?: string }> = {
  discovery: { label: 'Discovery', color: 'blue' },
  research: { label: 'Research', color: 'purple' },
  evaluation: { label: 'Evaluation', color: 'green' },
  comparison: { label: 'Comparison', color: 'orange', badge: 'CRITICAL' },
  purchase: { label: 'Purchase', color: 'red' },
};

export function BuyerJourneyInsightsView({ auditId, isLoading: externalLoading }: BuyerJourneyInsightsViewProps) {
  const [data, setData] = useState<BuyerJourneyInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!auditId) return;

    const fetchBuyerJourneyInsights = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await api.getBuyerJourneyInsights(auditId);
        setData(result);
        // Auto-select first category and batch
        if (result.buyer_journey) {
          const firstCategory = Object.keys(result.buyer_journey)[0];
          if (firstCategory) {
            setSelectedCategory(firstCategory);
            const batches = Object.keys(result.buyer_journey[firstCategory]);
            if (batches.length > 0) {
              setSelectedBatch(parseInt(batches[0]));
            }
          }
        }
      } catch (err: any) {
        console.error('Error fetching buyer journey insights:', err);
        setError(err.message || 'Failed to load buyer journey insights');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBuyerJourneyInsights();
  }, [auditId]);

  if (externalLoading || isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data || !data.buyer_journey) {
    return null; // Optional component - hide if no data
  }

  const { buyer_journey } = data;
  const categoryKeys = Object.keys(buyer_journey);
  const selectedBatches = selectedCategory ? buyer_journey[selectedCategory] : null;
  const batchNumbers = selectedBatches ? Object.keys(selectedBatches).map(Number).sort((a, b) => a - b) : [];
  const currentBatchData = selectedCategory && selectedBatch ? buyer_journey[selectedCategory]?.[selectedBatch] : null;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-gradient-to-r from-gray-700 to-gray-800 p-4 text-white flex items-center justify-between hover:from-gray-800 hover:to-gray-900 transition-all"
      >
        <div className="flex items-center gap-2">
          <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold">Advanced: Buyer Journey Batch Insights</span>
          <span className="text-xs text-gray-300 ml-2">(Phase 2 • 5-Phase Framework • 84 LLM Calls)</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <span>Raw batch-level data per phase</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <>
          {/* Phase Selector */}
          <div className="border-b border-gray-200 bg-gray-50 p-3">
            <div className="flex flex-wrap gap-2">
              {categoryKeys.map((category) => {
                const info = PHASE_INFO[category] || { label: category, color: 'gray' };
                return (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category);
                      const batches = Object.keys(buyer_journey[category]);
                      if (batches.length > 0) setSelectedBatch(parseInt(batches[0]));
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all relative ${
                      selectedCategory === category
                        ? 'bg-gray-800 text-white shadow-md'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {info.label}
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

          {/* Batch Selector */}
          {selectedCategory && batchNumbers.length > 0 && (
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Batch:</span>
                {batchNumbers.map((batch) => (
                  <button
                    key={batch}
                    onClick={() => setSelectedBatch(batch)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                      selectedBatch === batch
                        ? 'bg-neutral-900 dark:bg-neutral-0 text-white dark:text-neutral-900'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    #{batch}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          {currentBatchData && (
            <div className="p-6 space-y-6">
              {/* Recommendations */}
              {currentBatchData.recommendations && currentBatchData.recommendations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    Recommendations
                  </h3>
                  <div className="space-y-2">
                    {currentBatchData.recommendations.map((rec: any, idx: number) => (
                      <div key={idx} className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm">
                        {typeof rec === 'string' ? rec : JSON.stringify(rec, null, 2)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Competitive Gaps */}
              {currentBatchData.competitive_gaps && currentBatchData.competitive_gaps.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    Competitive Gaps
                  </h3>
                  <div className="space-y-2">
                    {currentBatchData.competitive_gaps.map((gap: any, idx: number) => (
                      <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                        {typeof gap === 'string' ? gap : JSON.stringify(gap, null, 2)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Content Opportunities */}
              {currentBatchData.content_opportunities && currentBatchData.content_opportunities.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    Content Opportunities
                  </h3>
                  <div className="space-y-2">
                    {currentBatchData.content_opportunities.map((opp: any, idx: number) => (
                      <div key={idx} className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm">
                        {typeof opp === 'string' ? opp : JSON.stringify(opp, null, 2)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per Response Metrics */}
              {currentBatchData.per_response_metrics && currentBatchData.per_response_metrics.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    Per-Response Metrics (Call #4)
                  </h3>
                  <div className="overflow-x-auto">
                    <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                      {JSON.stringify(currentBatchData.per_response_metrics, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div>
                <span className="font-medium">Phase 2:</span> Raw batch insights • 4 calls per batch • ~21 batches total (5 phases) = 84 LLM calls
              </div>
              <div className="text-gray-500">
                Viewing: Batch {selectedBatch} of {batchNumbers.length}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default BuyerJourneyInsightsView;

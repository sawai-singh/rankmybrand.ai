'use client';

/**
 * ResponseAnalysisTable - Professional B2B Data Table
 * Design System: Monochrome + Semantic Colors
 * - Professional table formatting (sticky headers, right-aligned numbers)
 * - Monospace numbers with tabular-nums
 * - Semantic colors for data only (green/red for sentiment)
 * - Neutral badges for providers
 * - Bloomberg/Stripe table aesthetic
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Search, Filter, X, SlidersHorizontal } from 'lucide-react';

interface ResponseData {
  id: string;
  provider: string;
  response_text: string;
  brand_mentioned: boolean;
  sentiment: string;
  recommendation_strength?: number;
  competitors_mentioned?: any[];
  created_at?: string;
  query_text?: string;
}

interface ResponseAnalysisTableProps {
  responses?: ResponseData[];
}

export default function ResponseAnalysisTable({ responses = [] }: ResponseAnalysisTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [brandMentionedFilter, setBrandMentionedFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'sentiment' | 'strength' | 'provider'>('sentiment');
  const [showFilters, setShowFilters] = useState(false);

  // Extract unique providers
  const providers = useMemo(() => {
    const provs = new Set(responses.map(r => r.provider).filter(Boolean));
    return Array.from(provs);
  }, [responses]);

  // Apply filters and sorting
  const filteredResponses = useMemo(() => {
    let filtered = responses.filter(response => {
      const matchesSearch =
        response.query_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        response.response_text?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProvider = providerFilter === 'all' || response.provider === providerFilter;
      const matchesSentiment = sentimentFilter === 'all' || response.sentiment?.toLowerCase() === sentimentFilter;
      const matchesBrand =
        brandMentionedFilter === 'all' ||
        (brandMentionedFilter === 'yes' && response.brand_mentioned) ||
        (brandMentionedFilter === 'no' && !response.brand_mentioned);

      return matchesSearch && matchesProvider && matchesSentiment && matchesBrand;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'strength') {
        return (b.recommendation_strength || 0) - (a.recommendation_strength || 0);
      } else if (sortBy === 'provider') {
        return a.provider.localeCompare(b.provider);
      }
      // Default sort by sentiment
      const sentimentOrder = { positive: 3, neutral: 2, negative: 1 };
      return (sentimentOrder[b.sentiment?.toLowerCase() as keyof typeof sentimentOrder] || 0) -
             (sentimentOrder[a.sentiment?.toLowerCase() as keyof typeof sentimentOrder] || 0);
    });

    return filtered;
  }, [responses, searchTerm, providerFilter, sentimentFilter, brandMentionedFilter, sortBy]);

  const hasActiveFilters =
    searchTerm ||
    providerFilter !== 'all' ||
    sentimentFilter !== 'all' ||
    brandMentionedFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setProviderFilter('all');
    setSentimentFilter('all');
    setBrandMentionedFilter('all');
  };

  // Semantic colors for sentiment data ONLY
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'text-success-700 dark:text-success-500';
      case 'negative':
        return 'text-danger-700 dark:text-danger-500';
      default:
        return 'text-neutral-600 dark:text-neutral-400';
    }
  };

  // Professional neutral badge for provider (no decorative colors)
  const getProviderBadge = (provider: string) => {
    return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700';
  };

  return (
    <Card className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
      <CardHeader className="border-b border-neutral-200 dark:border-neutral-800 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="section-header mb-2">AI Response Analysis</div>
            <CardTitle className="text-2xl font-bold text-neutral-900 dark:text-neutral-0 mb-1">
              Detailed Response Data
            </CardTitle>
            <CardDescription className="text-sm text-neutral-600 dark:text-neutral-400">
              Showing <span className="font-mono tabular-nums font-semibold">{filteredResponses.length}</span> of{' '}
              <span className="font-mono tabular-nums font-semibold">{responses.length}</span> responses
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Filters Section */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </h3>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs h-8 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear all
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Search queries or responses
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Type to search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
              </div>

              {/* Provider Filter */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Provider
                </label>
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All providers</SelectItem>
                    {providers.map((prov) => (
                      <SelectItem key={prov} value={prov}>
                        {prov}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Brand Mentioned Filter */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Brand Mentioned
                </label>
                <Select value={brandMentionedFilter} onValueChange={setBrandMentionedFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Sentiment Filter */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Sentiment
                </label>
                <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All sentiments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sentiments</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <span className="text-xs font-medium text-gray-600">Sort by:</span>
              <div className="flex gap-2">
                <Button
                  variant={sortBy === 'sentiment' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('sentiment')}
                  className="h-7 text-xs"
                >
                  Sentiment
                </Button>
                <Button
                  variant={sortBy === 'strength' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('strength')}
                  className="h-7 text-xs"
                >
                  Strength
                </Button>
                <Button
                  variant={sortBy === 'provider' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('provider')}
                  className="h-7 text-xs"
                >
                  Provider
                </Button>
              </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-500">Active filters:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    Search: "{searchTerm}"
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => setSearchTerm('')}
                    />
                  </Badge>
                )}
                {providerFilter !== 'all' && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    Provider: {providerFilter}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => setProviderFilter('all')}
                    />
                  </Badge>
                )}
                {sentimentFilter !== 'all' && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    Sentiment: {sentimentFilter}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => setSentimentFilter('all')}
                    />
                  </Badge>
                )}
                {brandMentionedFilter !== 'all' && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    Brand: {brandMentionedFilter === 'yes' ? 'Mentioned' : 'Not mentioned'}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => setBrandMentionedFilter('all')}
                    />
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Professional B2B Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            {/* Professional Sticky Headers */}
            <thead className="bg-neutral-50 dark:bg-neutral-900/50 sticky top-0 z-10 border-b-2 border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="px-6 py-4 text-left section-header">
                  Query
                </th>
                <th className="px-6 py-4 text-left section-header">
                  Provider
                </th>
                <th className="px-6 py-4 text-center section-header">
                  Brand
                </th>
                <th className="px-6 py-4 text-left section-header">
                  Sentiment
                </th>
                <th className="px-6 py-4 text-left section-header">
                  Competitors
                </th>
                <th className="px-6 py-4 text-right section-header">
                  Strength
                </th>
                <th className="px-6 py-4 text-left section-header">
                  Response Preview
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-neutral-950 divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredResponses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="text-neutral-500 dark:text-neutral-400">
                      {responses.length === 0
                        ? 'No responses found for this audit.'
                        : 'No responses match your filters. Try adjusting your search criteria.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredResponses.map((response) => (
                  <tr key={response.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors duration-150">
                    {/* Query */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-neutral-900 dark:text-neutral-0 max-w-xs">
                        {response.query_text?.substring(0, 60)}...
                      </div>
                    </td>

                    {/* Provider - Neutral Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-md ${getProviderBadge(response.provider)}`}>
                        {response.provider}
                      </span>
                    </td>

                    {/* Brand Mentioned - Semantic Color */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {response.brand_mentioned ? (
                        <CheckCircle className="w-5 h-5 text-success-600 inline-block" />
                      ) : (
                        <XCircle className="w-5 h-5 text-neutral-400 inline-block" />
                      )}
                    </td>

                    {/* Sentiment - Semantic Color for Text */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getSentimentColor(response.sentiment)}`}>
                        {response.sentiment || 'neutral'}
                      </span>
                    </td>

                    {/* Competitors - Neutral Badges */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {response.competitors_mentioned && response.competitors_mentioned.length > 0 ? (
                          response.competitors_mentioned
                            .filter((competitor) => competitor.mentioned)
                            .slice(0, 3)
                            .map((competitor, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {competitor.name}
                              </Badge>
                            ))
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </div>
                    </td>

                    {/* Strength - Right-aligned Monospace */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="font-mono tabular-nums text-sm font-semibold text-neutral-900 dark:text-neutral-0">
                        {response.recommendation_strength || 0}%
                      </span>
                    </td>

                    {/* Response Preview */}
                    <td className="px-6 py-4">
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 max-w-md truncate">
                        {response.response_text?.substring(0, 100)}...
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
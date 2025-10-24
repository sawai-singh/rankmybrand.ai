'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Search, Filter, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

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

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'bg-green-100 text-green-800';
      case 'negative':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProviderBadgeColor = (provider: string) => {
    const colors: { [key: string]: string } = {
      'openai': 'bg-green-100 text-green-800',
      'anthropic': 'bg-purple-100 text-purple-800',
      'google': 'bg-blue-100 text-blue-800',
      'perplexity': 'bg-indigo-100 text-indigo-800',
    };
    return colors[provider?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Response Analysis</CardTitle>
            <CardDescription>
              Showing {filteredResponses.length} of {responses.length} responses
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
      <CardContent>
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

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Query
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Brand Found
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sentiment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Competitors
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Strength
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Response Preview
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredResponses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {responses.length === 0
                      ? 'No responses found for this audit.'
                      : 'No responses match your filters. Try adjusting your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredResponses.map((response) => (
                  <tr key={response.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 max-w-xs">
                        {response.query_text?.substring(0, 60)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getProviderBadgeColor(response.provider)}`}>
                        {response.provider}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {response.brand_mentioned ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getSentimentColor(response.sentiment)}`}>
                        {response.sentiment || 'neutral'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {response.competitors_mentioned && response.competitors_mentioned.length > 0 ? (
                          response.competitors_mentioned
                            .filter((competitor) => competitor.mentioned)
                            .slice(0, 3)
                            .map((competitor, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {competitor.name}
                              </Badge>
                            ))
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${response.recommendation_strength || 0}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {response.recommendation_strength || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-600 max-w-md truncate">
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
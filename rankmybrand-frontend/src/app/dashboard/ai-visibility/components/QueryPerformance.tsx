'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import { getPriorityIndicator } from '@/lib/dashboard-utils';

interface QueryPerformanceProps {
  queries: Array<{
    id: string;
    text: string;
    category?: string;
    intent?: string;
    responseCount?: number;
    createdAt?: string;
  }>;
}

export default function QueryPerformance({ queries = [] }: QueryPerformanceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [intentFilter, setIntentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'text' | 'responses' | 'category'>('text');
  const [showFilters, setShowFilters] = useState(false);

  // Extract unique categories and intents
  const categories = useMemo(() => {
    const cats = new Set(queries.map(q => q.category).filter((c): c is string => Boolean(c)));
    return Array.from(cats);
  }, [queries]);

  const intents = useMemo(() => {
    const ints = new Set(queries.map(q => q.intent).filter((i): i is string => Boolean(i)));
    return Array.from(ints);
  }, [queries]);

  // Apply filters and sorting
  const filteredQueries = useMemo(() => {
    let filtered = queries.filter(query => {
      const matchesSearch = query.text.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || query.category === categoryFilter;
      const matchesIntent = intentFilter === 'all' || query.intent === intentFilter;
      return matchesSearch && matchesCategory && matchesIntent;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'responses') {
        return (b.responseCount || 0) - (a.responseCount || 0);
      } else if (sortBy === 'category') {
        return (a.category || '').localeCompare(b.category || '');
      }
      return a.text.localeCompare(b.text);
    });

    return filtered;
  }, [queries, searchTerm, categoryFilter, intentFilter, sortBy]);

  const hasActiveFilters = searchTerm || categoryFilter !== 'all' || intentFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setIntentFilter('all');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Query Performance</CardTitle>
            <CardDescription>
              Showing {filteredQueries.length} of {queries.length} queries
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
                  Search queries
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

              {/* Category Filter */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Category
                </label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Intent Filter */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Intent
                </label>
                <Select value={intentFilter} onValueChange={setIntentFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All intents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All intents</SelectItem>
                    {intents.map((int) => (
                      <SelectItem key={int} value={int}>
                        {int}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <span className="text-xs font-medium text-gray-600">Sort by:</span>
              <div className="flex gap-2">
                <Button
                  variant={sortBy === 'text' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('text')}
                  className="h-7 text-xs"
                >
                  Query Text
                </Button>
                <Button
                  variant={sortBy === 'responses' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('responses')}
                  className="h-7 text-xs"
                >
                  Responses
                </Button>
                <Button
                  variant={sortBy === 'category' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('category')}
                  className="h-7 text-xs"
                >
                  Category
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
                {categoryFilter !== 'all' && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    Category: {categoryFilter}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => setCategoryFilter('all')}
                    />
                  </Badge>
                )}
                {intentFilter !== 'all' && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    Intent: {intentFilter}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => setIntentFilter('all')}
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
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Intent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Responses
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredQueries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    {queries.length === 0
                      ? 'No queries executed yet. Start an audit to see results.'
                      : 'No queries match your filters. Try adjusting your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredQueries.map((query) => {
                  const priority = getPriorityIndicator(query.responseCount);
                  return (
                    <tr key={query.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                          <span
                            className="text-lg leading-none mt-0.5"
                            title={priority.label}
                            role="img"
                            aria-label={priority.label}
                          >
                            {priority.emoji}
                          </span>
                          <div className="text-sm font-medium text-gray-900 max-w-md">
                            {query.text}
                          </div>
                        </div>
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {query.category ? (
                        <Badge variant="secondary" className="text-xs">
                          {query.category}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {query.intent ? (
                        <Badge variant="outline" className="text-xs">
                          {query.intent}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-900">
                            {query.responseCount || 0}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
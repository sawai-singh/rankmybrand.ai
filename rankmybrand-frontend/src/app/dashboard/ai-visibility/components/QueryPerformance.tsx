'use client';

/**
 * QueryPerformance - Professional B2B Query Analysis Table
 * Design System: Monochrome + Semantic Colors
 * - Professional table with neutral styling
 * - Monospace numbers with tabular-nums
 * - Semantic colors for success indicators only
 * - Bloomberg Terminal aesthetic
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Search, Filter, X, SlidersHorizontal, MessageSquare } from 'lucide-react';
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
    <Card className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
      <CardHeader className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="section-header mb-2">Query Analysis</div>
            <CardTitle className="text-2xl font-bold text-neutral-900 dark:text-neutral-0 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-neutral-600" />
              Query Performance
            </CardTitle>
            <CardDescription className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Showing <span className="font-mono tabular-nums font-semibold">{filteredQueries.length}</span> of{' '}
              <span className="font-mono tabular-nums font-semibold">{queries.length}</span> queries
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-xs font-semibold"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Filters Section */}
        {showFilters && (
          <div className="m-6 p-4 bg-neutral-50 dark:bg-neutral-800/30 rounded-md border border-neutral-200 dark:border-neutral-700 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="section-header flex items-center gap-2">
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
                <label className="section-header mb-2 block">
                  Search queries
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
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
                <label className="section-header mb-2 block">
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
                <label className="section-header mb-2 block">
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
            <div className="flex items-center gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <span className="section-header">Sort by:</span>
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
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Active filters:</span>
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

        {/* Professional B2B Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-900/50 sticky top-0 z-10 border-b-2 border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="px-6 py-4 text-left section-header">
                  Query
                </th>
                <th className="px-6 py-4 text-left section-header">
                  Category
                </th>
                <th className="px-6 py-4 text-left section-header">
                  Intent
                </th>
                <th className="px-6 py-4 text-right section-header">
                  Responses
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-neutral-950 divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredQueries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="text-neutral-500 dark:text-neutral-400">
                      {queries.length === 0
                        ? 'No queries executed yet. Start an audit to see results.'
                        : 'No queries match your filters. Try adjusting your search criteria.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredQueries.map((query) => {
                  return (
                    <tr key={query.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <div className="text-sm text-neutral-900 dark:text-neutral-0 max-w-md">
                          {query.text}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {query.category ? (
                          <Badge variant="outline" className="text-xs">
                            {query.category}
                          </Badge>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {query.intent ? (
                          <Badge variant="outline" className="text-xs">
                            {query.intent}
                          </Badge>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <CheckCircle className="w-4 h-4 text-success-600" />
                          <span className="font-mono tabular-nums text-sm font-semibold text-neutral-900 dark:text-neutral-0">
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
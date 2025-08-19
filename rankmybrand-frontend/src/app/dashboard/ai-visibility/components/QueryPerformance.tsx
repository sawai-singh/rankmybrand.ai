'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface QueryPerformanceProps {
  queries: Array<{
    id: string;
    text: string;
    intent: string;
    providers: Array<{
      name: string;
      status: 'success' | 'failed' | 'pending';
      responseTime: number;
    }>;
    avgResponseTime: number;
  }>;
}

export default function QueryPerformance({ queries = [] }: QueryPerformanceProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Query Performance</CardTitle>
        <CardDescription>Real-time query execution across LLM providers</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {queries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No queries executed yet. Start an audit to see results.
            </div>
          ) : (
            queries.map((query) => (
              <div key={query.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{query.text}</p>
                    <Badge variant="secondary" className="mt-1">
                      {query.intent}
                    </Badge>
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="w-4 h-4 mr-1" />
                    {query.avgResponseTime}ms
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {query.providers.map((provider) => (
                    <div
                      key={provider.name}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="text-xs font-medium">{provider.name}</span>
                      {provider.status === 'success' && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {provider.status === 'failed' && (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      {provider.status === 'pending' && (
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
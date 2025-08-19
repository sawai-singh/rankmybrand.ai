'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, AlertTriangle, Target, Zap, Award } from 'lucide-react';

interface Insight {
  id: string;
  type: 'opportunity' | 'warning' | 'trend' | 'achievement';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  timestamp: string;
  actionable: boolean;
}

interface InsightsFeedProps {
  insights: Insight[];
}

export default function InsightsFeed({ insights = [] }: InsightsFeedProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'opportunity':
        return <Target className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'trend':
        return <TrendingUp className="w-5 h-5 text-blue-500" />;
      case 'achievement':
        return <Award className="w-5 h-5 text-purple-500" />;
      default:
        return <Lightbulb className="w-5 h-5 text-gray-500" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const defaultInsights: Insight[] = [
    {
      id: '1',
      type: 'opportunity',
      title: 'Increase brand mentions in AI responses',
      description: 'Your brand appears in only 45% of relevant queries. Consider creating more authoritative content.',
      impact: 'high',
      timestamp: '2 hours ago',
      actionable: true
    },
    {
      id: '2',
      type: 'trend',
      title: 'Rising visibility on Claude',
      description: 'Your brand visibility on Claude has increased by 23% in the past week.',
      impact: 'medium',
      timestamp: '5 hours ago',
      actionable: false
    },
    {
      id: '3',
      type: 'warning',
      title: 'Competitor gaining ground',
      description: 'Jenkins is appearing more frequently in CI/CD related queries.',
      impact: 'high',
      timestamp: '1 day ago',
      actionable: true
    }
  ];

  const displayInsights = insights.length > 0 ? insights : defaultInsights;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Insights & Recommendations</CardTitle>
        <CardDescription>Real-time insights from your AI visibility analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayInsights.map((insight) => (
            <div key={insight.id} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex-shrink-0 mt-1">
                {getIcon(insight.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900">{insight.title}</h4>
                    <p className="mt-1 text-sm text-gray-600">{insight.description}</p>
                  </div>
                  <div className="flex flex-col items-end ml-4 space-y-2">
                    <Badge className={getImpactColor(insight.impact)}>
                      {insight.impact} impact
                    </Badge>
                    {insight.actionable && (
                      <Badge variant="outline" className="text-xs">
                        <Zap className="w-3 h-3 mr-1" />
                        Actionable
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {insight.timestamp}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
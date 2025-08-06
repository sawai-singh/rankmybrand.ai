/**
 * Unit Tests for Enhanced Ranking Analyzer v2
 * Tests AI prediction, competitor analysis, and pattern recognition
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RankingAnalyzerV2 } from '../../core/ranking-analyzer-v2.js';
import type { 
  SearchResult, 
  RankingResult, 
  CompetitorAnalysis,
  AIVisibilityPrediction,
  ContentGap
} from '../../types/ranking-analyzer.types.js';

describe('RankingAnalyzerV2', () => {
  let analyzer: RankingAnalyzerV2;
  let mockSearchResults: SearchResult[];

  beforeEach(() => {
    analyzer = new RankingAnalyzerV2();
    
    mockSearchResults = [
      {
        query: 'best software platform',
        queryType: 'informational',
        intent: 'research',
        aiRelevance: 8,
        provider: 'serpapi',
        organicResults: [
          {
            position: 1,
            title: 'Top 10 Software Platforms',
            url: 'https://competitor1.com/platforms',
            snippet: 'Comprehensive guide to software platforms...'
          },
          {
            position: 2,
            title: 'TestBrand - Leading Software Platform',
            url: 'https://testbrand.com/features',
            snippet: 'TestBrand offers the best software platform...'
          }
        ],
        serpFeatures: {
          hasFeaturedSnippet: true,
          featuredSnippetUrl: 'https://competitor1.com/platforms',
          hasKnowledgePanel: false,
          hasPeopleAlsoAsk: true,
          peopleAlsoAskQuestions: [
            'What is the best software platform?',
            'How to choose a software platform?'
          ]
        },
        totalResults: 1500000,
        cached: false,
        cost: 0.01,
        timestamp: new Date().toISOString()
      },
      {
        query: 'TestBrand pricing',
        queryType: 'transactional',
        intent: 'purchase',
        aiRelevance: 5,
        provider: 'serpapi',
        organicResults: [
          {
            position: 1,
            title: 'TestBrand Pricing - Official',
            url: 'https://testbrand.com/pricing',
            snippet: 'Transparent pricing for TestBrand...'
          }
        ],
        serpFeatures: {
          hasFeaturedSnippet: false,
          hasKnowledgePanel: true,
          knowledgePanelDomain: 'testbrand.com'
        },
        totalResults: 50000,
        cached: true,
        cost: 0,
        timestamp: new Date().toISOString()
      }
    ];
  });

  describe('Position Analysis', () => {
    it('should detect exact positions for target domain', async () => {
      const results = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');

      expect(results).toHaveLength(2);
      expect(results[0].position).toBe(2);
      expect(results[0].urlFound).toBe('https://testbrand.com/features');
      expect(results[1].position).toBe(1);
      expect(results[1].urlFound).toBe('https://testbrand.com/pricing');
    });

    it('should handle subdomain variations', async () => {
      const resultsWithSubdomains: SearchResult[] = [{
        ...mockSearchResults[0],
        organicResults: [
          {
            position: 1,
            title: 'Blog Post',
            url: 'https://blog.testbrand.com/post',
            snippet: 'Blog content...'
          },
          {
            position: 2,
            title: 'Docs',
            url: 'https://docs.testbrand.com/guide',
            snippet: 'Documentation...'
          }
        ]
      }];

      const results = await analyzer.analyzeRankings(resultsWithSubdomains, 'testbrand.com');

      expect(results[0].position).toBe(1);
      expect(results[0].isSubdomain).toBe(true);
    });

    it('should mark queries where domain is not found', async () => {
      const noRankingResults: SearchResult[] = [{
        ...mockSearchResults[0],
        organicResults: [
          {
            position: 1,
            title: 'Other Result',
            url: 'https://other.com/page',
            snippet: 'Other content...'
          }
        ]
      }];

      const results = await analyzer.analyzeRankings(noRankingResults, 'testbrand.com');

      expect(results[0].position).toBe(null);
      expect(results[0].urlFound).toBe(null);
    });
  });

  describe('SERP Feature Analysis', () => {
    it('should identify SERP feature ownership', async () => {
      const results = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');

      expect(results[0].serpFeatures.ownsFeaturedSnippet).toBe(false);
      expect(results[0].serpFeatures.featuredSnippetOwner).toBe('competitor1.com');
      expect(results[1].serpFeatures.ownsKnowledgePanel).toBe(true);
    });

    it('should track People Also Ask presence', async () => {
      const results = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');

      expect(results[0].serpFeatures.hasPeopleAlsoAsk).toBe(true);
      expect(results[0].serpFeatures.peopleAlsoAskQuestions).toHaveLength(2);
    });
  });

  describe('Competitor Analysis', () => {
    it('should identify top competitors', async () => {
      const rankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      const competitors = analyzer.analyzeCompetitors(rankings, mockSearchResults);

      expect(competitors).toHaveLength(1);
      expect(competitors[0].domain).toBe('competitor1.com');
      expect(competitors[0].overlappingQueries).toBe(1);
    });

    it('should calculate competitive metrics', async () => {
      const rankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      const competitors = analyzer.analyzeCompetitors(rankings, mockSearchResults);

      const competitor = competitors[0];
      expect(competitor.averagePosition).toBeLessThan(2); // They rank #1
      expect(competitor.betterPositions).toBe(1);
      expect(competitor.serpFeatureWins).toBe(1); // Featured snippet
    });

    it('should identify head-to-head performance', async () => {
      const moreResults: SearchResult[] = [
        ...mockSearchResults,
        {
          ...mockSearchResults[0],
          query: 'software comparison',
          organicResults: [
            {
              position: 3,
              title: 'TestBrand vs Others',
              url: 'https://testbrand.com/compare',
              snippet: 'Compare TestBrand...'
            },
            {
              position: 5,
              title: 'Competitor Analysis',
              url: 'https://competitor1.com/analysis',
              snippet: 'Analysis of platforms...'
            }
          ]
        }
      ];

      const rankings = await analyzer.analyzeRankings(moreResults, 'testbrand.com');
      const competitors = analyzer.analyzeCompetitors(rankings, moreResults);

      expect(competitors[0].headToHead.wins).toBe(1);
      expect(competitors[0].headToHead.losses).toBe(1);
    });
  });

  describe('AI Visibility Prediction', () => {
    it('should predict AI visibility score', async () => {
      const rankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      const prediction = analyzer.predictAIVisibility(rankings, mockSearchResults);

      expect(prediction.score).toBeGreaterThanOrEqual(0);
      expect(prediction.score).toBeLessThanOrEqual(100);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });

    it('should determine likelihood levels correctly', async () => {
      const rankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      const prediction = analyzer.predictAIVisibility(rankings, mockSearchResults);

      expect(['high', 'medium', 'low']).toContain(prediction.likelihood);
    });

    it('should identify key factors', async () => {
      const rankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      const prediction = analyzer.predictAIVisibility(rankings, mockSearchResults);

      expect(prediction.factors).toBeInstanceOf(Array);
      expect(prediction.factors.length).toBeGreaterThan(0);
    });

    it('should weight high AI relevance queries more', async () => {
      const highRelevanceResults: SearchResult[] = [{
        ...mockSearchResults[0],
        aiRelevance: 10,
        organicResults: [
          {
            position: 1,
            title: 'TestBrand Guide',
            url: 'https://testbrand.com/guide',
            snippet: 'Comprehensive guide...'
          }
        ]
      }];

      const rankings = await analyzer.analyzeRankings(highRelevanceResults, 'testbrand.com');
      const prediction = analyzer.predictAIVisibility(rankings, highRelevanceResults);

      expect(prediction.score).toBeGreaterThan(80);
      expect(prediction.likelihood).toBe('high');
    });
  });

  describe('Content Gap Analysis', () => {
    it('should identify content gaps', async () => {
      const rankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      const gaps = analyzer.identifyContentGaps(rankings, mockSearchResults);

      expect(gaps).toBeInstanceOf(Array);
      expect(gaps.length).toBeGreaterThan(0);
    });

    it('should prioritize gaps by opportunity', async () => {
      const rankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      const gaps = analyzer.identifyContentGaps(rankings, mockSearchResults);

      if (gaps.length > 1) {
        expect(gaps[0].opportunityScore).toBeGreaterThanOrEqual(gaps[1].opportunityScore);
      }
    });

    it('should provide actionable recommendations', async () => {
      const rankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      const gaps = analyzer.identifyContentGaps(rankings, mockSearchResults);

      gaps.forEach(gap => {
        expect(gap.recommendation).toBeTruthy();
        expect(gap.targetUrl).toBeTruthy();
      });
    });
  });

  describe('Historical Comparison', () => {
    it('should compare with historical snapshot', async () => {
      const currentRankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      
      const historicalRankings: RankingResult[] = [
        {
          ...currentRankings[0],
          position: 5,
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      const comparison = analyzer.compareSnapshots(currentRankings, historicalRankings);

      expect(comparison.improved).toHaveLength(1);
      expect(comparison.improved[0].positionChange).toBe(3); // 5 -> 2
      expect(comparison.summary.netChange).toBeGreaterThan(0);
    });

    it('should identify new rankings', async () => {
      const currentRankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      const historicalRankings: RankingResult[] = [];

      const comparison = analyzer.compareSnapshots(currentRankings, historicalRankings);

      expect(comparison.new).toHaveLength(currentRankings.length);
    });
  });

  describe('Summary Metrics', () => {
    it('should calculate visibility score', async () => {
      const rankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      const summary = analyzer.calculateSummaryMetrics(rankings, mockSearchResults);

      expect(summary.visibilityScore).toBeGreaterThanOrEqual(0);
      expect(summary.visibilityScore).toBeLessThanOrEqual(100);
    });

    it('should calculate position distribution', async () => {
      const rankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      const summary = analyzer.calculateSummaryMetrics(rankings, mockSearchResults);

      expect(summary.top3Count).toBeGreaterThanOrEqual(0);
      expect(summary.top10Count).toBeGreaterThanOrEqual(summary.top3Count);
      expect(summary.averagePosition).toBeGreaterThan(0);
    });

    it('should track query coverage', async () => {
      const rankings = await analyzer.analyzeRankings(mockSearchResults, 'testbrand.com');
      const summary = analyzer.calculateSummaryMetrics(rankings, mockSearchResults);

      expect(summary.totalQueries).toBe(2);
      expect(summary.rankedQueries).toBe(2);
      expect(summary.coverageRate).toBe(1.0);
    });
  });

  describe('Performance', () => {
    it('should analyze large result sets efficiently', async () => {
      // Create 100 search results
      const largeResults: SearchResult[] = Array.from({ length: 100 }, (_, i) => ({
        ...mockSearchResults[0],
        query: `query ${i}`,
        organicResults: Array.from({ length: 10 }, (_, j) => ({
          position: j + 1,
          title: `Result ${j}`,
          url: `https://${j === 0 ? 'testbrand' : 'other'}.com/page${j}`,
          snippet: `Snippet ${j}`
        }))
      }));

      const startTime = Date.now();
      const rankings = await analyzer.analyzeRankings(largeResults, 'testbrand.com');
      const duration = Date.now() - startTime;

      expect(rankings).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle empty search results', async () => {
      const rankings = await analyzer.analyzeRankings([], 'testbrand.com');
      expect(rankings).toEqual([]);
    });

    it('should handle malformed search results', async () => {
      const malformedResults: any[] = [
        {
          query: 'test',
          // Missing required fields
        }
      ];

      const rankings = await analyzer.analyzeRankings(malformedResults, 'testbrand.com');
      expect(rankings).toHaveLength(0);
    });
  });
});
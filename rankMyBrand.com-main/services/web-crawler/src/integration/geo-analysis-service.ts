import { createWebCrawlerClient } from '../client/index.js';
import { logger } from '../utils/logger.js';

/**
 * Example integration showing how the GEO Calculator service
 * can use the Web Crawler to analyze websites
 */

interface GEOAnalysisRequest {
  url: string;
  keywords?: string[];
  depth?: number;
  pages?: number;
}

interface GEOAnalysisResult {
  jobId: string;
  domain: string;
  overallScore: number;
  scores: {
    citation: number;
    statistics: number;
    quotation: number;
    fluency: number;
    authority: number;
    relevance: number;
  };
  topRecommendations: any[];
  topPages: any[];
  crawlStats: {
    pagesAnalyzed: number;
    avgResponseTime: number;
    jsRenderedPages: number;
    crawlDuration: number;
  };
}

export class GEOAnalysisService {
  private crawlerClient: ReturnType<typeof createWebCrawlerClient>;

  constructor(crawlerApiUrl: string = 'http://localhost:3002') {
    this.crawlerClient = createWebCrawlerClient({
      baseUrl: crawlerApiUrl
    });

    // Set up event listeners
    this.crawlerClient.on('progress', this.handleProgress.bind(this));
    this.crawlerClient.on('error', this.handleError.bind(this));
  }

  /**
   * Analyze a website for GEO optimization
   */
  async analyzeWebsite(request: GEOAnalysisRequest): Promise<GEOAnalysisResult> {
    logger.info('Starting GEO analysis', { url: request.url });

    const startTime = Date.now();

    // Start the crawl
    const { jobId } = await this.crawlerClient.startCrawl(request.url, {
      maxPages: request.pages || 50,
      maxDepth: request.depth || 2,
      targetKeywords: request.keywords || [],
      includeSubdomains: false
    });

    logger.info(`Crawl started with job ID: ${jobId}`);

    // Wait for completion
    const result = await this.crawlerClient.waitForCompletion(jobId);

    const crawlDuration = (Date.now() - startTime) / 1000;

    // Process and return results
    return {
      jobId,
      domain: result.domain,
      overallScore: result.scores.avg_overall || 0,
      scores: {
        citation: result.scores.avg_citation || 0,
        statistics: result.scores.avg_statistics || 0,
        quotation: result.scores.avg_quotation || 0,
        fluency: result.scores.avg_fluency || 0,
        authority: result.scores.avg_authority || 0,
        relevance: result.scores.avg_relevance || 0
      },
      topRecommendations: result.recommendations,
      topPages: result.topPerformingPages,
      crawlStats: {
        pagesAnalyzed: result.summary.totalPages,
        avgResponseTime: result.summary.avgResponseTime,
        jsRenderedPages: result.summary.jsRenderedPages,
        crawlDuration
      }
    };
  }

  /**
   * Get detailed page-by-page analysis
   */
  async getDetailedAnalysis(jobId: string, page = 1, limit = 100) {
    return this.crawlerClient.getCrawledPages(jobId, page, limit);
  }

  /**
   * Get score distribution for visualization
   */
  async getScoreDistribution(jobId: string, metric: string) {
    return this.crawlerClient.getScoreDistribution(jobId, metric as any);
  }

  /**
   * Get recommendations grouped by metric
   */
  async getRecommendationsByMetric(jobId: string) {
    const pages = await this.crawlerClient.getCrawledPages(jobId, 1, 1000);
    
    const recommendations = pages.pages.flatMap((p: any) => p.recommendations || []);
    
    // Group by metric
    const grouped = recommendations.reduce((acc: any, rec: any) => {
      if (!acc[rec.metric]) {
        acc[rec.metric] = [];
      }
      acc[rec.metric].push(rec);
      return acc;
    }, {});
    
    // Sort and deduplicate
    Object.keys(grouped).forEach(metric => {
      const unique = new Map();
      grouped[metric].forEach((rec: any) => {
        const key = `${rec.action}-${rec.impact}`;
        if (!unique.has(key)) {
          unique.set(key, { ...rec, count: 0 });
        }
        unique.get(key).count++;
      });
      
      grouped[metric] = Array.from(unique.values())
        .sort((a, b) => {
          const priorityOrder: any = { critical: 0, high: 1, medium: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    });
    
    return grouped;
  }

  /**
   * Compare two domains
   */
  async compareDomains(domain1: string, domain2: string) {
    const [stats1, stats2] = await Promise.all([
      this.crawlerClient.getDomainStats(domain1),
      this.crawlerClient.getDomainStats(domain2)
    ]);
    
    return {
      domain1: stats1,
      domain2: stats2,
      comparison: {
        overallDifference: (stats1.avg_geo_score || 0) - (stats2.avg_geo_score || 0),
        metrics: {
          citation: (stats1.avg_citation_score || 0) - (stats2.avg_citation_score || 0),
          statistics: (stats1.avg_statistics_score || 0) - (stats2.avg_statistics_score || 0),
          quotation: (stats1.avg_quotation_score || 0) - (stats2.avg_quotation_score || 0),
          fluency: (stats1.avg_fluency_score || 0) - (stats2.avg_fluency_score || 0),
          authority: (stats1.avg_authority_score || 0) - (stats2.avg_authority_score || 0),
          relevance: (stats1.avg_relevance_score || 0) - (stats2.avg_relevance_score || 0)
        }
      }
    };
  }

  /**
   * Generate executive report
   */
  async generateExecutiveReport(jobId: string) {
    const [status, pages, distribution, errors] = await Promise.all([
      this.crawlerClient.getCrawlStatus(jobId),
      this.crawlerClient.getCrawledPages(jobId, 1, 1000),
      this.crawlerClient.getScoreDistribution(jobId, 'overall'),
      this.crawlerClient.getCrawlErrors(jobId)
    ]);
    
    const recommendations = await this.getRecommendationsByMetric(jobId);
    
    return {
      executive_summary: {
        domain: status.domain,
        pages_analyzed: status.summary.totalPages,
        overall_score: status.scores.avg_overall,
        grade: this.getGrade(status.scores.avg_overall),
        key_strengths: this.identifyStrengths(status.scores),
        key_weaknesses: this.identifyWeaknesses(status.scores),
        crawl_date: new Date().toISOString()
      },
      scores: status.scores,
      score_distribution: distribution,
      top_recommendations: Object.entries(recommendations)
        .flatMap(([metric, recs]: [string, any]) => 
          recs.slice(0, 2).map((r: any) => ({ ...r, metric }))
        )
        .slice(0, 10),
      top_performing_pages: status.topPerformingPages,
      technical_issues: errors.summary,
      improvement_potential: this.calculateImprovementPotential(status.scores)
    };
  }

  private handleProgress(data: any) {
    logger.debug('Crawl progress', data);
  }

  private handleError(data: any) {
    logger.error('Crawl error', data);
  }

  private getGrade(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    if (score >= 45) return 'D+';
    if (score >= 40) return 'D';
    return 'F';
  }

  private identifyStrengths(scores: any): string[] {
    const strengths = [];
    const metrics = ['citation', 'statistics', 'quotation', 'fluency', 'authority', 'relevance'];
    
    for (const metric of metrics) {
      const score = scores[`avg_${metric}`];
      if (score >= 80) {
        strengths.push(`Excellent ${metric} (${score.toFixed(1)})`);
      } else if (score >= 70) {
        strengths.push(`Good ${metric} (${score.toFixed(1)})`);
      }
    }
    
    return strengths.slice(0, 3);
  }

  private identifyWeaknesses(scores: any): string[] {
    const weaknesses = [];
    const metrics = ['citation', 'statistics', 'quotation', 'fluency', 'authority', 'relevance'];
    
    for (const metric of metrics) {
      const score = scores[`avg_${metric}`];
      if (score < 50) {
        weaknesses.push(`Poor ${metric} (${score.toFixed(1)})`);
      } else if (score < 60) {
        weaknesses.push(`Weak ${metric} (${score.toFixed(1)})`);
      }
    }
    
    return weaknesses.slice(0, 3);
  }

  private calculateImprovementPotential(scores: any): number {
    const currentAvg = scores.avg_overall || 0;
    const maxPossible = 100;
    return maxPossible - currentAvg;
  }
}

// Example usage
async function example() {
  const geoService = new GEOAnalysisService();
  
  try {
    // Analyze a website
    const result = await geoService.analyzeWebsite({
      url: 'https://example.com',
      keywords: ['AI', 'machine learning', 'optimization'],
      pages: 50,
      depth: 2
    });
    
    console.log('Analysis complete:', result);
    
    // Generate executive report
    const report = await geoService.generateExecutiveReport(result.jobId);
    console.log('Executive Report:', JSON.stringify(report, null, 2));
    
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  example();
}

/**
 * SERP Parser
 * Utility for parsing and extracting insights from search results
 */

import { Logger } from './logger.js';
import {
  SerpApiResponse,
  SerpResult,
  SerpFeatures,
  QueryType
} from '../types/search-intelligence.types.js';

export class SerpParser {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('SerpParser');
  }

  /**
   * Extract domain from URL
   */
  extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  /**
   * Analyze SERP competition level
   */
  analyzeCompetitionLevel(response: SerpApiResponse): {
    level: 'low' | 'medium' | 'high' | 'very_high';
    score: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 0;

    // Check for SERP features (more features = more competitive)
    const features = response.features;
    let featureCount = 0;
    
    if (features.hasFeaturedSnippet) { featureCount++; factors.push('Featured snippet present'); }
    if (features.hasKnowledgePanel) { featureCount++; factors.push('Knowledge panel present'); }
    if (features.hasPeopleAlsoAsk) { featureCount++; factors.push('People Also Ask present'); }
    if (features.hasLocalPack) { featureCount++; factors.push('Local pack present'); }
    if (features.hasShoppingResults) { featureCount++; factors.push('Shopping results present'); }
    if (features.hasVideoCarousel) { featureCount++; factors.push('Video carousel present'); }
    if (features.hasNewsResults) { featureCount++; factors.push('News results present'); }
    
    score += featureCount * 10;

    // Check organic result count
    if (features.totalOrganicResults < 8) {
      score += 20;
      factors.push('Limited organic results');
    }

    // Check for ads
    const adCount = response.results.filter(r => r.isAd).length;
    if (adCount >= 4) {
      score += 20;
      factors.push(`High ad presence (${adCount} ads)`);
    } else if (adCount >= 2) {
      score += 10;
      factors.push(`Moderate ad presence (${adCount} ads)`);
    }

    // Check domain diversity
    const domains = new Set(response.results.map(r => r.domain));
    const domainDiversity = domains.size / response.results.length;
    if (domainDiversity < 0.5) {
      score += 15;
      factors.push('Low domain diversity');
    }

    // Determine level
    let level: 'low' | 'medium' | 'high' | 'very_high';
    if (score >= 70) level = 'very_high';
    else if (score >= 50) level = 'high';
    else if (score >= 30) level = 'medium';
    else level = 'low';

    return { level, score, factors };
  }

  /**
   * Extract top domains from results
   */
  extractTopDomains(response: SerpApiResponse, limit = 5): Array<{
    domain: string;
    occurrences: number;
    bestPosition: number;
    avgPosition: number;
  }> {
    const domainMap = new Map<string, number[]>();

    // Collect positions for each domain
    response.results.forEach(result => {
      if (!result.isAd) {
        const positions = domainMap.get(result.domain) || [];
        positions.push(result.position);
        domainMap.set(result.domain, positions);
      }
    });

    // Calculate stats for each domain
    const domainStats = Array.from(domainMap.entries()).map(([domain, positions]) => ({
      domain,
      occurrences: positions.length,
      bestPosition: Math.min(...positions),
      avgPosition: positions.reduce((sum, pos) => sum + pos, 0) / positions.length
    }));

    // Sort by best position, then by occurrences
    domainStats.sort((a, b) => {
      if (a.bestPosition !== b.bestPosition) {
        return a.bestPosition - b.bestPosition;
      }
      return b.occurrences - a.occurrences;
    });

    return domainStats.slice(0, limit);
  }

  /**
   * Identify content gaps from search results
   */
  identifyContentGaps(response: SerpApiResponse): string[] {
    const gaps: string[] = [];
    const titles = response.results.map(r => r.title.toLowerCase());
    const snippets = response.results.map(r => r.snippet.toLowerCase());
    const combinedText = [...titles, ...snippets].join(' ');

    // Common content patterns to check
    const patterns = [
      { regex: /guide|tutorial|how.to/i, gap: 'Comprehensive guides or tutorials' },
      { regex: /review|comparison|vs/i, gap: 'Product reviews or comparisons' },
      { regex: /\d{4}|\d{2}\/\d{2}/i, gap: 'Updated content with recent dates' },
      { regex: /free|discount|coupon|deal/i, gap: 'Promotional or deal-focused content' },
      { regex: /best|top.\d+/i, gap: 'Listicles or "best of" content' },
      { regex: /faq|question|answer/i, gap: 'FAQ or Q&A content' },
      { regex: /video|watch/i, gap: 'Video content' },
      { regex: /download|pdf|template/i, gap: 'Downloadable resources' },
      { regex: /case.study|example|success/i, gap: 'Case studies or success stories' },
      { regex: /tool|calculator|generator/i, gap: 'Interactive tools or calculators' }
    ];

    patterns.forEach(({ regex, gap }) => {
      if (regex.test(combinedText)) {
        gaps.push(gap);
      }
    });

    // Check for specific SERP features that indicate content opportunities
    if (response.features.hasPeopleAlsoAsk && !combinedText.includes('faq')) {
      gaps.push('FAQ section addressing "People Also Ask" questions');
    }

    if (response.features.hasVideoCarousel && !gaps.includes('Video content')) {
      gaps.push('Video content to appear in video carousel');
    }

    return [...new Set(gaps)]; // Remove duplicates
  }

  /**
   * Analyze query intent from SERP
   */
  detectQueryIntent(response: SerpApiResponse): {
    primaryIntent: 'informational' | 'navigational' | 'transactional' | 'commercial';
    confidence: number;
    signals: string[];
  } {
    const signals: string[] = [];
    const intentScores = {
      informational: 0,
      navigational: 0,
      transactional: 0,
      commercial: 0
    };

    // Analyze SERP features
    if (response.features.hasFeaturedSnippet) {
      intentScores.informational += 30;
      signals.push('Featured snippet indicates informational intent');
    }

    if (response.features.hasKnowledgePanel) {
      intentScores.navigational += 20;
      intentScores.informational += 10;
      signals.push('Knowledge panel present');
    }

    if (response.features.hasShoppingResults) {
      intentScores.transactional += 30;
      intentScores.commercial += 20;
      signals.push('Shopping results indicate transactional intent');
    }

    if (response.features.hasLocalPack) {
      intentScores.transactional += 15;
      intentScores.navigational += 15;
      signals.push('Local pack suggests local intent');
    }

    // Analyze result patterns
    const titles = response.results.map(r => r.title.toLowerCase());
    const urls = response.results.map(r => r.url.toLowerCase());

    // Informational signals
    const infoPatterns = /how|what|why|guide|tutorial|tips|learn/i;
    const infoMatches = titles.filter(t => infoPatterns.test(t)).length;
    if (infoMatches > 3) {
      intentScores.informational += 25;
      signals.push('Multiple informational titles');
    }

    // Transactional signals
    const transPatterns = /buy|shop|price|deal|discount|order|purchase/i;
    const transMatches = titles.filter(t => transPatterns.test(t)).length;
    if (transMatches > 2) {
      intentScores.transactional += 25;
      signals.push('Transactional keywords in titles');
    }

    // Commercial signals
    const commercialPatterns = /best|review|comparison|top|vs/i;
    const commercialMatches = titles.filter(t => commercialPatterns.test(t)).length;
    if (commercialMatches > 2) {
      intentScores.commercial += 25;
      signals.push('Commercial investigation keywords');
    }

    // Navigational signals (brand/website focused)
    const domainCounts = new Map<string, number>();
    response.results.forEach(r => {
      domainCounts.set(r.domain, (domainCounts.get(r.domain) || 0) + 1);
    });
    const maxDomainCount = Math.max(...domainCounts.values());
    if (maxDomainCount >= 3) {
      intentScores.navigational += 20;
      signals.push('Single domain dominance suggests navigational intent');
    }

    // Determine primary intent
    const primaryIntent = Object.entries(intentScores)
      .sort(([, a], [, b]) => b - a)[0][0] as any;

    const totalScore = Object.values(intentScores).reduce((sum, score) => sum + score, 0);
    const confidence = totalScore > 0 
      ? intentScores[primaryIntent] / totalScore 
      : 0.25;

    return { primaryIntent, confidence, signals };
  }

  /**
   * Extract structured data opportunities
   */
  identifyStructuredDataOpportunities(response: SerpApiResponse): string[] {
    const opportunities: string[] = [];

    // Check what structured data might help based on SERP features
    if (response.features.hasFeaturedSnippet) {
      opportunities.push('FAQ Schema - to target featured snippets');
      opportunities.push('HowTo Schema - for instructional content');
    }

    if (response.features.hasVideoCarousel) {
      opportunities.push('VideoObject Schema - to appear in video results');
    }

    if (response.features.hasLocalPack) {
      opportunities.push('LocalBusiness Schema - for local visibility');
    }

    if (response.features.hasShoppingResults) {
      opportunities.push('Product Schema - for shopping results');
      opportunities.push('Offer Schema - for pricing information');
    }

    // Analyze content patterns
    const hasReviews = response.results.some(r => 
      /review|rating|testimonial/i.test(r.title)
    );
    if (hasReviews) {
      opportunities.push('Review Schema - to show star ratings');
    }

    const hasArticles = response.results.some(r => 
      /article|blog|news|guide/i.test(r.title)
    );
    if (hasArticles) {
      opportunities.push('Article Schema - for better content representation');
    }

    const hasEvents = response.results.some(r => 
      /event|conference|webinar|workshop/i.test(r.title)
    );
    if (hasEvents) {
      opportunities.push('Event Schema - for event listings');
    }

    return [...new Set(opportunities)];
  }

  /**
   * Calculate click-through rate estimates
   */
  estimateCTR(position: number, hasFeatures: boolean = false): number {
    // CTR data based on industry studies
    const baseCTR: Record<number, number> = {
      1: 28.5,
      2: 15.7,
      3: 11.0,
      4: 8.0,
      5: 7.2,
      6: 5.1,
      7: 4.0,
      8: 3.2,
      9: 2.8,
      10: 2.5
    };

    let ctr = baseCTR[position] || 2.0;

    // Reduce CTR if SERP features are present
    if (hasFeatures && position <= 3) {
      ctr *= 0.7; // 30% reduction for featured snippets, etc.
    }

    return ctr;
  }
}
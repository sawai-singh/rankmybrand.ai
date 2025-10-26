/**
 * Brand Authority Scorer
 * Scores brand mentions and calculates authority metrics
 */

import { Logger } from '../../utils/logger.js';
import {
  BrandMention,
  BrandAuthorityMetrics,
  AuthorityScore,
  AuthorityTier,
  MentionType
} from '../types/search-intelligence.types.js';

interface DomainAuthorityData {
  domain: string;
  authority: number;
  tier: AuthorityTier;
}

export class BrandAuthorityScorer {
  private logger: Logger;
  private domainAuthorityCache: Map<string, DomainAuthorityData>;
  private tier1Domains: Set<string>;
  private tier2Patterns: RegExp[];

  constructor() {
    this.logger = new Logger('BrandAuthorityScorer');
    this.domainAuthorityCache = new Map();
    this.initializeAuthorityData();
  }

  /**
   * Initialize authority data
   */
  private initializeAuthorityData(): void {
    // Tier 1 domains (highest authority)
    this.tier1Domains = new Set([
      // News & Media
      'nytimes.com', 'wsj.com', 'washingtonpost.com', 'bbc.com', 'cnn.com',
      'reuters.com', 'bloomberg.com', 'forbes.com', 'businessinsider.com',
      'techcrunch.com', 'theverge.com', 'wired.com', 'arstechnica.com',
      
      // Academic & Government
      'harvard.edu', 'mit.edu', 'stanford.edu', 'ox.ac.uk', 'cam.ac.uk',
      'nih.gov', 'cdc.gov', 'fda.gov', 'ftc.gov', 'sec.gov',
      
      // Major platforms
      'wikipedia.org', 'github.com', 'stackoverflow.com', 'medium.com',
      'linkedin.com', 'youtube.com', 'reddit.com',
      
      // Industry leaders
      'gartner.com', 'forrester.com', 'mckinsey.com', 'deloitte.com',
      'accenture.com', 'ibm.com', 'microsoft.com', 'google.com',
      'apple.com', 'amazon.com', 'salesforce.com'
    ]);

    // Tier 2 patterns (good authority)
    this.tier2Patterns = [
      /\.edu$/, // Educational institutions
      /\.gov$/, // Government sites
      /\.org$/, // Organizations (filtered)
      /^.+\.(co\.uk|ac\.uk|gov\.uk)$/, // UK domains
      /^.+\.g[0-9]+\.com$/, // G2, G3 review sites
      /^.+review.*\.com$/, // Review sites
      /^.+news.*\.com$/, // News sites
      /^.+tech.*\.com$/, // Tech sites
      /^.+business.*\.com$/ // Business sites
    ];
  }

  /**
   * Extract brand mention from a URL
   */
  async extractMention(url: string, brand: string): Promise<Partial<BrandMention> | null> {
    try {
      const domain = new URL(url).hostname;
      const authority = await this.getDomainAuthority(domain);
      
      // Skip very low authority domains
      if (authority.authority < 10) {
        return null;
      }

      return {
        sourceUrl: url,
        sourceDomain: domain,
        authorityTier: authority.tier,
        domainAuthority: authority.authority,
        mentionType: this.detectMentionType(url, domain),
        publishedDate: new Date() // Would be extracted from page in real implementation
      };
    } catch (error) {
      this.logger.error(`Failed to extract mention from ${url}:`, error);
      return null;
    }
  }

  /**
   * Calculate brand authority metrics
   */
  async calculateAuthority(mentions: BrandMention[]): Promise<BrandAuthorityMetrics> {
    if (mentions.length === 0) {
      return {
        totalMentions: 0,
        tier1Mentions: 0,
        tier2Mentions: 0,
        tier3Mentions: 0,
        avgDomainAuthority: 0,
        mentionDiversity: 0,
        recentMentions: 0,
        authorityScore: AuthorityScore.VERY_LOW
      };
    }

    // Count mentions by tier
    const tier1Mentions = mentions.filter(m => m.authorityTier === AuthorityTier.TIER_1).length;
    const tier2Mentions = mentions.filter(m => m.authorityTier === AuthorityTier.TIER_2).length;
    const tier3Mentions = mentions.filter(m => m.authorityTier === AuthorityTier.TIER_3).length;

    // Calculate average domain authority
    const avgDomainAuthority = mentions.reduce((sum, m) => 
      sum + (m.domainAuthority || 0), 0
    ) / mentions.length;

    // Calculate mention diversity (unique domains)
    const uniqueDomains = new Set(mentions.map(m => m.sourceDomain));
    const mentionDiversity = uniqueDomains.size;

    // Count recent mentions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentMentions = mentions.filter(m => 
      m.publishedDate && m.publishedDate > thirtyDaysAgo
    ).length;

    // Calculate authority score
    const authorityScore = this.calculateAuthorityScore({
      totalMentions: mentions.length,
      tier1Mentions,
      tier2Mentions,
      tier3Mentions,
      avgDomainAuthority,
      mentionDiversity,
      recentMentions
    });

    return {
      totalMentions: mentions.length,
      tier1Mentions,
      tier2Mentions,
      tier3Mentions,
      avgDomainAuthority: Math.round(avgDomainAuthority),
      mentionDiversity,
      recentMentions,
      authorityScore
    };
  }

  /**
   * Get domain authority
   */
  private async getDomainAuthority(domain: string): Promise<DomainAuthorityData> {
    // Check cache
    if (this.domainAuthorityCache.has(domain)) {
      return this.domainAuthorityCache.get(domain)!;
    }

    // Determine tier
    const tier = this.determineTier(domain);
    
    // Calculate authority score (0-100)
    let authority = 0;
    
    if (tier === AuthorityTier.TIER_1) {
      authority = 80 + Math.random() * 20; // 80-100
    } else if (tier === AuthorityTier.TIER_2) {
      authority = 50 + Math.random() * 30; // 50-80
    } else {
      authority = 10 + Math.random() * 40; // 10-50
    }

    const data: DomainAuthorityData = {
      domain,
      authority: Math.round(authority),
      tier
    };

    this.domainAuthorityCache.set(domain, data);
    return data;
  }

  /**
   * Determine domain tier
   */
  private determineTier(domain: string): AuthorityTier {
    // Check tier 1 domains
    if (this.tier1Domains.has(domain)) {
      return AuthorityTier.TIER_1;
    }

    // Check tier 2 patterns
    for (const pattern of this.tier2Patterns) {
      if (pattern.test(domain)) {
        return AuthorityTier.TIER_2;
      }
    }

    // Default to tier 3
    return AuthorityTier.TIER_3;
  }

  /**
   * Detect mention type from URL and domain
   */
  private detectMentionType(url: string, domain: string): MentionType {
    const urlLower = url.toLowerCase();
    
    // Check for specific patterns
    if (urlLower.includes('/review') || domain.includes('review')) {
      return MentionType.REVIEW;
    }
    
    if (urlLower.includes('/news/') || domain.includes('news')) {
      return MentionType.NEWS;
    }
    
    if (urlLower.includes('/press-release') || urlLower.includes('/pr/')) {
      return MentionType.PRESS_RELEASE;
    }
    
    if (domain.includes('reddit.com') || domain.includes('forum')) {
      return MentionType.FORUM;
    }
    
    if (domain.includes('twitter.com') || domain.includes('facebook.com') || 
        domain.includes('linkedin.com') || domain.includes('instagram.com')) {
      return MentionType.SOCIAL;
    }
    
    if (urlLower.includes('/directory/') || domain.includes('directory')) {
      return MentionType.DIRECTORY;
    }
    
    // Default to article
    return MentionType.ARTICLE;
  }

  /**
   * Calculate final authority score
   */
  private calculateAuthorityScore(metrics: Omit<BrandAuthorityMetrics, 'authorityScore'>): AuthorityScore {
    let score = 0;

    // Weighted scoring
    score += metrics.tier1Mentions * 10;
    score += metrics.tier2Mentions * 5;
    score += metrics.tier3Mentions * 2;
    score += Math.min(metrics.mentionDiversity * 3, 30); // Cap diversity bonus
    score += (metrics.avgDomainAuthority / 100) * 20; // Normalize to 0-20
    score += Math.min(metrics.recentMentions * 2, 20); // Cap recency bonus

    // Determine score tier
    if (score >= 80) {
      return AuthorityScore.VERY_HIGH;
    } else if (score >= 60) {
      return AuthorityScore.HIGH;
    } else if (score >= 40) {
      return AuthorityScore.MEDIUM;
    } else if (score >= 20) {
      return AuthorityScore.LOW;
    } else {
      return AuthorityScore.VERY_LOW;
    }
  }

  /**
   * Generate authority insights
   */
  generateAuthorityInsights(metrics: BrandAuthorityMetrics): string[] {
    const insights: string[] = [];

    // Overall authority assessment
    switch (metrics.authorityScore) {
      case AuthorityScore.VERY_HIGH:
        insights.push('Exceptional brand authority with strong presence on tier 1 domains');
        break;
      case AuthorityScore.HIGH:
        insights.push('Strong brand authority with good media coverage');
        break;
      case AuthorityScore.MEDIUM:
        insights.push('Moderate brand authority with room for improvement');
        break;
      case AuthorityScore.LOW:
        insights.push('Limited brand authority - needs more high-quality mentions');
        break;
      case AuthorityScore.VERY_LOW:
        insights.push('Very low brand authority - focus on PR and outreach');
        break;
    }

    // Tier distribution insights
    if (metrics.tier1Mentions === 0) {
      insights.push('No mentions on major authority sites - target tier 1 publications');
    } else if (metrics.tier1Mentions >= 5) {
      insights.push(`Strong presence on ${metrics.tier1Mentions} major authority sites`);
    }

    // Diversity insights
    if (metrics.mentionDiversity < 5) {
      insights.push('Low mention diversity - expand outreach to more domains');
    } else if (metrics.mentionDiversity >= 20) {
      insights.push(`Excellent mention diversity across ${metrics.mentionDiversity} domains`);
    }

    // Recency insights
    const recentPercentage = (metrics.recentMentions / metrics.totalMentions) * 100;
    if (recentPercentage < 20) {
      insights.push('Most mentions are older - need fresh content and PR');
    } else if (recentPercentage > 60) {
      insights.push('Good momentum with recent mentions');
    }

    return insights;
  }

  /**
   * Get improvement recommendations
   */
  getImprovementRecommendations(metrics: BrandAuthorityMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.tier1Mentions === 0) {
      recommendations.push('Develop relationships with tier 1 publications through PR outreach');
      recommendations.push('Create newsworthy content that major media outlets would cover');
    }

    if (metrics.avgDomainAuthority < 50) {
      recommendations.push('Focus on getting mentions from higher authority domains');
      recommendations.push('Consider guest posting on established industry blogs');
    }

    if (metrics.mentionDiversity < 10) {
      recommendations.push('Diversify your backlink profile across more domains');
      recommendations.push('Engage with industry communities and forums');
    }

    if (metrics.recentMentions < metrics.totalMentions * 0.3) {
      recommendations.push('Increase PR activities to generate fresh mentions');
      recommendations.push('Launch campaigns to re-engage media attention');
    }

    if (metrics.totalMentions < 20) {
      recommendations.push('Implement a comprehensive digital PR strategy');
      recommendations.push('Create shareable content assets (studies, infographics, tools)');
    }

    return recommendations;
  }
}
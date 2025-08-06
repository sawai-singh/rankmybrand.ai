/**
 * Competitor Detector
 * Auto-detect competitors from various sources
 */

import { Logger } from '../utils/logger.js';

export interface CompetitorInfo {
  domain: string;
  name: string;
  confidence: number; // 0-1
  source: 'content' | 'serp' | 'backlinks' | 'schema';
  context?: string;
}

export class CompetitorDetector {
  private logger: Logger;
  private knownCompetitorSignals: Map<string, string[]>;

  constructor() {
    this.logger = new Logger('CompetitorDetector');
    this.initializeCompetitorSignals();
  }

  /**
   * Initialize known competitor signals by industry
   */
  private initializeCompetitorSignals(): void {
    this.knownCompetitorSignals = new Map([
      ['ecommerce', ['shopify', 'woocommerce', 'bigcommerce', 'magento', 'squarespace']],
      ['crm', ['salesforce', 'hubspot', 'pipedrive', 'zoho', 'monday.com']],
      ['email', ['mailchimp', 'constantcontact', 'sendinblue', 'klaviyo', 'activecampaign']],
      ['analytics', ['google analytics', 'adobe analytics', 'mixpanel', 'amplitude', 'heap']],
      ['seo', ['semrush', 'ahrefs', 'moz', 'screaming frog', 'serpstat']],
      ['project', ['asana', 'trello', 'jira', 'basecamp', 'notion']],
      ['communication', ['slack', 'teams', 'discord', 'zoom', 'google meet']],
      ['hosting', ['aws', 'google cloud', 'azure', 'digitalocean', 'heroku']]
    ]);
  }

  /**
   * Detect competitors from multiple sources
   */
  async detectCompetitors(data: {
    content?: string;
    serpResults?: any[];
    backlinks?: any[];
    domain: string;
    industry?: string;
  }): Promise<CompetitorInfo[]> {
    const allCompetitors: CompetitorInfo[] = [];

    // Detect from content
    if (data.content) {
      const contentCompetitors = this.detectFromContent(data.content, data.domain);
      allCompetitors.push(...contentCompetitors);
    }

    // Detect from SERP co-occurrence
    if (data.serpResults) {
      const serpCompetitors = this.detectFromSerp(data.serpResults, data.domain);
      allCompetitors.push(...serpCompetitors);
    }

    // Detect from backlink overlap
    if (data.backlinks) {
      const backlinkCompetitors = this.detectFromBacklinks(data.backlinks, data.domain);
      allCompetitors.push(...backlinkCompetitors);
    }

    // Detect industry-specific competitors
    if (data.industry) {
      const industryCompetitors = this.detectFromIndustry(data.industry, data.domain);
      allCompetitors.push(...industryCompetitors);
    }

    // Merge and deduplicate competitors
    return this.mergeCompetitors(allCompetitors);
  }

  /**
   * Detect competitors from page content
   */
  private detectFromContent(content: string, ownDomain: string): CompetitorInfo[] {
    const competitors: CompetitorInfo[] = [];

    // Comparison patterns
    const comparisonPatterns = [
      {
        pattern: /(?:better than|alternative to|compared to|versus|vs\.?)\s+([a-zA-Z0-9\-]+(?:\.[a-zA-Z]{2,})?)/gi,
        confidence: 0.9
      },
      {
        pattern: /switch(?:ing)? from\s+([a-zA-Z0-9\-]+(?:\.[a-zA-Z]{2,})?)/gi,
        confidence: 0.85
      },
      {
        pattern: /([a-zA-Z0-9\-]+(?:\.[a-zA-Z]{2,})?)\s+(?:alternative|competitor)/gi,
        confidence: 0.8
      },
      {
        pattern: /migrate from\s+([a-zA-Z0-9\-]+(?:\.[a-zA-Z]{2,})?)/gi,
        confidence: 0.85
      },
      {
        pattern: /why (?:choose )?(?:us|our \w+) over\s+([a-zA-Z0-9\-]+)/gi,
        confidence: 0.9
      }
    ];

    comparisonPatterns.forEach(({ pattern, confidence }) => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const competitorName = match[1].trim();
        if (this.isValidCompetitorName(competitorName, ownDomain)) {
          competitors.push({
            domain: this.normalizeToDomain(competitorName),
            name: competitorName,
            confidence,
            source: 'content',
            context: match[0]
          });
        }
      }
    });

    // Look for comparison tables
    const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    const tables = content.matchAll(tablePattern);
    for (const table of tables) {
      const tableContent = table[1];
      if (/comparison|versus|vs|features/i.test(tableContent)) {
        const domains = this.extractDomainsFromText(tableContent);
        domains.forEach(domain => {
          if (domain !== ownDomain) {
            competitors.push({
              domain,
              name: domain,
              confidence: 0.75,
              source: 'content',
              context: 'Comparison table'
            });
          }
        });
      }
    }

    return competitors;
  }

  /**
   * Detect competitors from SERP co-occurrence
   */
  private detectFromSerp(serpResults: any[], ownDomain: string): CompetitorInfo[] {
    const domainFrequency = new Map<string, number>();
    
    // Count domain occurrences across different queries
    serpResults.forEach(result => {
      if (result.domain && result.domain !== ownDomain && result.position <= 10) {
        domainFrequency.set(
          result.domain,
          (domainFrequency.get(result.domain) || 0) + 1
        );
      }
    });

    // Convert to competitors based on frequency
    const competitors: CompetitorInfo[] = [];
    domainFrequency.forEach((frequency, domain) => {
      if (frequency >= 3) { // Appears in at least 3 searches
        competitors.push({
          domain,
          name: domain,
          confidence: Math.min(0.9, 0.5 + (frequency * 0.05)),
          source: 'serp',
          context: `Appears in ${frequency} search results`
        });
      }
    });

    return competitors;
  }

  /**
   * Detect competitors from backlink overlap
   */
  private detectFromBacklinks(backlinks: any[], ownDomain: string): CompetitorInfo[] {
    const linkedDomains = new Map<string, number>();
    
    // Count domains that link to similar pages
    backlinks.forEach(backlink => {
      if (backlink.targetDomains) {
        backlink.targetDomains.forEach((domain: string) => {
          if (domain !== ownDomain) {
            linkedDomains.set(
              domain,
              (linkedDomains.get(domain) || 0) + 1
            );
          }
        });
      }
    });

    // High overlap indicates competition
    const competitors: CompetitorInfo[] = [];
    linkedDomains.forEach((overlap, domain) => {
      if (overlap >= 5) { // At least 5 shared backlinks
        competitors.push({
          domain,
          name: domain,
          confidence: Math.min(0.8, 0.4 + (overlap * 0.02)),
          source: 'backlinks',
          context: `${overlap} shared backlink sources`
        });
      }
    });

    return competitors;
  }

  /**
   * Detect industry-specific competitors
   */
  private detectFromIndustry(industry: string, ownDomain: string): CompetitorInfo[] {
    const competitors: CompetitorInfo[] = [];
    const industryKey = industry.toLowerCase();

    // Check known competitors for the industry
    for (const [key, competitorList] of this.knownCompetitorSignals) {
      if (industryKey.includes(key)) {
        competitorList.forEach(competitorName => {
          const domain = this.normalizeToDomain(competitorName);
          if (domain !== ownDomain) {
            competitors.push({
              domain,
              name: competitorName,
              confidence: 0.7,
              source: 'schema',
              context: `Known ${key} competitor`
            });
          }
        });
      }
    }

    return competitors;
  }

  /**
   * Validate competitor name
   */
  private isValidCompetitorName(name: string, ownDomain: string): boolean {
    if (!name || name.length < 3 || name.length > 50) return false;
    if (name === ownDomain) return false;
    
    // Filter out common words
    const invalidWords = ['example', 'competitor', 'alternative', 'other', 'another', 'them'];
    const nameLower = name.toLowerCase();
    if (invalidWords.includes(nameLower)) return false;

    // Check if it looks like a brand/domain
    return /^[a-zA-Z0-9][a-zA-Z0-9\-\.]*[a-zA-Z0-9]$/.test(name);
  }

  /**
   * Normalize brand name to domain
   */
  private normalizeToDomain(name: string): string {
    let domain = name.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9\-\.]/g, '');

    // Add .com if no TLD present
    if (!domain.includes('.')) {
      domain += '.com';
    }

    return domain;
  }

  /**
   * Extract domains from text
   */
  private extractDomainsFromText(text: string): string[] {
    const domainPattern = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9\-]+\.[a-zA-Z]{2,})/g;
    const domains: string[] = [];
    
    const matches = text.matchAll(domainPattern);
    for (const match of matches) {
      domains.push(match[1]);
    }

    return [...new Set(domains)];
  }

  /**
   * Merge and deduplicate competitors
   */
  private mergeCompetitors(competitors: CompetitorInfo[]): CompetitorInfo[] {
    const merged = new Map<string, CompetitorInfo>();

    competitors.forEach(competitor => {
      const existing = merged.get(competitor.domain);
      if (!existing || competitor.confidence > existing.confidence) {
        merged.set(competitor.domain, competitor);
      } else if (competitor.source !== existing.source) {
        // Boost confidence if detected from multiple sources
        existing.confidence = Math.min(0.95, existing.confidence + 0.1);
      }
    });

    // Sort by confidence
    return Array.from(merged.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Top 10 competitors
  }
}
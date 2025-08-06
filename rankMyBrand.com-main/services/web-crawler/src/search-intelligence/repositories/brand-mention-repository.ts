/**
 * Brand Mention Repository
 * Handles database operations for brand mentions
 */

import { Pool } from 'pg';
import { Logger } from '../utils/logger.js';
import {
  BrandMention,
  AuthorityTier,
  MentionType
} from '../types/search-intelligence.types.js';

export class BrandMentionRepository {
  private logger: Logger;

  constructor(private db: Pool) {
    this.logger = new Logger('BrandMentionRepository');
  }

  /**
   * Create a new brand mention
   */
  async create(mention: Omit<BrandMention, 'id' | 'createdAt'>): Promise<BrandMention> {
    const query = `
      INSERT INTO brand_mentions 
      (analysis_id, source_url, source_domain, authority_tier, 
       domain_authority, mention_context, mention_type, published_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      mention.analysisId,
      mention.sourceUrl,
      mention.sourceDomain,
      mention.authorityTier,
      mention.domainAuthority || null,
      mention.mentionContext || null,
      mention.mentionType,
      mention.publishedDate || null
    ];

    try {
      const result = await this.db.query(query, values);
      return this.mapRowToMention(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to create brand mention:', error);
      throw error;
    }
  }

  /**
   * Create multiple mentions in batch
   */
  async createBatch(mentions: Array<Omit<BrandMention, 'id' | 'createdAt'>>): Promise<void> {
    if (mentions.length === 0) return;

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const mention of mentions) {
      placeholders.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 
          $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
      );
      
      values.push(
        mention.analysisId,
        mention.sourceUrl,
        mention.sourceDomain,
        mention.authorityTier,
        mention.domainAuthority || null,
        mention.mentionContext || null,
        mention.mentionType,
        mention.publishedDate || null
      );
    }

    const query = `
      INSERT INTO brand_mentions 
      (analysis_id, source_url, source_domain, authority_tier, 
       domain_authority, mention_context, mention_type, published_date)
      VALUES ${placeholders.join(', ')}
    `;

    try {
      await this.db.query(query, values);
      this.logger.info(`Created ${mentions.length} mentions in batch`);
    } catch (error) {
      this.logger.error('Failed to create mentions batch:', error);
      throw error;
    }
  }

  /**
   * Find mentions by analysis ID
   */
  async findByAnalysisId(analysisId: string): Promise<BrandMention[]> {
    const query = `
      SELECT * FROM brand_mentions 
      WHERE analysis_id = $1 
      ORDER BY authority_tier ASC, domain_authority DESC
    `;
    
    try {
      const result = await this.db.query(query, [analysisId]);
      return result.rows.map(row => this.mapRowToMention(row));
    } catch (error) {
      this.logger.error(`Failed to find mentions for analysis ${analysisId}:`, error);
      throw error;
    }
  }

  /**
   * Find mentions by authority tier
   */
  async findByAuthorityTier(
    analysisId: string,
    tier: AuthorityTier
  ): Promise<BrandMention[]> {
    const query = `
      SELECT * FROM brand_mentions 
      WHERE analysis_id = $1 AND authority_tier = $2
      ORDER BY domain_authority DESC
    `;
    
    try {
      const result = await this.db.query(query, [analysisId, tier]);
      return result.rows.map(row => this.mapRowToMention(row));
    } catch (error) {
      this.logger.error('Failed to find mentions by authority tier:', error);
      throw error;
    }
  }

  /**
   * Find mentions by mention type
   */
  async findByMentionType(
    analysisId: string,
    type: MentionType
  ): Promise<BrandMention[]> {
    const query = `
      SELECT * FROM brand_mentions 
      WHERE analysis_id = $1 AND mention_type = $2
      ORDER BY authority_tier ASC, domain_authority DESC
    `;
    
    try {
      const result = await this.db.query(query, [analysisId, type]);
      return result.rows.map(row => this.mapRowToMention(row));
    } catch (error) {
      this.logger.error('Failed to find mentions by type:', error);
      throw error;
    }
  }

  /**
   * Find recent mentions
   */
  async findRecentMentions(
    analysisId: string,
    daysBack = 30
  ): Promise<BrandMention[]> {
    const query = `
      SELECT * FROM brand_mentions 
      WHERE analysis_id = $1 
        AND published_date >= NOW() - INTERVAL '${daysBack} days'
      ORDER BY published_date DESC
    `;
    
    try {
      const result = await this.db.query(query, [analysisId]);
      return result.rows.map(row => this.mapRowToMention(row));
    } catch (error) {
      this.logger.error('Failed to find recent mentions:', error);
      throw error;
    }
  }

  /**
   * Get mention statistics
   */
  async getMentionStats(analysisId: string): Promise<{
    totalMentions: number;
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
    avgDomainAuthority: number;
    uniqueDomains: number;
    mentionTypes: Record<string, number>;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_mentions,
        COUNT(CASE WHEN authority_tier = 1 THEN 1 END) as tier_1_count,
        COUNT(CASE WHEN authority_tier = 2 THEN 1 END) as tier_2_count,
        COUNT(CASE WHEN authority_tier = 3 THEN 1 END) as tier_3_count,
        AVG(domain_authority) as avg_domain_authority,
        COUNT(DISTINCT source_domain) as unique_domains
      FROM brand_mentions
      WHERE analysis_id = $1
    `;

    const typeQuery = `
      SELECT mention_type, COUNT(*) as count
      FROM brand_mentions
      WHERE analysis_id = $1
      GROUP BY mention_type
    `;
    
    try {
      const [statsResult, typeResult] = await Promise.all([
        this.db.query(query, [analysisId]),
        this.db.query(typeQuery, [analysisId])
      ]);

      const stats = statsResult.rows[0];
      const mentionTypes: Record<string, number> = {};
      
      typeResult.rows.forEach(row => {
        mentionTypes[row.mention_type] = parseInt(row.count);
      });
      
      return {
        totalMentions: parseInt(stats.total_mentions) || 0,
        tier1Count: parseInt(stats.tier_1_count) || 0,
        tier2Count: parseInt(stats.tier_2_count) || 0,
        tier3Count: parseInt(stats.tier_3_count) || 0,
        avgDomainAuthority: parseFloat(stats.avg_domain_authority) || 0,
        uniqueDomains: parseInt(stats.unique_domains) || 0,
        mentionTypes
      };
    } catch (error) {
      this.logger.error('Failed to get mention stats:', error);
      throw error;
    }
  }

  /**
   * Get top authority domains
   */
  async getTopAuthorityDomains(
    analysisId: string,
    limit = 10
  ): Promise<Array<{ domain: string; authority: number; mentions: number }>> {
    const query = `
      SELECT 
        source_domain as domain,
        MAX(domain_authority) as authority,
        COUNT(*) as mentions
      FROM brand_mentions
      WHERE analysis_id = $1 AND domain_authority IS NOT NULL
      GROUP BY source_domain
      ORDER BY MAX(domain_authority) DESC, COUNT(*) DESC
      LIMIT $2
    `;
    
    try {
      const result = await this.db.query(query, [analysisId, limit]);
      return result.rows.map(row => ({
        domain: row.domain,
        authority: parseInt(row.authority),
        mentions: parseInt(row.mentions)
      }));
    } catch (error) {
      this.logger.error('Failed to get top authority domains:', error);
      throw error;
    }
  }

  /**
   * Delete mentions for an analysis
   */
  async deleteByAnalysisId(analysisId: string): Promise<number> {
    const query = 'DELETE FROM brand_mentions WHERE analysis_id = $1';
    
    try {
      const result = await this.db.query(query, [analysisId]);
      return result.rowCount || 0;
    } catch (error) {
      this.logger.error(`Failed to delete mentions for analysis ${analysisId}:`, error);
      throw error;
    }
  }

  /**
   * Check if URL already exists for analysis
   */
  async urlExists(analysisId: string, sourceUrl: string): Promise<boolean> {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM brand_mentions 
        WHERE analysis_id = $1 AND source_url = $2
      )
    `;
    
    try {
      const result = await this.db.query(query, [analysisId, sourceUrl]);
      return result.rows[0].exists;
    } catch (error) {
      this.logger.error('Failed to check URL existence:', error);
      throw error;
    }
  }

  /**
   * Map database row to BrandMention
   */
  private mapRowToMention(row: any): BrandMention {
    return {
      id: row.id,
      analysisId: row.analysis_id,
      sourceUrl: row.source_url,
      sourceDomain: row.source_domain,
      authorityTier: row.authority_tier as AuthorityTier,
      domainAuthority: row.domain_authority,
      mentionContext: row.mention_context,
      mentionType: row.mention_type as MentionType,
      publishedDate: row.published_date,
      createdAt: row.created_at
    };
  }
}
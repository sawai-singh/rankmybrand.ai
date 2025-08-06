/**
 * Search Ranking Repository
 * Handles database operations for search rankings
 */

import { Pool } from 'pg';
import { Logger } from '../utils/logger.js';
import {
  SearchRanking,
  QueryType,
  SerpFeatures
} from '../types/search-intelligence.types.js';

export class SearchRankingRepository {
  private logger: Logger;

  constructor(private db: Pool) {
    this.logger = new Logger('SearchRankingRepository');
  }

  /**
   * Create a new search ranking
   */
  async create(ranking: SearchRanking): Promise<void> {
    const query = `
      INSERT INTO search_rankings 
      (id, analysis_id, query, query_type, position, url_found, 
       serp_features, competitor_positions)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (analysis_id, query) DO UPDATE SET
        position = EXCLUDED.position,
        url_found = EXCLUDED.url_found,
        serp_features = EXCLUDED.serp_features,
        competitor_positions = EXCLUDED.competitor_positions
    `;

    const values = [
      ranking.id,
      ranking.analysisId,
      ranking.query,
      ranking.queryType,
      ranking.position || null,
      ranking.urlFound || null,
      JSON.stringify(ranking.serpFeatures),
      JSON.stringify(ranking.competitorPositions)
    ];

    try {
      await this.db.query(query, values);
    } catch (error) {
      this.logger.error('Failed to create search ranking:', error);
      throw error;
    }
  }

  /**
   * Create multiple rankings in batch
   */
  async createBatch(rankings: SearchRanking[]): Promise<void> {
    if (rankings.length === 0) return;

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const ranking of rankings) {
      placeholders.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 
          $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
      );
      
      values.push(
        ranking.id,
        ranking.analysisId,
        ranking.query,
        ranking.queryType,
        ranking.position || null,
        ranking.urlFound || null,
        JSON.stringify(ranking.serpFeatures),
        JSON.stringify(ranking.competitorPositions)
      );
    }

    const query = `
      INSERT INTO search_rankings 
      (id, analysis_id, query, query_type, position, url_found, 
       serp_features, competitor_positions)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (analysis_id, query) DO UPDATE SET
        position = EXCLUDED.position,
        url_found = EXCLUDED.url_found,
        serp_features = EXCLUDED.serp_features,
        competitor_positions = EXCLUDED.competitor_positions
    `;

    try {
      await this.db.query(query, values);
      this.logger.info(`Created ${rankings.length} rankings in batch`);
    } catch (error) {
      this.logger.error('Failed to create rankings batch:', error);
      throw error;
    }
  }

  /**
   * Find rankings by analysis ID
   */
  async findByAnalysisId(analysisId: string): Promise<SearchRanking[]> {
    const query = `
      SELECT * FROM search_rankings 
      WHERE analysis_id = $1 
      ORDER BY position ASC NULLS LAST, query ASC
    `;
    
    try {
      const result = await this.db.query(query, [analysisId]);
      return result.rows.map(row => this.mapRowToRanking(row));
    } catch (error) {
      this.logger.error(`Failed to find rankings for analysis ${analysisId}:`, error);
      throw error;
    }
  }

  /**
   * Find rankings by query type
   */
  async findByQueryType(
    analysisId: string, 
    queryType: QueryType
  ): Promise<SearchRanking[]> {
    const query = `
      SELECT * FROM search_rankings 
      WHERE analysis_id = $1 AND query_type = $2
      ORDER BY position ASC NULLS LAST
    `;
    
    try {
      const result = await this.db.query(query, [analysisId, queryType]);
      return result.rows.map(row => this.mapRowToRanking(row));
    } catch (error) {
      this.logger.error(`Failed to find rankings by query type:`, error);
      throw error;
    }
  }

  /**
   * Find top rankings
   */
  async findTopRankings(
    analysisId: string, 
    topN = 10
  ): Promise<SearchRanking[]> {
    const query = `
      SELECT * FROM search_rankings 
      WHERE analysis_id = $1 AND position IS NOT NULL AND position <= $2
      ORDER BY position ASC
    `;
    
    try {
      const result = await this.db.query(query, [analysisId, topN]);
      return result.rows.map(row => this.mapRowToRanking(row));
    } catch (error) {
      this.logger.error('Failed to find top rankings:', error);
      throw error;
    }
  }

  /**
   * Get ranking statistics
   */
  async getRankingStats(analysisId: string): Promise<{
    totalQueries: number;
    rankedQueries: number;
    avgPosition: number;
    top3Count: number;
    top10Count: number;
    notFoundCount: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_queries,
        COUNT(position) as ranked_queries,
        AVG(position) as avg_position,
        COUNT(CASE WHEN position <= 3 THEN 1 END) as top_3_count,
        COUNT(CASE WHEN position <= 10 THEN 1 END) as top_10_count,
        COUNT(CASE WHEN position IS NULL THEN 1 END) as not_found_count
      FROM search_rankings
      WHERE analysis_id = $1
    `;
    
    try {
      const result = await this.db.query(query, [analysisId]);
      const row = result.rows[0];
      
      return {
        totalQueries: parseInt(row.total_queries) || 0,
        rankedQueries: parseInt(row.ranked_queries) || 0,
        avgPosition: parseFloat(row.avg_position) || 0,
        top3Count: parseInt(row.top_3_count) || 0,
        top10Count: parseInt(row.top_10_count) || 0,
        notFoundCount: parseInt(row.not_found_count) || 0
      };
    } catch (error) {
      this.logger.error('Failed to get ranking stats:', error);
      throw error;
    }
  }

  /**
   * Get SERP feature statistics
   */
  async getSerpFeatureStats(analysisId: string): Promise<{
    featuredSnippets: number;
    knowledgePanels: number;
    peopleAlsoAsk: number;
    localPacks: number;
    shoppingResults: number;
  }> {
    const query = `
      SELECT 
        COUNT(CASE WHEN (serp_features->>'hasFeaturedSnippet')::boolean THEN 1 END) as featured_snippets,
        COUNT(CASE WHEN (serp_features->>'hasKnowledgePanel')::boolean THEN 1 END) as knowledge_panels,
        COUNT(CASE WHEN (serp_features->>'hasPeopleAlsoAsk')::boolean THEN 1 END) as people_also_ask,
        COUNT(CASE WHEN (serp_features->>'hasLocalPack')::boolean THEN 1 END) as local_packs,
        COUNT(CASE WHEN (serp_features->>'hasShoppingResults')::boolean THEN 1 END) as shopping_results
      FROM search_rankings
      WHERE analysis_id = $1
    `;
    
    try {
      const result = await this.db.query(query, [analysisId]);
      const row = result.rows[0];
      
      return {
        featuredSnippets: parseInt(row.featured_snippets) || 0,
        knowledgePanels: parseInt(row.knowledge_panels) || 0,
        peopleAlsoAsk: parseInt(row.people_also_ask) || 0,
        localPacks: parseInt(row.local_packs) || 0,
        shoppingResults: parseInt(row.shopping_results) || 0
      };
    } catch (error) {
      this.logger.error('Failed to get SERP feature stats:', error);
      throw error;
    }
  }

  /**
   * Find competitor rankings
   */
  async findCompetitorRankings(
    analysisId: string,
    competitorDomain: string
  ): Promise<Array<{ query: string; position: number }>> {
    const query = `
      SELECT query, competitor_positions->$2 as position
      FROM search_rankings
      WHERE analysis_id = $1 
        AND competitor_positions ? $2
        AND (competitor_positions->$2)::int IS NOT NULL
      ORDER BY (competitor_positions->$2)::int ASC
    `;
    
    try {
      const result = await this.db.query(query, [analysisId, competitorDomain]);
      return result.rows.map(row => ({
        query: row.query,
        position: parseInt(row.position)
      }));
    } catch (error) {
      this.logger.error('Failed to find competitor rankings:', error);
      throw error;
    }
  }

  /**
   * Delete rankings for an analysis
   */
  async deleteByAnalysisId(analysisId: string): Promise<number> {
    const query = 'DELETE FROM search_rankings WHERE analysis_id = $1';
    
    try {
      const result = await this.db.query(query, [analysisId]);
      return result.rowCount || 0;
    } catch (error) {
      this.logger.error(`Failed to delete rankings for analysis ${analysisId}:`, error);
      throw error;
    }
  }

  /**
   * Map database row to SearchRanking
   */
  private mapRowToRanking(row: any): SearchRanking {
    return {
      id: row.id,
      analysisId: row.analysis_id,
      query: row.query,
      queryType: row.query_type as QueryType,
      position: row.position,
      urlFound: row.url_found,
      serpFeatures: typeof row.serp_features === 'string' 
        ? JSON.parse(row.serp_features) 
        : row.serp_features,
      competitorPositions: typeof row.competitor_positions === 'string'
        ? JSON.parse(row.competitor_positions)
        : row.competitor_positions,
      createdAt: row.created_at
    };
  }
}
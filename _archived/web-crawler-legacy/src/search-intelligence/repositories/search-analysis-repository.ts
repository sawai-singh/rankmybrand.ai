/**
 * Search Analysis Repository
 * Handles database operations for search analyses
 */

import { Pool } from 'pg';
import { Logger } from '../../utils/logger.js';
import {
  SearchAnalysis,
  SearchAnalysisStatus,
  SearchAnalysisMetadata,
  AuthorityScore
} from '../types/search-intelligence.types.js';

export class SearchAnalysisRepository {
  private logger: Logger;

  constructor(private db: Pool) {
    this.logger = new Logger('SearchAnalysisRepository');
  }

  /**
   * Create a new search analysis
   */
  async create(data: {
    brand: string;
    domain: string;
    crawlJobId?: string;
    status: SearchAnalysisStatus;
    metadata?: SearchAnalysisMetadata;
  }): Promise<SearchAnalysis> {
    const query = `
      INSERT INTO search_analyses 
      (brand, domain, crawl_job_id, status, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      data.brand,
      data.domain,
      data.crawlJobId || null,
      data.status,
      JSON.stringify(data.metadata || {})
    ];

    try {
      const result = await this.db.query(query, values);
      return this.mapRowToAnalysis(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to create search analysis:', error);
      throw error;
    }
  }

  /**
   * Find analysis by ID
   */
  async findById(id: string): Promise<SearchAnalysis | null> {
    const query = 'SELECT * FROM search_analyses WHERE id = $1';
    
    try {
      const result = await this.db.query(query, [id]);
      return result.rows.length > 0 ? this.mapRowToAnalysis(result.rows[0]) : null;
    } catch (error) {
      this.logger.error(`Failed to find analysis ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find analyses by domain
   */
  async findByDomain(domain: string, limit = 10): Promise<SearchAnalysis[]> {
    const query = `
      SELECT * FROM search_analyses 
      WHERE domain = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    
    try {
      const result = await this.db.query(query, [domain, limit]);
      return result.rows.map(row => this.mapRowToAnalysis(row));
    } catch (error) {
      this.logger.error(`Failed to find analyses for domain ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Find analyses by crawl job ID
   */
  async findByCrawlJobId(crawlJobId: string): Promise<SearchAnalysis[]> {
    const query = `
      SELECT * FROM search_analyses 
      WHERE crawl_job_id = $1 
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await this.db.query(query, [crawlJobId]);
      return result.rows.map(row => this.mapRowToAnalysis(row));
    } catch (error) {
      this.logger.error(`Failed to find analyses for crawl job ${crawlJobId}:`, error);
      throw error;
    }
  }

  /**
   * Update analysis
   */
  async update(id: string, data: Partial<SearchAnalysis>): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic update query
    if (data.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(data.status);
    }

    if (data.totalQueries !== undefined) {
      updates.push(`total_queries = $${paramCount++}`);
      values.push(data.totalQueries);
    }

    if (data.queriesCompleted !== undefined) {
      updates.push(`queries_completed = $${paramCount++}`);
      values.push(data.queriesCompleted);
    }

    if (data.visibilityScore !== undefined) {
      updates.push(`visibility_score = $${paramCount++}`);
      values.push(data.visibilityScore);
    }

    if (data.authorityScore !== undefined) {
      updates.push(`authority_score = $${paramCount++}`);
      values.push(data.authorityScore);
    }

    if (data.completedAt !== undefined) {
      updates.push(`completed_at = $${paramCount++}`);
      values.push(data.completedAt);
    }

    if (data.errorMessage !== undefined) {
      updates.push(`error_message = $${paramCount++}`);
      values.push(data.errorMessage);
    }

    if (data.metadata !== undefined) {
      updates.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(data.metadata));
    }

    if (updates.length === 0) return;

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE search_analyses 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
    `;

    try {
      await this.db.query(query, values);
    } catch (error) {
      this.logger.error(`Failed to update analysis ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get recent analyses
   */
  async getRecent(limit = 20): Promise<SearchAnalysis[]> {
    const query = `
      SELECT * FROM search_analyses 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    
    try {
      const result = await this.db.query(query, [limit]);
      return result.rows.map(row => this.mapRowToAnalysis(row));
    } catch (error) {
      this.logger.error('Failed to get recent analyses:', error);
      throw error;
    }
  }

  /**
   * Get analyses by status
   */
  async getByStatus(status: SearchAnalysisStatus, limit = 100): Promise<SearchAnalysis[]> {
    const query = `
      SELECT * FROM search_analyses 
      WHERE status = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    
    try {
      const result = await this.db.query(query, [status, limit]);
      return result.rows.map(row => this.mapRowToAnalysis(row));
    } catch (error) {
      this.logger.error(`Failed to get analyses by status ${status}:`, error);
      throw error;
    }
  }

  /**
   * Get analysis statistics
   */
  async getStatistics(): Promise<{
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
    avgVisibilityScore: number;
    avgQueriesPerAnalysis: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status IN ('pending', 'generating_queries', 'checking_rankings', 
                                   'analyzing_mentions', 'analyzing_competitors', 
                                   'calculating_scores') THEN 1 END) as in_progress,
        AVG(CASE WHEN visibility_score IS NOT NULL THEN visibility_score END) as avg_visibility_score,
        AVG(CASE WHEN total_queries > 0 THEN total_queries END) as avg_queries_per_analysis
      FROM search_analyses
    `;
    
    try {
      const result = await this.db.query(query);
      const row = result.rows[0];
      
      return {
        total: parseInt(row.total) || 0,
        completed: parseInt(row.completed) || 0,
        failed: parseInt(row.failed) || 0,
        inProgress: parseInt(row.in_progress) || 0,
        avgVisibilityScore: parseFloat(row.avg_visibility_score) || 0,
        avgQueriesPerAnalysis: parseFloat(row.avg_queries_per_analysis) || 0
      };
    } catch (error) {
      this.logger.error('Failed to get statistics:', error);
      throw error;
    }
  }

  /**
   * Delete old analyses
   */
  async deleteOldAnalyses(daysToKeep = 30): Promise<number> {
    const query = `
      DELETE FROM search_analyses 
      WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
      AND status IN ('completed', 'failed', 'cancelled')
    `;
    
    try {
      const result = await this.db.query(query);
      return result.rowCount || 0;
    } catch (error) {
      this.logger.error('Failed to delete old analyses:', error);
      throw error;
    }
  }

  /**
   * Map database row to SearchAnalysis
   */
  private mapRowToAnalysis(row: any): SearchAnalysis {
    return {
      id: row.id,
      crawlJobId: row.crawl_job_id,
      brand: row.brand,
      domain: row.domain,
      status: row.status as SearchAnalysisStatus,
      totalQueries: row.total_queries || 0,
      queriesCompleted: row.queries_completed || 0,
      visibilityScore: row.visibility_score ? parseFloat(row.visibility_score) : undefined,
      authorityScore: row.authority_score as AuthorityScore,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      errorMessage: row.error_message,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    };
  }
}
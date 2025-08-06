import { pool, query, withTransaction } from '../index.js';
import { CrawlJob, CrawlConfig, CrawlResult, GEOScores, Recommendation } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { createHash } from 'crypto';

export class CrawlJobRepository {
  static async create(domain: string, config: CrawlConfig): Promise<CrawlJob> {
    const result = await query<CrawlJob>(
      `INSERT INTO crawl_jobs (domain, config, pages_limit) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [domain, JSON.stringify(config), config.maxPages]
    );
    
    return result.rows[0];
  }

  static async findById(id: string): Promise<CrawlJob | null> {
    const result = await query<CrawlJob>(
      'SELECT * FROM crawl_jobs WHERE id = $1',
      [id]
    );
    
    return result.rows[0] || null;
  }

  static async findByDomain(domain: string, limit: number = 10): Promise<CrawlJob[]> {
    const result = await query<CrawlJob>(
      `SELECT * FROM crawl_jobs 
       WHERE domain = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [domain, limit]
    );
    
    return result.rows;
  }

  static async updateStatus(
    id: string, 
    status: 'pending' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    const updates: Record<string, any> = { status };
    
    if (status === 'processing') {
      updates.started_at = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date();
    }
    
    const setClauses = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    await query(
      `UPDATE crawl_jobs SET ${setClauses} WHERE id = $1`,
      [id, ...Object.values(updates)]
    );
  }

  static async incrementPagesCrawled(id: string): Promise<void> {
    await query(
      'UPDATE crawl_jobs SET pages_crawled = pages_crawled + 1 WHERE id = $1',
      [id]
    );
  }

  static async incrementErrors(id: string, error?: any): Promise<void> {
    await query(
      `UPDATE crawl_jobs 
       SET error_count = error_count + 1,
           last_error = $2
       WHERE id = $1`,
      [id, error ? JSON.stringify(error) : null]
    );
  }

  static async getActiveJobs(): Promise<CrawlJob[]> {
    const result = await query<CrawlJob>(
      `SELECT * FROM crawl_jobs 
       WHERE status IN ('pending', 'processing') 
       ORDER BY created_at ASC`
    );
    
    return result.rows;
  }

  static async getRecentJobs(limit: number = 20): Promise<CrawlJob[]> {
    const result = await query<CrawlJob>(
      `SELECT * FROM crawl_jobs 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  }

  static async getStats(jobId: string): Promise<any> {
    const result = await query(
      `SELECT 
        COUNT(*) as total_pages,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN render_method = 'dynamic' THEN 1 END) as js_rendered_pages,
        AVG((geo_scores->>'overall')::float) as avg_geo_score,
        MAX(crawled_at) as last_crawled
       FROM crawled_pages
       WHERE crawl_job_id = $1`,
      [jobId]
    );
    
    return result.rows[0];
  }
}

export class CrawledPageRepository {
  static async create(
    jobId: string,
    result: CrawlResult,
    scores: GEOScores,
    recommendations: Recommendation[]
  ): Promise<void> {
    const urlHash = this.hashUrl(result.url);
    const contentHash = this.hashContent(JSON.stringify(result));
    
    await query(
      `INSERT INTO crawled_pages (
        crawl_job_id, url, url_hash, content_hash,
        render_method, response_time_ms, word_count,
        geo_scores, extraction_data, recommendations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (crawl_job_id, url_hash) 
      DO UPDATE SET
        content_hash = EXCLUDED.content_hash,
        render_method = EXCLUDED.render_method,
        response_time_ms = EXCLUDED.response_time_ms,
        word_count = EXCLUDED.word_count,
        geo_scores = EXCLUDED.geo_scores,
        extraction_data = EXCLUDED.extraction_data,
        recommendations = EXCLUDED.recommendations,
        crawled_at = NOW()`,
      [
        jobId,
        result.url,
        urlHash,
        contentHash,
        result.renderMethod,
        result.responseTimeMs,
        result.meta.wordCount,
        JSON.stringify(scores),
        JSON.stringify({
          citations: result.citations,
          statistics: result.statistics,
          quotations: result.quotations,
          fluency: result.fluency,
          authority: result.authority,
          relevance: result.relevance,
          meta: result.meta
        }),
        JSON.stringify(recommendations)
      ]
    );
  }

  static async findByJobId(
    jobId: string, 
    limit: number = 100, 
    offset: number = 0
  ): Promise<any[]> {
    const result = await query(
      `SELECT * FROM crawled_pages 
       WHERE crawl_job_id = $1 
       ORDER BY crawled_at DESC 
       LIMIT $2 OFFSET $3`,
      [jobId, limit, offset]
    );
    
    return result.rows;
  }

  static async findByUrl(url: string): Promise<any | null> {
    const urlHash = this.hashUrl(url);
    const result = await query(
      `SELECT * FROM crawled_pages 
       WHERE url_hash = $1 
       ORDER BY crawled_at DESC 
       LIMIT 1`,
      [urlHash]
    );
    
    return result.rows[0] || null;
  }

  static async getTopPerformingPages(
    jobId: string,
    metric: string = 'overall',
    limit: number = 10
  ): Promise<any[]> {
    const result = await query(
      `SELECT 
        url,
        geo_scores,
        recommendations,
        (geo_scores->>'${metric}')::float as score
       FROM crawled_pages 
       WHERE crawl_job_id = $1 
       ORDER BY (geo_scores->>'${metric}')::float DESC 
       LIMIT $2`,
      [jobId, limit]
    );
    
    return result.rows;
  }

  static async getAverageScores(jobId: string): Promise<any> {
    const result = await query(
      `SELECT 
        AVG((geo_scores->>'overall')::float) as avg_overall,
        AVG((geo_scores->>'citation')::float) as avg_citation,
        AVG((geo_scores->>'statistics')::float) as avg_statistics,
        AVG((geo_scores->>'quotation')::float) as avg_quotation,
        AVG((geo_scores->>'fluency')::float) as avg_fluency,
        AVG((geo_scores->>'authority')::float) as avg_authority,
        AVG((geo_scores->>'relevance')::float) as avg_relevance
       FROM crawled_pages 
       WHERE crawl_job_id = $1`,
      [jobId]
    );
    
    return result.rows[0];
  }

  static async getScoreDistribution(
    jobId: string,
    metric: string = 'overall'
  ): Promise<any[]> {
    const result = await query(
      `SELECT 
        CASE 
          WHEN (geo_scores->>'${metric}')::float >= 90 THEN '90-100'
          WHEN (geo_scores->>'${metric}')::float >= 80 THEN '80-89'
          WHEN (geo_scores->>'${metric}')::float >= 70 THEN '70-79'
          WHEN (geo_scores->>'${metric}')::float >= 60 THEN '60-69'
          WHEN (geo_scores->>'${metric}')::float >= 50 THEN '50-59'
          ELSE '0-49'
        END as range,
        COUNT(*) as count
       FROM crawled_pages 
       WHERE crawl_job_id = $1
       GROUP BY range
       ORDER BY range`,
      [jobId]
    );
    
    return result.rows;
  }

  private static hashUrl(url: string): string {
    return createHash('sha256').update(url).digest('hex');
  }

  private static hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

export class CrawlErrorRepository {
  static async create(
    jobId: string,
    url: string,
    errorType: string,
    errorMessage: string,
    errorDetails?: any
  ): Promise<void> {
    await query(
      `INSERT INTO crawl_errors (
        crawl_job_id, url, error_type, error_message, error_details
      ) VALUES ($1, $2, $3, $4, $5)`,
      [jobId, url, errorType, errorMessage, errorDetails ? JSON.stringify(errorDetails) : null]
    );
  }

  static async findByJobId(jobId: string, limit: number = 50): Promise<any[]> {
    const result = await query(
      `SELECT * FROM crawl_errors 
       WHERE crawl_job_id = $1 
       ORDER BY occurred_at DESC 
       LIMIT $2`,
      [jobId, limit]
    );
    
    return result.rows;
  }

  static async getErrorSummary(jobId: string): Promise<any[]> {
    const result = await query(
      `SELECT 
        error_type,
        COUNT(*) as count,
        MAX(occurred_at) as last_occurred
       FROM crawl_errors 
       WHERE crawl_job_id = $1
       GROUP BY error_type
       ORDER BY count DESC`,
      [jobId]
    );
    
    return result.rows;
  }
}

export class DomainStatisticsRepository {
  static async refresh(): Promise<void> {
    await query('REFRESH MATERIALIZED VIEW CONCURRENTLY domain_statistics');
  }

  static async getByDomain(domain: string): Promise<any | null> {
    const result = await query(
      'SELECT * FROM domain_statistics WHERE domain = $1',
      [domain]
    );
    
    return result.rows[0] || null;
  }

  static async getTopDomains(limit: number = 10): Promise<any[]> {
    const result = await query(
      `SELECT * FROM domain_statistics 
       ORDER BY avg_geo_score DESC 
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  }

  static async search(searchQuery: string, limit: number = 20): Promise<any[]> {
    const result = await query(
      `SELECT * FROM domain_statistics 
       WHERE domain ILIKE $1 
       ORDER BY last_crawled DESC 
       LIMIT $2`,
      [`%${searchQuery}%`, limit]
    );
    
    return result.rows;
  }
}

// Export all repositories
export const repositories = {
  crawlJob: CrawlJobRepository,
  crawledPage: CrawledPageRepository,
  crawlError: CrawlErrorRepository,
  domainStatistics: DomainStatisticsRepository
};

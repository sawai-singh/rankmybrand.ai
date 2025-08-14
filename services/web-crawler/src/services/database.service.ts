import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { CrawlJob, PageData } from '../types/crawler.types';

export class DatabaseService {
  private pool: Pool | null = null;
  
  async connect(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Test connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to database');
      throw error;
    }
    
    // Initialize tables if they don't exist
    await this.initializeTables();
  }
  
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database disconnected');
    }
  }
  
  private async initializeTables(): Promise<void> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Create crawl_jobs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS crawl_jobs (
          id VARCHAR(255) PRIMARY KEY,
          url TEXT NOT NULL,
          depth INTEGER NOT NULL DEFAULT 2,
          user_id VARCHAR(255),
          status VARCHAR(50) NOT NULL DEFAULT 'queued',
          pages_scanned INTEGER DEFAULT 0,
          duration INTEGER,
          error TEXT,
          results JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMPTZ
        )
      `);
      
      // Create crawl_results table
      await client.query(`
        CREATE TABLE IF NOT EXISTS crawl_results (
          id SERIAL PRIMARY KEY,
          job_id VARCHAR(255) REFERENCES crawl_jobs(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          title TEXT,
          description TEXT,
          keywords TEXT[],
          h1_tags TEXT[],
          h2_tags TEXT[],
          status_code INTEGER,
          content_type VARCHAR(255),
          size INTEGER,
          load_time INTEGER,
          structured_data JSONB,
          open_graph JSONB,
          crawled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(job_id, url)
        )
      `);
      
      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_crawl_jobs_user_id ON crawl_jobs(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON crawl_jobs(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_crawl_jobs_created_at ON crawl_jobs(created_at DESC)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_crawl_results_job_id ON crawl_results(job_id)');
      
      await client.query('COMMIT');
      logger.info('Database tables initialized');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error }, 'Failed to initialize database tables');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async createCrawlJob(job: Partial<CrawlJob>): Promise<CrawlJob> {
    const client = await this.getClient();
    
    try {
      const query = `
        INSERT INTO crawl_jobs (id, url, depth, user_id, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      const values = [
        job.id,
        job.url,
        job.depth || 2,
        job.userId || null,
        job.status || 'queued',
        job.createdAt || new Date(),
        job.updatedAt || new Date()
      ];
      
      const result = await client.query(query, values);
      return this.mapToCrawlJob(result.rows[0]);
    } finally {
      client.release();
    }
  }
  
  async getCrawlJob(jobId: string): Promise<CrawlJob | null> {
    const client = await this.getClient();
    
    try {
      const query = 'SELECT * FROM crawl_jobs WHERE id = $1';
      const result = await client.query(query, [jobId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapToCrawlJob(result.rows[0]);
    } finally {
      client.release();
    }
  }
  
  async updateCrawlJob(jobId: string, updates: Partial<CrawlJob>): Promise<void> {
    const client = await this.getClient();
    
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;
      
      if (updates.status !== undefined) {
        fields.push(`status = $${paramCount++}`);
        values.push(updates.status);
      }
      
      if (updates.pagesScanned !== undefined) {
        fields.push(`pages_scanned = $${paramCount++}`);
        values.push(updates.pagesScanned);
      }
      
      if (updates.duration !== undefined) {
        fields.push(`duration = $${paramCount++}`);
        values.push(updates.duration);
      }
      
      if (updates.error !== undefined) {
        fields.push(`error = $${paramCount++}`);
        values.push(updates.error);
      }
      
      if (updates.results !== undefined) {
        fields.push(`results = $${paramCount++}`);
        values.push(JSON.stringify(updates.results));
      }
      
      if (updates.completedAt !== undefined) {
        fields.push(`completed_at = $${paramCount++}`);
        values.push(updates.completedAt);
      }
      
      fields.push(`updated_at = $${paramCount++}`);
      values.push(new Date());
      
      values.push(jobId);
      
      const query = `
        UPDATE crawl_jobs 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
      `;
      
      await client.query(query, values);
    } finally {
      client.release();
    }
  }
  
  async storeCrawlResults(jobId: string, pages: PageData[]): Promise<void> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      for (const page of pages) {
        const query = `
          INSERT INTO crawl_results (
            job_id, url, title, description, keywords, h1_tags, h2_tags,
            status_code, content_type, size, load_time, structured_data,
            open_graph, crawled_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (job_id, url) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            keywords = EXCLUDED.keywords,
            h1_tags = EXCLUDED.h1_tags,
            h2_tags = EXCLUDED.h2_tags,
            status_code = EXCLUDED.status_code,
            content_type = EXCLUDED.content_type,
            size = EXCLUDED.size,
            load_time = EXCLUDED.load_time,
            structured_data = EXCLUDED.structured_data,
            open_graph = EXCLUDED.open_graph,
            crawled_at = EXCLUDED.crawled_at
        `;
        
        const values = [
          jobId,
          page.url,
          page.title,
          page.description,
          page.keywords,
          page.h1,
          page.h2,
          page.statusCode,
          page.contentType,
          page.size,
          page.loadTime,
          page.structuredData ? JSON.stringify(page.structuredData) : null,
          page.openGraph ? JSON.stringify(page.openGraph) : null,
          page.crawledAt
        ];
        
        await client.query(query, values);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error, jobId }, 'Failed to store crawl results');
      throw error;
    } finally {
      client.release();
    }
  }
  
  private async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool.connect();
  }
  
  private mapToCrawlJob(row: any): CrawlJob {
    return {
      id: row.id,
      url: row.url,
      depth: row.depth,
      userId: row.user_id,
      status: row.status,
      pagesScanned: row.pages_scanned,
      duration: row.duration,
      error: row.error,
      results: row.results,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at
    };
  }
  
  async storeSERPResults(results: any): Promise<void> {
    // Store SERP results in database
    const client = await this.getClient();
    
    try {
      await client.query(
        `INSERT INTO serp_results (query, platforms, results, analyzed_at)
         VALUES ($1, $2, $3, NOW())`,
        [results.query, JSON.stringify(results.platforms), JSON.stringify(results.results)]
      );
    } finally {
      client.release();
    }
  }
}
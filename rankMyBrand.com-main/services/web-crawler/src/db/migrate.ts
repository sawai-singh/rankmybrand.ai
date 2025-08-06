import { pool } from './index.js';
import { logger } from '../utils/logger.js';

const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Crawl jobs table
      CREATE TABLE IF NOT EXISTS crawl_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        domain VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        pages_crawled INTEGER DEFAULT 0,
        pages_limit INTEGER NOT NULL DEFAULT 500,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        config JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Create index on status for job queries
      CREATE INDEX idx_crawl_jobs_status ON crawl_jobs(status);
      CREATE INDEX idx_crawl_jobs_domain ON crawl_jobs(domain);
      CREATE INDEX idx_crawl_jobs_created ON crawl_jobs(created_at DESC);
      
      -- Crawled pages table
      CREATE TABLE IF NOT EXISTS crawled_pages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        crawl_job_id UUID REFERENCES crawl_jobs(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        url_hash VARCHAR(64) NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        render_method VARCHAR(20) NOT NULL,
        response_time_ms INTEGER,
        word_count INTEGER,
        geo_scores JSONB NOT NULL,
        extraction_data JSONB NOT NULL,
        recommendations JSONB,
        crawled_at TIMESTAMP DEFAULT NOW(),
        
        UNIQUE(crawl_job_id, url_hash)
      );
      
      -- Create indexes for crawled pages
      CREATE INDEX idx_crawled_pages_job_id ON crawled_pages(crawl_job_id);
      CREATE INDEX idx_crawled_pages_url_hash ON crawled_pages(url_hash);
      CREATE INDEX idx_crawled_pages_scores ON crawled_pages USING GIN (geo_scores);
      CREATE INDEX idx_crawled_pages_crawled_at ON crawled_pages(crawled_at DESC);
      
      -- Domain statistics table (materialized view)
      CREATE MATERIALIZED VIEW IF NOT EXISTS domain_statistics AS
      SELECT 
        j.domain,
        COUNT(DISTINCT p.id) as total_pages,
        AVG((p.geo_scores->>'overall')::float) as avg_geo_score,
        AVG((p.geo_scores->>'citation')::float) as avg_citation_score,
        AVG((p.geo_scores->>'statistics')::float) as avg_statistics_score,
        AVG((p.geo_scores->>'quotation')::float) as avg_quotation_score,
        AVG((p.geo_scores->>'fluency')::float) as avg_fluency_score,
        AVG((p.geo_scores->>'authority')::float) as avg_authority_score,
        AVG((p.geo_scores->>'relevance')::float) as avg_relevance_score,
        MAX(p.crawled_at) as last_crawled
      FROM crawl_jobs j
      JOIN crawled_pages p ON j.id = p.crawl_job_id
      WHERE j.status = 'completed'
      GROUP BY j.domain;
      
      -- Create index on materialized view
      CREATE INDEX idx_domain_statistics_domain ON domain_statistics(domain);
      
      -- Refresh function for materialized view
      CREATE OR REPLACE FUNCTION refresh_domain_statistics()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY domain_statistics;
      END;
      $$ LANGUAGE plpgsql;

      -- Update timestamp trigger
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER update_crawl_jobs_updated_at
        BEFORE UPDATE ON crawl_jobs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    `,
    down: `
      DROP TRIGGER IF EXISTS update_crawl_jobs_updated_at ON crawl_jobs;
      DROP FUNCTION IF EXISTS update_updated_at();
      DROP FUNCTION IF EXISTS refresh_domain_statistics();
      DROP MATERIALIZED VIEW IF EXISTS domain_statistics;
      DROP TABLE IF EXISTS crawled_pages;
      DROP TABLE IF EXISTS crawl_jobs;
    `
  },
  {
    version: 2,
    name: 'add_error_tracking',
    up: `
      -- Add error tracking to crawl jobs
      ALTER TABLE crawl_jobs 
      ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_error JSONB;

      -- Add error details to crawled pages
      ALTER TABLE crawled_pages
      ADD COLUMN IF NOT EXISTS error_message TEXT,
      ADD COLUMN IF NOT EXISTS error_code VARCHAR(50);

      -- Create errors table for detailed tracking
      CREATE TABLE IF NOT EXISTS crawl_errors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        crawl_job_id UUID REFERENCES crawl_jobs(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        error_type VARCHAR(100) NOT NULL,
        error_message TEXT NOT NULL,
        error_details JSONB,
        occurred_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_crawl_errors_job_id ON crawl_errors(crawl_job_id);
      CREATE INDEX idx_crawl_errors_type ON crawl_errors(error_type);
      CREATE INDEX idx_crawl_errors_occurred ON crawl_errors(occurred_at DESC);
    `,
    down: `
      DROP TABLE IF EXISTS crawl_errors;
      ALTER TABLE crawled_pages 
      DROP COLUMN IF EXISTS error_message,
      DROP COLUMN IF EXISTS error_code;
      ALTER TABLE crawl_jobs 
      DROP COLUMN IF EXISTS error_count,
      DROP COLUMN IF EXISTS last_error;
    `
  },
  {
    version: 3,
    name: 'add_api_keys',
    up: `
      -- API keys table
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        permissions JSONB NOT NULL DEFAULT '{"read": true, "write": true}',
        rate_limit INTEGER DEFAULT 100,
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      );

      CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
      CREATE INDEX idx_api_keys_active ON api_keys(is_active);

      -- API usage tracking
      CREATE TABLE IF NOT EXISTS api_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        status_code INTEGER,
        response_time_ms INTEGER,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_api_usage_key_id ON api_usage(api_key_id);
      CREATE INDEX idx_api_usage_created ON api_usage(created_at DESC);
    `,
    down: `
      DROP TABLE IF EXISTS api_usage;
      DROP TABLE IF EXISTS api_keys;
    `
  },
  {
    version: 4,
    name: 'add_search_intelligence',
    up: `
      -- Search analyses table
      CREATE TABLE IF NOT EXISTS search_analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brand VARCHAR(255) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        crawl_job_id UUID REFERENCES crawl_jobs(id) ON DELETE SET NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        total_queries INTEGER DEFAULT 0,
        completed_queries INTEGER DEFAULT 0,
        visibility_score FLOAT,
        authority_score FLOAT,
        ai_prediction_score FLOAT,
        config JSONB NOT NULL DEFAULT '{}',
        metadata JSONB NOT NULL DEFAULT '{}',
        results JSONB,
        error_message TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_search_analyses_status ON search_analyses(status);
      CREATE INDEX idx_search_analyses_domain ON search_analyses(domain);
      CREATE INDEX idx_search_analyses_crawl_job ON search_analyses(crawl_job_id);
      CREATE INDEX idx_search_analyses_created ON search_analyses(created_at DESC);

      -- Search rankings table
      CREATE TABLE IF NOT EXISTS search_rankings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_id UUID REFERENCES search_analyses(id) ON DELETE CASCADE,
        query VARCHAR(512) NOT NULL,
        query_type VARCHAR(50) NOT NULL,
        position INTEGER,
        url_found TEXT,
        serp_features JSONB DEFAULT '{}',
        ai_relevance_score FLOAT,
        expected_difficulty INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_search_rankings_analysis ON search_rankings(analysis_id);
      CREATE INDEX idx_search_rankings_position ON search_rankings(position);
      CREATE INDEX idx_search_rankings_query_type ON search_rankings(query_type);

      -- Brand mentions table
      CREATE TABLE IF NOT EXISTS brand_mentions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_id UUID REFERENCES search_analyses(id) ON DELETE CASCADE,
        query VARCHAR(512) NOT NULL,
        url TEXT NOT NULL,
        domain VARCHAR(255) NOT NULL,
        position INTEGER NOT NULL,
        mention_type VARCHAR(50) NOT NULL,
        context TEXT,
        sentiment VARCHAR(20),
        authority_score FLOAT,
        domain_authority FLOAT,
        authority_tier INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_brand_mentions_analysis ON brand_mentions(analysis_id);
      CREATE INDEX idx_brand_mentions_domain ON brand_mentions(domain);
      CREATE INDEX idx_brand_mentions_sentiment ON brand_mentions(sentiment);
      CREATE INDEX idx_brand_mentions_authority_tier ON brand_mentions(authority_tier);
      CREATE INDEX idx_brand_mentions_domain_authority ON brand_mentions(domain_authority DESC);

      -- Competitor analyses table
      CREATE TABLE IF NOT EXISTS competitor_analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_id UUID REFERENCES search_analyses(id) ON DELETE CASCADE,
        competitor_domain VARCHAR(255) NOT NULL,
        average_position FLOAT,
        visibility_score FLOAT,
        common_queries INTEGER,
        brand_queries INTEGER,
        win_rate FLOAT,
        strengths JSONB,
        weaknesses JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_competitor_analyses_analysis ON competitor_analyses(analysis_id);
      CREATE INDEX idx_competitor_analyses_domain ON competitor_analyses(competitor_domain);
      CREATE INDEX idx_competitor_analyses_visibility ON competitor_analyses(visibility_score DESC);

      -- Update timestamp triggers for new tables
      CREATE TRIGGER update_search_analyses_updated_at
        BEFORE UPDATE ON search_analyses
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
    `,
    down: `
      DROP TRIGGER IF EXISTS update_search_analyses_updated_at ON search_analyses;
      DROP TABLE IF EXISTS competitor_analyses;
      DROP TABLE IF EXISTS brand_mentions;
      DROP TABLE IF EXISTS search_rankings;
      DROP TABLE IF EXISTS search_analyses;
    `
  }
];

// Migration history table
const createMigrationTable = `
  CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
  );
`;

export async function runMigrations(): Promise<void> {
  try {
    // Create migrations table
    await pool.query(createMigrationTable);
    
    // Get applied migrations
    const result = await pool.query<{ version: number }>(
      'SELECT version FROM migrations ORDER BY version'
    );
    const appliedVersions = new Set(result.rows.map(row => row.version));
    
    // Run pending migrations
    for (const migration of migrations) {
      if (!appliedVersions.has(migration.version)) {
        logger.info(`Running migration ${migration.version}: ${migration.name}`);
        
        await pool.query('BEGIN');
        try {
          await pool.query(migration.up);
          await pool.query(
            'INSERT INTO migrations (version, name) VALUES ($1, $2)',
            [migration.version, migration.name]
          );
          await pool.query('COMMIT');
          
          logger.info(`Migration ${migration.version} completed`);
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }
      }
    }
    
    logger.info('All migrations completed');
  } catch (error) {
    logger.error('Migration failed', error);
    throw error;
  }
}

export async function rollbackMigration(version: number): Promise<void> {
  const migration = migrations.find(m => m.version === version);
  if (!migration) {
    throw new Error(`Migration version ${version} not found`);
  }
  
  try {
    logger.info(`Rolling back migration ${migration.version}: ${migration.name}`);
    
    await pool.query('BEGIN');
    await pool.query(migration.down);
    await pool.query('DELETE FROM migrations WHERE version = $1', [version]);
    await pool.query('COMMIT');
    
    logger.info(`Migration ${migration.version} rolled back`);
  } catch (error) {
    await pool.query('ROLLBACK');
    logger.error(`Rollback failed for migration ${version}`, error);
    throw error;
  }
}

// Run migrations if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed', error);
      process.exit(1);
    });
}

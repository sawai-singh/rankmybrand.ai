-- Migration: Add Search Intelligence tables
-- Version: 004
-- Description: Add tables for search intelligence analysis, rankings, mentions, and competitor tracking

-- Add search intelligence options to existing crawl_jobs table
ALTER TABLE crawl_jobs 
ADD COLUMN IF NOT EXISTS include_search_intel BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS search_intel_options JSONB DEFAULT '{}';

-- Create search_analyses table
CREATE TABLE IF NOT EXISTS search_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_job_id UUID REFERENCES crawl_jobs(id),
  brand VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  total_queries INTEGER DEFAULT 0,
  queries_completed INTEGER DEFAULT 0,
  visibility_score DECIMAL(5,2),
  authority_score VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Create search_rankings table
CREATE TABLE IF NOT EXISTS search_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES search_analyses(id) ON DELETE CASCADE,
  query VARCHAR(500) NOT NULL,
  query_type VARCHAR(50), -- 'product', 'brand', 'service', 'comparison'
  position INTEGER, -- null if not found in top 20
  url_found VARCHAR(500),
  serp_features JSONB, -- featured snippets, knowledge panel, etc
  competitor_positions JSONB DEFAULT '{}', -- {"competitorA.com": 2, "competitorB.com": 5}
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(analysis_id, query)
);

-- Create brand_mentions table
CREATE TABLE IF NOT EXISTS brand_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES search_analyses(id) ON DELETE CASCADE,
  source_url VARCHAR(500) NOT NULL,
  source_domain VARCHAR(255) NOT NULL,
  authority_tier INTEGER CHECK (authority_tier IN (1, 2, 3)),
  domain_authority INTEGER, -- 0-100 score
  mention_context TEXT,
  mention_type VARCHAR(50), -- 'article', 'review', 'news', 'directory'
  published_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create competitor_analyses table
CREATE TABLE IF NOT EXISTS competitor_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES search_analyses(id) ON DELETE CASCADE,
  competitor_domain VARCHAR(255) NOT NULL,
  avg_position DECIMAL(4,2),
  top_3_count INTEGER DEFAULT 0,
  top_10_count INTEGER DEFAULT 0,
  not_found_count INTEGER DEFAULT 0,
  visibility_score DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_analyses_crawl_job_id ON search_analyses(crawl_job_id);
CREATE INDEX IF NOT EXISTS idx_search_analyses_status ON search_analyses(status);
CREATE INDEX IF NOT EXISTS idx_search_analyses_domain ON search_analyses(domain);

CREATE INDEX IF NOT EXISTS idx_search_rankings_analysis_id ON search_rankings(analysis_id);
CREATE INDEX IF NOT EXISTS idx_search_rankings_position ON search_rankings(position) WHERE position IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_rankings_query_type ON search_rankings(query_type);

CREATE INDEX IF NOT EXISTS idx_brand_mentions_analysis_id ON brand_mentions(analysis_id);
CREATE INDEX IF NOT EXISTS idx_brand_mentions_authority ON brand_mentions(authority_tier, domain_authority);
CREATE INDEX IF NOT EXISTS idx_brand_mentions_source_domain ON brand_mentions(source_domain);

CREATE INDEX IF NOT EXISTS idx_competitor_analyses_analysis_id ON competitor_analyses(analysis_id);
CREATE INDEX IF NOT EXISTS idx_competitor_analyses_competitor_domain ON competitor_analyses(competitor_domain);

-- Add trigger to update search_analyses.updated_at
CREATE OR REPLACE FUNCTION update_search_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_search_analyses_updated_at
BEFORE UPDATE ON search_analyses
FOR EACH ROW
EXECUTE FUNCTION update_search_analyses_updated_at();
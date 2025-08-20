-- Migration: Add metadata columns to ai_queries table
-- Purpose: Support enhanced query categorization and performance tracking

-- Add new columns for query metadata
ALTER TABLE ai_queries 
ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS intent VARCHAR(50),
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS persona VARCHAR(50),
ADD COLUMN IF NOT EXISTS platform_optimization VARCHAR(20),
ADD COLUMN IF NOT EXISTS expected_serp_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS specificity_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS commercial_value VARCHAR(10);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_queries_category ON ai_queries(category);
CREATE INDEX IF NOT EXISTS idx_ai_queries_priority ON ai_queries(priority DESC);
CREATE INDEX IF NOT EXISTS idx_ai_queries_company_category ON ai_queries(company_id, category);

-- Add performance tracking columns
ALTER TABLE ai_queries
ADD COLUMN IF NOT EXISTS times_searched INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS brand_appeared INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_position DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS sentiment_positive DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS sentiment_neutral DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS sentiment_negative DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP;

-- Create a view for query category distribution
CREATE OR REPLACE VIEW query_category_distribution AS
SELECT 
    company_id,
    category,
    COUNT(*) as query_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY company_id), 2) as percentage,
    SUM(CASE WHEN priority >= 8 THEN 1 ELSE 0 END) as high_priority_count,
    AVG(priority) as avg_priority
FROM ai_queries
WHERE category IS NOT NULL
GROUP BY company_id, category;

-- Create a view for query performance summary
CREATE OR REPLACE VIEW query_performance_summary AS
SELECT 
    company_id,
    COUNT(*) as total_queries,
    SUM(CASE WHEN category = 'problem_unaware' THEN 1 ELSE 0 END) as problem_unaware_count,
    SUM(CASE WHEN category = 'solution_seeking' THEN 1 ELSE 0 END) as solution_seeking_count,
    SUM(CASE WHEN category = 'brand_specific' THEN 1 ELSE 0 END) as brand_specific_count,
    SUM(CASE WHEN category = 'comparison' THEN 1 ELSE 0 END) as comparison_count,
    SUM(CASE WHEN category = 'purchase_intent' THEN 1 ELSE 0 END) as purchase_intent_count,
    SUM(CASE WHEN category = 'use_case' THEN 1 ELSE 0 END) as use_case_count,
    AVG(priority) as avg_priority,
    SUM(CASE WHEN commercial_value = 'high' THEN 1 ELSE 0 END) as high_value_queries,
    SUM(times_searched) as total_searches,
    SUM(brand_appeared) as total_brand_appearances,
    AVG(average_position) as overall_avg_position
FROM ai_queries
GROUP BY company_id;

-- Add comments for documentation
COMMENT ON COLUMN ai_queries.category IS 'Query category: problem_unaware, solution_seeking, brand_specific, comparison, purchase_intent, use_case';
COMMENT ON COLUMN ai_queries.intent IS 'Search intent: informational, commercial, transactional, navigational, investigational';
COMMENT ON COLUMN ai_queries.priority IS 'Query priority score from 1-10 based on commercial value';
COMMENT ON COLUMN ai_queries.persona IS 'Target persona for this query';
COMMENT ON COLUMN ai_queries.platform_optimization IS 'Primary AI platform this query targets';
COMMENT ON COLUMN ai_queries.specificity_level IS 'Query specificity: broad, medium, long_tail';
COMMENT ON COLUMN ai_queries.commercial_value IS 'Commercial value assessment: high, medium, low';
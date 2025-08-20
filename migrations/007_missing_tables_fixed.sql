-- Create missing tables with correct types
-- This fixes type mismatches and creates only what's missing

-- 1. Search rankings table (for SERP tracking)
CREATE TABLE IF NOT EXISTS search_rankings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    position INTEGER,
    url TEXT,
    title TEXT,
    snippet TEXT,
    platform VARCHAR(50), -- google, bing, etc
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, query_text, platform, checked_at)
);

-- 2. Brand mentions table (for citation tracking)
CREATE TABLE IF NOT EXISTS brand_mentions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    source_url TEXT,
    source_platform VARCHAR(50), -- chatgpt, claude, perplexity, etc
    mention_text TEXT,
    sentiment VARCHAR(20), -- positive, negative, neutral
    context TEXT,
    mention_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. AI platform scores table (for real platform data)
CREATE TABLE IF NOT EXISTS ai_platform_scores (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- chatgpt, claude, perplexity, gemini, etc
    score NUMERIC(5,2),
    visibility_score NUMERIC(5,2),
    citation_count INTEGER DEFAULT 0,
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, platform, last_checked)
);

-- 4. SERP analyses table (for search analysis results)
CREATE TABLE IF NOT EXISTS serp_analyses (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50),
    platform_scores JSONB,
    share_of_voice NUMERIC(5,2),
    sentiment JSONB,
    citation_count INTEGER,
    competitors JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Content gaps table (for tracking missing content)
CREATE TABLE IF NOT EXISTS content_gaps (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    gap_type VARCHAR(50),
    description TEXT,
    priority INTEGER DEFAULT 5,
    competitor_id INTEGER REFERENCES companies(id),
    identified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_search_rankings_company ON search_rankings(company_id);
CREATE INDEX IF NOT EXISTS idx_search_rankings_query ON search_rankings(query_text);
CREATE INDEX IF NOT EXISTS idx_search_rankings_checked ON search_rankings(checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_mentions_company ON brand_mentions(company_id);
CREATE INDEX IF NOT EXISTS idx_brand_mentions_platform ON brand_mentions(source_platform);
CREATE INDEX IF NOT EXISTS idx_brand_mentions_date ON brand_mentions(mention_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_platform_scores_company ON ai_platform_scores(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_platform_scores_platform ON ai_platform_scores(platform);
CREATE INDEX IF NOT EXISTS idx_ai_platform_scores_checked ON ai_platform_scores(last_checked DESC);

CREATE INDEX IF NOT EXISTS idx_serp_analyses_company ON serp_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_serp_analyses_created ON serp_analyses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_gaps_company ON content_gaps(company_id);
CREATE INDEX IF NOT EXISTS idx_content_gaps_priority ON content_gaps(priority DESC);

-- Add comments for documentation
COMMENT ON TABLE search_rankings IS 'Tracks search engine ranking positions for queries';
COMMENT ON TABLE brand_mentions IS 'Stores brand mentions and citations from AI platforms';
COMMENT ON TABLE ai_platform_scores IS 'Real-time visibility scores from AI platforms';
COMMENT ON TABLE serp_analyses IS 'Search engine results page analysis data';
COMMENT ON TABLE content_gaps IS 'Identified content opportunities and gaps';

-- Grant permissions (adjust as needed)
GRANT ALL ON search_rankings TO sawai;
GRANT ALL ON brand_mentions TO sawai;
GRANT ALL ON ai_platform_scores TO sawai;
GRANT ALL ON serp_analyses TO sawai;
GRANT ALL ON content_gaps TO sawai;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sawai;
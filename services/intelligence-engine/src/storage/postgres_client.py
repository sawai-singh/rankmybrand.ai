"""PostgreSQL client for Intelligence Engine."""

import asyncio
import asyncpg
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from contextlib import asynccontextmanager
from src.config import settings
from src.models.schemas import (
    ProcessedResponse,
    BrandMention,
    GEOScore,
    ContentGap
)

logger = logging.getLogger(__name__)


class PostgresClient:
    """Async PostgreSQL client."""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
    
    async def initialize(self):
        """Initialize connection pool with production-ready settings."""
        self.pool = await asyncpg.create_pool(
            host=settings.postgres_host,
            port=settings.postgres_port,
            database=settings.postgres_db,
            user=settings.postgres_user,
            password=settings.postgres_password,
            min_size=2,  # Reduced min size for better resource usage
            max_size=settings.postgres_pool_size,
            command_timeout=10,
            max_queries=1000,  # Reduced from 50000 - prevents connection exhaustion
            max_cacheable_statement_size=16384,  # Enable statement caching for performance
            max_inactive_connection_lifetime=300.0  # Close idle connections after 5 minutes
        )
        
        # Create schema if not exists
        await self.create_schema()
    
    async def close(self):
        """Close connection pool."""
        if self.pool:
            await self.pool.close()
    
    @asynccontextmanager
    async def acquire(self):
        """Acquire a connection from the pool."""
        async with self.pool.acquire() as connection:
            yield connection
    
    async def create_schema(self):
        """Create database schema."""
        async with self.acquire() as conn:
            # Create schema
            await conn.execute("""
                CREATE SCHEMA IF NOT EXISTS intelligence
            """)
            
            # Create tables
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS intelligence.brand_mentions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    response_id UUID NOT NULL,
                    brand_id UUID NOT NULL,
                    mention_text TEXT NOT NULL,
                    sentiment_score FLOAT,
                    sentiment_label VARCHAR(20),
                    confidence FLOAT,
                    position INTEGER,
                    context TEXT,
                    platform VARCHAR(50),
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS intelligence.geo_scores (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    brand_id UUID NOT NULL,
                    platform VARCHAR(50) NOT NULL,
                    score FLOAT NOT NULL,
                    share_of_voice FLOAT,
                    citation_frequency FLOAT,
                    sentiment_average FLOAT,
                    relevance_average FLOAT,
                    authority_average FLOAT,
                    calculated_at TIMESTAMPTZ DEFAULT NOW(),
                    period_start TIMESTAMPTZ,
                    period_end TIMESTAMPTZ,
                    sample_size INTEGER DEFAULT 0
                )
            """)
            
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS intelligence.content_gaps (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    brand_id UUID NOT NULL,
                    gap_type VARCHAR(50) NOT NULL,
                    description TEXT NOT NULL,
                    priority INTEGER DEFAULT 5,
                    query_examples TEXT[],
                    competitor_advantage FLOAT,
                    estimated_impact FLOAT,
                    detected_at TIMESTAMPTZ DEFAULT NOW(),
                    resolved_at TIMESTAMPTZ
                )
            """)
            
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS intelligence.citation_sources (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    domain VARCHAR(255) NOT NULL UNIQUE,
                    url TEXT,
                    authority_score FLOAT,
                    citation_count INTEGER DEFAULT 1,
                    last_cited TIMESTAMPTZ DEFAULT NOW(),
                    is_competitor BOOLEAN DEFAULT FALSE,
                    is_owned BOOLEAN DEFAULT FALSE
                )
            """)
            
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS intelligence.processed_responses (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    response_id VARCHAR NOT NULL UNIQUE,
                    platform VARCHAR(50) NOT NULL,
                    prompt TEXT,
                    geo_score FLOAT,
                    share_of_voice FLOAT,
                    citation_frequency FLOAT,
                    sentiment_score FLOAT,
                    relevance_score FLOAT,
                    authority_score FLOAT,
                    processed_at TIMESTAMPTZ DEFAULT NOW(),
                    processing_time_ms INTEGER
                )
            """)
            
            # Create indexes
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_brand_mentions_brand 
                ON intelligence.brand_mentions(brand_id)
            """)
            
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_geo_scores_brand_platform 
                ON intelligence.geo_scores(brand_id, platform)
            """)
            
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_gaps_brand_priority 
                ON intelligence.content_gaps(brand_id, priority)
            """)
    
    async def save_processed_response(self, response: ProcessedResponse) -> str:
        """Save processed response to database."""
        async with self.acquire() as conn:
            # Save main response record
            result = await conn.fetchrow("""
                INSERT INTO intelligence.processed_responses 
                (response_id, platform, prompt, geo_score, share_of_voice, 
                 citation_frequency, sentiment_score, relevance_score, 
                 authority_score, processed_at, processing_time_ms)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (response_id) DO UPDATE
                SET geo_score = EXCLUDED.geo_score,
                    share_of_voice = EXCLUDED.share_of_voice,
                    processed_at = EXCLUDED.processed_at
                RETURNING id
            """, 
            response.response_id,
            response.platform,
            response.prompt[:1000],  # Truncate long prompts
            response.geo_score,
            response.share_of_voice,
            response.citation_frequency,
            response.sentiment.score if response.sentiment else 0.0,
            response.relevance.score if response.relevance else 0.0,
            response.authority_score,
            response.processed_at,
            response.processing_time_ms
            )
            
            return str(result['id'])
    
    async def save_brand_mentions(self, mentions: List[BrandMention], response_id: str):
        """Save brand mentions to database."""
        if not mentions:
            return
        
        async with self.acquire() as conn:
            # Prepare batch insert, skip records without brand_id
            values = []
            for mention in mentions:
                if not mention.brand_id:
                    logger.error(f"Skipping mention without brand_id: {mention.mention_text[:50]}")
                    continue
                    
                values.append((
                    response_id,
                    mention.brand_id,
                    mention.mention_text[:1000],
                    mention.sentiment_score,
                    mention.sentiment_label,
                    mention.confidence,
                    mention.position,
                    mention.context[:2000] if mention.context else None,
                    mention.platform
                ))
            
            # Batch insert
            await conn.executemany("""
                INSERT INTO intelligence.brand_mentions
                (response_id, brand_id, mention_text, sentiment_score,
                 sentiment_label, confidence, position, context, platform)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, values)
    
    async def save_geo_score(self, score: GEOScore):
        """Save GEO score to database."""
        async with self.acquire() as conn:
            await conn.execute("""
                INSERT INTO intelligence.geo_scores
                (brand_id, platform, score, share_of_voice, citation_frequency,
                 sentiment_average, relevance_average, authority_average,
                 period_start, period_end, sample_size)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            """,
            score.brand_id,
            score.platform,
            score.score,
            score.share_of_voice,
            score.citation_frequency,
            score.sentiment_average,
            score.relevance_average,
            score.authority_average,
            score.period_start,
            score.period_end,
            score.sample_size
            )
    
    async def save_content_gaps(self, gaps: List[ContentGap], brand_id: str):
        """Save content gaps to database."""
        if not gaps:
            return
        
        async with self.acquire() as conn:
            # Prepare batch insert
            values = []
            for gap in gaps:
                values.append((
                    brand_id,
                    gap.type,
                    gap.description[:1000],
                    gap.priority,
                    gap.query_examples[:10],  # Limit array size
                    gap.competitor_advantage,
                    gap.estimated_impact
                ))
            
            # Batch insert
            await conn.executemany("""
                INSERT INTO intelligence.content_gaps
                (brand_id, gap_type, description, priority,
                 query_examples, competitor_advantage, estimated_impact)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """, values)
    
    async def update_citation_source(self, domain: str, authority_score: float):
        """Update or insert citation source."""
        async with self.acquire() as conn:
            await conn.execute("""
                INSERT INTO intelligence.citation_sources
                (domain, authority_score, citation_count, last_cited)
                VALUES ($1, $2, 1, NOW())
                ON CONFLICT (domain) DO UPDATE
                SET citation_count = intelligence.citation_sources.citation_count + 1,
                    last_cited = NOW(),
                    authority_score = EXCLUDED.authority_score
            """, domain, authority_score)
    
    async def get_recent_geo_scores(
        self,
        brand_id: str,
        platform: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get recent GEO scores for a brand."""
        async with self.acquire() as conn:
            query = """
                SELECT * FROM intelligence.geo_scores
                WHERE brand_id = $1
            """
            params = [brand_id]
            
            if platform:
                query += " AND platform = $2"
                params.append(platform)
            
            query += " ORDER BY calculated_at DESC LIMIT $" + str(len(params) + 1)
            params.append(limit)
            
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_brand_mentions(
        self,
        brand_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict]:
        """Get brand mentions within date range."""
        async with self.acquire() as conn:
            query = """
                SELECT * FROM intelligence.brand_mentions
                WHERE brand_id = $1
            """
            params = [brand_id]
            
            if start_date:
                query += f" AND created_at >= ${len(params) + 1}"
                params.append(start_date)
            
            if end_date:
                query += f" AND created_at <= ${len(params) + 1}"
                params.append(end_date)
            
            query += " ORDER BY created_at DESC"
            
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_content_gaps(
        self,
        brand_id: str,
        min_priority: int = 5,
        unresolved_only: bool = True
    ) -> List[Dict]:
        """Get content gaps for a brand."""
        async with self.acquire() as conn:
            query = """
                SELECT * FROM intelligence.content_gaps
                WHERE brand_id = $1 AND priority >= $2
            """
            params = [brand_id, min_priority]
            
            if unresolved_only:
                query += " AND resolved_at IS NULL"
            
            query += " ORDER BY priority DESC, detected_at DESC"
            
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_processing_stats(self) -> Dict:
        """Get processing statistics."""
        async with self.acquire() as conn:
            stats = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as total_processed,
                    AVG(processing_time_ms) as avg_processing_time,
                    MAX(processing_time_ms) as max_processing_time,
                    MIN(processing_time_ms) as min_processing_time,
                    AVG(geo_score) as avg_geo_score,
                    AVG(share_of_voice) as avg_sov
                FROM intelligence.processed_responses
                WHERE processed_at > NOW() - INTERVAL '24 hours'
            """)
            
            return dict(stats) if stats else {}
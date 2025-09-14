"""AI Visibility API Routes - Generate and manage AI queries for companies."""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging
import asyncio
from datetime import datetime
import asyncpg
import os
import json

from src.core.analysis.query_generator import IntelligentQueryGenerator, QueryContext
from src.core.services.service import AIVisibilityService
from src.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/ai-visibility",
    tags=["AI Visibility"]
)

# Database connection
async def get_db_connection():
    """Get database connection."""
    return await asyncpg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
        user='sawai',  # Use the actual user since postgres user doesn't exist
        password=''
    )

class GenerateQueriesRequest(BaseModel):
    """Request model for query generation."""
    company_id: int
    company_name: str
    domain: str
    industry: str
    description: str
    competitors: List[str] = []
    products_services: List[str] = []
    force_regenerate: bool = False
    # Enhanced generation fields
    prompt: Optional[str] = None
    use_enhanced_generation: bool = False
    query_count: int = 48
    include_metadata: bool = False

class QueryResponse(BaseModel):
    """Response model for generated queries."""
    id: str
    query_text: str
    intent: str
    buyer_journey_stage: str
    priority: str
    relevance_score: float
    complexity_score: float
    category: str

@router.post("/generate-queries")
async def generate_queries(
    request: GenerateQueriesRequest,
    background_tasks: BackgroundTasks
):
    """Generate AI visibility queries for a company."""
    try:
        logger.info(f"Generating queries for company: {request.company_name} (ID: {request.company_id})")
        
        # Check if queries already exist and not forcing regeneration
        if not request.force_regenerate:
            conn = await get_db_connection()
            try:
                result = await conn.fetchrow(
                    "SELECT COUNT(*) as count FROM ai_queries WHERE company_id = $1",
                    request.company_id
                )
                if result and result['count'] > 0:
                    logger.info(f"Queries already exist for company {request.company_id}")
                    existing_queries = await conn.fetch(
                        """SELECT id, query_text, intent, buyer_journey_stage, 
                           priority, relevance_score, complexity_score, category
                           FROM ai_queries WHERE company_id = $1
                           ORDER BY relevance_score DESC LIMIT 50""",
                        request.company_id
                    )
                    return {
                        "status": "existing",
                        "message": f"Found {len(existing_queries)} existing queries",
                        "queries": [dict(q) for q in existing_queries]
                    }
            finally:
                await conn.close()
        
        # Create query context
        context = QueryContext(
            company_name=request.company_name,
            industry=request.industry,
            sub_industry=None,
            description=request.description,
            unique_value_propositions=[],
            target_audiences=[],
            competitors=request.competitors,
            products_services=request.products_services,
            pain_points_solved=[],
            geographic_markets=[],
            technology_stack=None,
            pricing_model=None,
            company_size=None,
            founding_year=None,
            key_features=[],
            use_cases=[],
            integrations=None,
            certifications=None
        )
        
        # Initialize query generator
        generator = IntelligentQueryGenerator(openai_api_key=settings.openai_api_key)
        
        # Generate queries - use enhanced prompt if provided
        if request.use_enhanced_generation and request.prompt:
            logger.info(f"Using enhanced generation with custom prompt for company {request.company_id}")
            # Generate using the enhanced prompt directly
            queries = await generator.generate_enhanced_queries(
                prompt=request.prompt,
                query_count=request.query_count,
                include_metadata=request.include_metadata
            )
        else:
            # Generate using standard method
            queries = await generator.generate_queries(context)
        
        # Save queries to database
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                # Debug: Check current database
                cursor.execute("SELECT current_database()")
                db_name = cursor.fetchone()
                logger.info(f"Connected to database: {db_name['current_database']}")
                
                # Debug: Check if ai_queries table exists
                cursor.execute("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_queries')")
                table_exists = cursor.fetchone()
                logger.info(f"Table ai_queries exists: {table_exists['exists']}")
                for query in queries:
                    # Map buyer journey stage to our category system
                    category_mapping = {
                        'problem_unaware': 'problem_unaware',
                        'awareness': 'problem_unaware',
                        'solution_seeking': 'solution_seeking',
                        'consideration': 'solution_seeking',
                        'brand_specific': 'brand_specific',
                        'evaluation': 'comparison',
                        'comparison': 'comparison',
                        'purchase': 'purchase_intent',
                        'decision': 'purchase_intent',
                        'use_case': 'use_case'
                    }
                    category = category_mapping.get(query.buyer_journey_stage, 'solution_seeking')
                    
                    # Determine priority based on query characteristics
                    priority = int(query.priority_score * 10) if query.priority_score else 5
                    
                    cursor.execute(
                        """INSERT INTO ai_queries 
                           (report_id, company_id, query_id, query_text, intent, 
                            buyer_journey_stage, complexity_score, competitive_relevance,
                            priority_score, semantic_variations, expected_serp_features,
                            persona_alignment, industry_specificity, created_at,
                            category, priority)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                           ON CONFLICT (id) DO NOTHING""",
                        (
                            f"manual_{request.company_id}_{datetime.now().strftime('%Y%m%d')}",
                            request.company_id,
                            query.query_id,
                            query.query_text,
                            query.intent.value,
                            query.buyer_journey_stage,
                            query.complexity_score,
                            query.competitive_relevance,
                            query.priority_score,
                            json.dumps(query.semantic_variations),
                            json.dumps(query.expected_serp_features),
                            query.persona_alignment,
                            query.industry_specificity,
                            datetime.now(),
                            category,
                            priority
                        )
                    )
                conn.commit()
                logger.info(f"Saved {len(queries)} queries for company {request.company_id}")
        finally:
            conn.close()
        
        # Return generated queries
        return {
            "status": "success",
            "message": f"Generated {len(queries)} queries",
            "queries": [
                {
                    "query_text": q.query_text,
                    "intent": q.intent.value,
                    "buyer_journey_stage": q.buyer_journey_stage,
                    "priority": q.priority_score,
                    "relevance_score": q.priority_score,
                    "complexity_score": q.complexity_score,
                    "category": getattr(q, 'category', 'general')
                }
                for q in queries[:50]  # Return top 50
            ]
        }
        
    except Exception as e:
        logger.error(f"Error generating queries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/company/{company_id}/queries")
async def get_company_queries(company_id: int):
    """Get all queries for a company."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """SELECT id, query_text, intent, buyer_journey_stage, 
                       priority, relevance_score, complexity_score, category,
                       created_at
                       FROM ai_queries 
                       WHERE company_id = %s
                       ORDER BY relevance_score DESC""",
                    (company_id,)
                )
                queries = cursor.fetchall()
                
                return {
                    "company_id": company_id,
                    "total_queries": len(queries),
                    "queries": queries
                }
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Error fetching queries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/company/{company_id}/queries")
async def delete_company_queries(company_id: int):
    """Delete all queries for a company."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM ai_queries WHERE company_id = %s",
                    (company_id,)
                )
                deleted_count = cursor.rowcount
                conn.commit()
                
                return {
                    "status": "success",
                    "deleted_count": deleted_count
                }
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Error deleting queries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Health check for AI visibility service."""
    return {
        "status": "healthy",
        "service": "ai-visibility",
        "openai_configured": bool(settings.openai_api_key)
    }
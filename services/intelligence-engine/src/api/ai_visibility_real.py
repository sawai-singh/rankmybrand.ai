"""AI Visibility Routes - Generate REAL queries using enhanced IntelligentQueryGenerator"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging
import json
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from src.config import settings
import hashlib
import redis.asyncio as redis
import uuid
import asyncio
from src.core.analysis.query_generator import IntelligentQueryGenerator, BuyerJourneyCategory

logger = logging.getLogger(__name__)

# Initialize query generator (will be set in function)
query_generator = None

router = APIRouter(
    prefix="/api/ai-visibility",
    tags=["AI Visibility"]
)

def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
        user='sawai',
        password='',
        cursor_factory=RealDictCursor
    )

class GenerateQueriesRequest(BaseModel):
    company_id: int
    company_name: str
    domain: str
    industry: str
    description: str
    competitors: List[str] = []
    products_services: List[str] = []
    force_regenerate: bool = False
    use_enhanced_generation: bool = True
    query_count: int = 48
    include_metadata: bool = False

class AuditRequest(BaseModel):
    email: str
    company_name: str
    company_type: str

@router.post("/generate-queries")
async def generate_queries(
    request: GenerateQueriesRequest,
    background_tasks: BackgroundTasks
):
    """
    Generate AI visibility queries using enhanced IntelligentQueryGenerator.

    This endpoint uses the merged implementation combining:
    - Implementation A's 6 buyer-journey categories
    - Implementation A's comprehensive prompt engineering (voice search, local, long-tail)
    - Implementation B's sophisticated query generation
    - Complete database integration and job queueing
    """

    logger.info(f"Generating AI queries for {request.company_name} (ID: {request.company_id})")

    # Check if queries already exist
    if not request.force_regenerate:
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT COUNT(*) as count FROM ai_queries WHERE company_id = %s",
                    (request.company_id,)
                )
                result = cursor.fetchone()
                if result and result['count'] > 0:
                    logger.info(f"Queries already exist for company {request.company_id}")
                    return {
                        "status": "existing",
                        "message": f"Found {result['count']} existing queries",
                        "company_id": request.company_id
                    }
        finally:
            conn.close()

    # Initialize query generator
    global query_generator
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    if query_generator is None:
        query_generator = IntelligentQueryGenerator(
            openai_api_key=settings.openai_api_key,
            model="gpt-5-nano"
        )

    try:
        # Generate queries using the unified method (single-shot by default, falls back to multi-phase)
        logger.info(f"Using IntelligentQueryGenerator.generate_queries() for {request.company_name}")

        generated_queries = await query_generator.generate_queries(
            company_name=request.company_name,
            domain=request.domain,
            industry=request.industry,
            description=request.description,
            competitors=request.competitors or [],
            products_services=request.products_services or [],
            target_count=request.query_count
        )

        if not generated_queries:
            raise HTTPException(
                status_code=500,
                detail="Query generation returned no results"
            )

        logger.info(f"Generated {len(generated_queries)} queries, saving to database...")

        # Save queries to database
        conn = get_db_connection()
        saved_count = 0

        try:
            with conn.cursor() as cursor:
                for generated_query in generated_queries:
                    # Map buyer journey to category string
                    category = generated_query.buyer_journey_stage

                    cursor.execute(
                        """INSERT INTO ai_queries
                           (report_id, company_id, query_id, query_text, category, intent, priority, created_at)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                           ON CONFLICT DO NOTHING""",
                        (
                            f"merged_{request.company_id}_{datetime.now().strftime('%Y%m%d')}",
                            request.company_id,
                            generated_query.query_id,
                            generated_query.query_text,
                            category,
                            generated_query.intent.value,
                            int(generated_query.priority_score * 10),  # Convert 0-1 to 1-10
                            datetime.now()
                        )
                    )
                    saved_count += cursor.rowcount

                conn.commit()
                logger.info(f"Saved {saved_count} queries for company {request.company_id}")

                # Create audit job for processing these queries
                audit_id = str(uuid.uuid4())
                report_id = f"merged_{request.company_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

                # Create audit record in database
                cursor.execute(
                    """INSERT INTO ai_visibility_audits
                       (id, company_id, company_name, status, query_count, created_at, report_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                    (
                        audit_id,
                        request.company_id,
                        request.company_name,
                        'pending',
                        saved_count,
                        datetime.now(),
                        report_id
                    )
                )
                conn.commit()

        finally:
            conn.close()

        # Trigger job processor via Redis queue
        try:
            redis_client = await redis.from_url(settings.redis_url or "redis://localhost:6379")

            job_data = {
                "auditId": audit_id,
                "companyId": request.company_id,
                "userId": "api_user",
                "queryCount": saved_count,
                "providers": ["openai_gpt5", "anthropic_claude", "google_gemini", "perplexity"],
                "config": {
                    "company_name": request.company_name,
                    "domain": request.domain,
                    "industry": request.industry
                }
            }

            # Push job to Redis queue in BullMQ format
            bull_job = {
                "id": audit_id,
                "data": job_data,
                "timestamp": datetime.now().isoformat()
            }
            await redis_client.lpush("bull:ai-visibility-audit:wait", json.dumps(bull_job))
            logger.info(f"Queued audit job {audit_id} for processing")

            await redis_client.close()

        except Exception as redis_error:
            logger.error(f"Failed to queue job for processing: {redis_error}")
            # Continue anyway - queries are saved

        return {
            "status": "success",
            "message": f"Generated and saved {saved_count} AI queries using unified generation",
            "company_id": request.company_id,
            "audit_id": audit_id,
            "report_id": report_id,
            "model": "gpt-5-nano",
            "method": "IntelligentQueryGenerator.generate_queries() [single-shot with multi-phase fallback]",
            "features": [
                "6 buyer-journey categories",
                "Voice search patterns",
                "Local variations",
                "Long-tail keywords",
                "Multi-format queries",
                "Retry logic with exponential backoff",
                "Automatic fallback to sophisticated generation"
            ],
            "processing": "Job queued for AI platform analysis"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating queries: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Query generation failed: {str(e)}"
        )

@router.post("/audit")
async def create_audit(request: AuditRequest):
    """Create and process an AI visibility audit."""
    logger.info(f"Creating audit for {request.company_name} (email: {request.email})")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Get or create user
            cursor.execute(
                "SELECT id FROM users WHERE email = %s",
                (request.email,)
            )
            user = cursor.fetchone()

            if not user:
                cursor.execute(
                    "INSERT INTO users (email, first_name) VALUES (%s, %s) RETURNING id",
                    (request.email, request.email.split('@')[0])
                )
                user = cursor.fetchone()
                conn.commit()

            user_id = user['id']

            # Get or create company
            cursor.execute(
                "SELECT id FROM companies WHERE name = %s",
                (request.company_name,)
            )
            company = cursor.fetchone()

            if not company:
                cursor.execute(
                    "INSERT INTO companies (name, domain, industry) VALUES (%s, %s, %s) RETURNING id",
                    (request.company_name, f"{request.company_name.lower().replace(' ', '')}.com", request.company_type)
                )
                company = cursor.fetchone()
                conn.commit()

            company_id = company['id']

            # Create audit
            audit_id = f"audit_{request.company_name.lower().replace(' ', '_')}_{uuid.uuid4().hex[:8]}"

            cursor.execute(
                """INSERT INTO ai_visibility_audits
                   (id, company_id, company_name, status, created_at)
                   VALUES (%s, %s, %s, %s, %s)""",
                (audit_id, company_id, request.company_name, 'processing', datetime.now())
            )
            conn.commit()

            # Generate queries using the existing endpoint logic
            queries_request = GenerateQueriesRequest(
                company_id=company_id,
                company_name=request.company_name,
                domain=f"{request.company_name.lower().replace(' ', '')}.com",
                industry=request.company_type,
                description=f"A company in the {request.company_type} industry",
                query_count=48
            )

            # Call the generate_queries function
            from fastapi import BackgroundTasks
            bg_tasks = BackgroundTasks()
            result = await generate_queries(queries_request, bg_tasks)

            return {
                "status": "success",
                "audit_id": audit_id,
                "company_id": company_id,
                "message": f"Audit created and processing started for {request.company_name}",
                **result
            }

    except Exception as e:
        logger.error(f"Error creating audit: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/health")
async def health_check():
    """Health check for AI visibility service."""
    return {
        "status": "healthy",
        "service": "ai-visibility-unified",
        "openai_configured": bool(settings.openai_api_key),
        "model": "gpt-5-nano",
        "implementation": "IntelligentQueryGenerator (unified single-shot with multi-phase fallback)"
    }

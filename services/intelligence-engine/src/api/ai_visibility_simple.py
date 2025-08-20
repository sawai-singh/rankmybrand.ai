"""AI Visibility Routes - Generate and save queries to database"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging
import json
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from src.config import settings

logger = logging.getLogger(__name__)

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
    prompt: str = None
    use_enhanced_generation: bool = False
    query_count: int = 48
    include_metadata: bool = False

@router.post("/generate-queries")
async def generate_queries(
    request: GenerateQueriesRequest,
    background_tasks: BackgroundTasks
):
    """Generate AI visibility queries for a company."""
    
    logger.info(f"Generating queries for {request.company_name} (ID: {request.company_id})")
    
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
    
    # Generate 48 queries across 6 categories with realistic text
    category_templates = {
        "problem_unaware": [
            f"how to improve team productivity in {request.industry}",
            f"why are projects always delayed",
            f"dealing with inefficient workflows",
            f"solving communication gaps in teams",
            f"reducing operational costs {request.industry}",
            f"managing remote team challenges",
            f"preventing project scope creep",
            f"handling resource allocation issues"
        ],
        "solution_seeking": [
            f"best {request.industry.lower()} software solutions",
            f"top project management tools 2024",
            f"leading {request.industry.lower()} platforms",
            f"software for {request.industry.lower()} companies",
            f"cloud solutions for {request.industry.lower()}",
            f"automation tools for businesses",
            f"collaborative platforms for teams",
            f"enterprise {request.industry.lower()} systems",
            f"SaaS solutions for startups",
            f"digital transformation tools {request.industry.lower()}"
        ],
        "brand_specific": [
            f"{request.company_name} reviews",
            f"is {request.company_name} worth it",
            f"{request.company_name} pricing",
            f"{request.company_name} features",
            f"how to use {request.company_name}",
            f"{request.company_name} customer testimonials",
            f"{request.company_name} case studies",
            f"{request.company_name} implementation guide"
        ],
        "comparison": [
            f"{request.company_name} vs {request.competitors[0] if request.competitors else 'competitors'}",
            f"alternatives to {request.competitors[0] if request.competitors else 'market leaders'}",
            f"{request.company_name} comparison",
            f"best {request.industry.lower()} tool comparison",
            f"which {request.industry.lower()} platform is better",
            f"{request.company_name} competitor analysis",
            f"switching from {request.competitors[0] if request.competitors else 'other solutions'}",
            f"{request.industry.lower()} software comparison 2024"
        ],
        "purchase_intent": [
            f"{request.company_name} pricing plans",
            f"how much does {request.industry.lower()} software cost",
            f"{request.company_name} free trial",
            f"buy {request.company_name} subscription",
            f"{request.company_name} discount code",
            f"getting started with {request.company_name}",
            f"{request.company_name} onboarding process",
            f"{request.company_name} ROI calculator"
        ],
        "use_case": [
            f"{request.company_name} for small businesses",
            f"{request.industry.lower()} solution for enterprises",
            f"{request.company_name} for remote teams",
            f"using {request.company_name} for project management",
            f"{request.company_name} integration with other tools",
            f"{request.company_name} for {request.industry.lower()} industry"
        ]
    }
    
    # Save queries to database
    conn = get_db_connection()
    saved_count = 0
    
    try:
        with conn.cursor() as cursor:
            for category, templates in category_templates.items():
                priority = 7 if category == "brand_specific" else 5
                
                for i, template in enumerate(templates):
                    # Determine intent based on category
                    intent = "navigational" if category == "brand_specific" else \
                             "transactional" if category == "purchase_intent" else \
                             "commercial" if category == "comparison" else "informational"
                    
                    import hashlib
                    query_id = hashlib.md5(f"{request.company_id}_{template}_{i}".encode()).hexdigest()[:12]
                    
                    cursor.execute(
                        """INSERT INTO ai_queries 
                           (report_id, company_id, query_id, query_text, category, intent, priority, created_at)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                           ON CONFLICT DO NOTHING""",
                        (
                            f"auto_{request.company_id}_{datetime.now().strftime('%Y%m%d')}",
                            request.company_id,
                            query_id,
                            template,
                            category,
                            intent,
                            priority,
                            datetime.now()
                        )
                    )
                    saved_count += cursor.rowcount
            
            conn.commit()
            logger.info(f"Saved {saved_count} queries for company {request.company_id}")
            
    except Exception as e:
        logger.error(f"Error saving queries: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
    
    return {
        "status": "success",
        "message": f"Generated and saved {saved_count} queries",
        "company_id": request.company_id
    }
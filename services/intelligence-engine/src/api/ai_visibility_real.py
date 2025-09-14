"""AI Visibility Routes - Generate REAL queries using GPT-4"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging
import json
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from src.config import settings
from openai import OpenAI
import hashlib
import os
import redis.asyncio as redis
import uuid
import asyncio

logger = logging.getLogger(__name__)

# Initialize OpenAI client (will be set in function)
client = None

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
    """Generate AI visibility queries using real GPT-4."""
    
    logger.info(f"Generating real AI queries for {request.company_name} (ID: {request.company_id})")
    
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
    
    # Initialize OpenAI client with API key
    global client
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    if client is None:
        client = OpenAI(api_key=settings.openai_api_key)
    
    # Build context for GPT-4
    context = f"""
    Company: {request.company_name}
    Domain: {request.domain}
    Industry: {request.industry}
    Description: {request.description}
    Competitors: {', '.join(request.competitors) if request.competitors else 'Not specified'}
    Products/Services: {', '.join(request.products_services) if request.products_services else 'Not specified'}
    """
    
    # Create the prompt for GPT-4
    prompt = f"""
    You are an AI visibility expert. Generate exactly 48 search queries that potential customers would use 
    to find {request.company_name} or similar solutions in the {request.industry} industry.
    
    Context:
    {context}
    
    Generate queries across these 6 categories (8 queries each):
    
    1. PROBLEM_UNAWARE (8 queries): Users experiencing problems but don't know solutions exist
    2. SOLUTION_SEEKING (8 queries): Users actively looking for solutions in this space
    3. BRAND_SPECIFIC (8 queries): Users specifically searching for {request.company_name}
    4. COMPARISON (8 queries): Users comparing solutions and alternatives
    5. PURCHASE_INTENT (8 queries): Users ready to buy or sign up
    6. USE_CASE (8 queries): Users looking for specific applications
    
    Requirements:
    - Make queries realistic and natural
    - Include long-tail keywords
    - Vary query length (2-8 words)
    - Include questions, statements, and keyword combinations
    - Be specific to the {request.industry} industry
    - Consider voice search patterns
    - Include "near me" and local variations where relevant
    
    Return as JSON array with exactly 48 objects, each containing:
    {{
        "query": "the search query",
        "category": "category_name",
        "intent": "informational|navigational|commercial|transactional",
        "priority": 1-10
    }}
    """
    
    try:
        # Call GPT-5 chat latest to generate queries
        response = client.chat.completions.create(
            model="gpt-5-chat-latest",
            messages=[
                {"role": "system", "content": "You are an AI visibility and SEO expert. Generate realistic search queries."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        
        # Parse the response
        queries_text = response.choices[0].message.content
        
        # Try to extract JSON from the response
        import re
        json_match = re.search(r'\[.*\]', queries_text, re.DOTALL)
        if json_match:
            queries_json = json.loads(json_match.group())
        else:
            # If no JSON found, try to parse the entire response
            queries_json = json.loads(queries_text)
        
        # Save queries to database
        conn = get_db_connection()
        saved_count = 0
        
        try:
            with conn.cursor() as cursor:
                for query_data in queries_json:
                    query_id = hashlib.md5(
                        f"{request.company_id}_{query_data['query']}".encode()
                    ).hexdigest()[:12]
                    
                    cursor.execute(
                        """INSERT INTO ai_queries 
                           (report_id, company_id, query_id, query_text, category, intent, priority, created_at)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                           ON CONFLICT DO NOTHING""",
                        (
                            f"gpt4_{request.company_id}_{datetime.now().strftime('%Y%m%d')}",
                            request.company_id,
                            query_id,
                            query_data['query'],
                            query_data['category'].lower(),
                            query_data['intent'],
                            query_data['priority'],
                            datetime.now()
                        )
                    )
                    saved_count += cursor.rowcount
                
                conn.commit()
                logger.info(f"Saved {saved_count} real GPT-5 generated queries for company {request.company_id}")
                
                # Create audit job for processing these queries
                audit_id = str(uuid.uuid4())
                report_id = f"gpt5_{request.company_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                
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
                "userId": "api_user",  # You might want to get this from auth
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
            logger.info(f"Queued audit job {audit_id} for processing in BullMQ format")
            
            await redis_client.close()
            
        except Exception as redis_error:
            logger.error(f"Failed to queue job for processing: {redis_error}")
            # Continue anyway - queries are saved
        
        return {
            "status": "success",
            "message": f"Generated and saved {saved_count} real AI queries",
            "company_id": request.company_id,
            "audit_id": audit_id,
            "report_id": report_id,
            "model": "gpt-5-chat-latest",
            "processing": "Job queued for AI platform analysis"
        }
        
    except Exception as e:
        logger.error(f"Error generating queries: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        "service": "ai-visibility-real",
        "openai_configured": bool(settings.openai_api_key),
        "model": "gpt-5-chat-latest"
    }
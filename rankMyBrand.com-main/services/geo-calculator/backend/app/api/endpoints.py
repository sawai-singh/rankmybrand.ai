from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, HttpUrl
import asyncio
import uuid
import logging

from ..core.calculator import GEOCalculator
from ..database.db import get_db, GEOAnalysis
from ..models.schemas import GEORequest, GEOResponse, BatchRequest

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize calculator
calculator = GEOCalculator()

@router.post("/analyze", response_model=GEOResponse)
async def analyze_content(
    request: GEORequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Analyze content for GEO score."""
    try:
        result = await calculator.calculate_geo_score(
            url=str(request.url),
            content=request.content,
            brand_terms=request.brand_terms,
            target_queries=request.target_queries,
            check_ai_visibility=request.check_ai_visibility,
            db=db
        )
        
        return GEOResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze/batch")
async def batch_analyze(
    request: BatchRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Analyze multiple URLs in batch."""
    job_id = str(uuid.uuid4())
    
    # Validate batch size
    from ..config import settings, config
    max_batch_size = config.get('api.max_batch_size', 50)
    
    if len(request.urls) > max_batch_size:
        raise HTTPException(
            status_code=400, 
            detail=f"Batch size exceeds maximum of {max_batch_size} URLs"
        )
    
    # Start background processing
    background_tasks.add_task(
        process_batch_analysis,
        job_id,
        request.urls,
        db
    )
    
    return {
        "job_id": job_id,
        "status": "processing",
        "urls_count": len(request.urls),
        "estimated_time": len(request.urls) * 10  # 10 seconds per URL estimate
    }

@router.get("/analyze/batch/{job_id}")
async def get_batch_status(job_id: str):
    """Get status of a batch analysis job."""
    from ..core.batch_processor import BatchProcessor
    
    processor = BatchProcessor()
    status = processor.get_batch_status(job_id)
    
    if not status:
        # Try to get from job queue
        from ..core.job_queue import create_job_queue
        from ..config import settings
        
        queue = create_job_queue(settings.JOB_QUEUE_TYPE)
        job = await queue.get_job(job_id)
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {
            "job_id": job_id,
            "status": job.status.value,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "error": job.error
        }
    
    return status

@router.get("/analysis/{domain}")
async def get_domain_analysis(
    domain: str,
    db: Session = Depends(get_db)
):
    """Get latest analysis for a domain."""
    analysis = db.query(GEOAnalysis).filter_by(
        domain=domain
    ).order_by(GEOAnalysis.created_at.desc()).first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for domain")
    
    return {
        "domain": analysis.domain,
        "geo_score": analysis.geo_score,
        "metrics": analysis.metrics,
        "recommendations": analysis.recommendations,
        "analyzed_at": analysis.created_at
    }

@router.get("/trending")
async def get_trending_metrics(db: Session = Depends(get_db)):
    """Get trending GEO metrics across all analyses."""
    # Get recent analyses
    recent = db.query(GEOAnalysis).order_by(
        GEOAnalysis.created_at.desc()
    ).limit(100).all()
    
    if not recent:
        return {"message": "No data available"}
    
    # Calculate averages
    avg_scores = {
        'geo_score': sum(a.geo_score for a in recent) / len(recent),
        'statistics': sum(a.statistics_score for a in recent) / len(recent),
        'quotation': sum(a.quotation_score for a in recent) / len(recent),
        'fluency': sum(a.fluency_score for a in recent) / len(recent),
        'authority': sum(a.authority_score for a in recent) / len(recent),
        'relevance': sum(a.relevance_score for a in recent) / len(recent),
    }
    
    return {
        "sample_size": len(recent),
        "average_scores": avg_scores,
        "top_performers": [
            {
                "domain": a.domain,
                "score": a.geo_score
            }
            for a in sorted(recent, key=lambda x: x.geo_score, reverse=True)[:5]
        ]
    }

async def process_batch_analysis(job_id: str, urls: List[str], db: Session):
    """Process batch analysis in background."""
    from ..core.batch_processor import BatchProcessor
    from ..core.job_queue import Job, JobPriority
    
    # Create job
    job = Job(
        id=job_id,
        type='batch_geo_analysis',
        payload={
            'urls': urls,
            'batch_id': job_id,
            'check_ai_visibility': True
        },
        priority=JobPriority.NORMAL
    )
    
    # Process immediately (in production, this would be handled by job processor)
    processor = BatchProcessor()
    result = await processor.process_batch(job)
    
    # Store result in database or cache
    # In production, implement proper result storage
    logger.info(f"Batch {job_id} completed with {result['successful']} successes")

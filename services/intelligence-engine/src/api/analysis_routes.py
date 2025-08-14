"""Analysis API routes with LLM entity detection."""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from pydantic import BaseModel
from src.processors.response_processor import ResponseProcessor
from src.nlp.llm_entity_detector import LLMEntityDetector
from src.models.schemas import AIResponse
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analysis", tags=["analysis"])


class AnalysisRequest(BaseModel):
    """Request model for analysis endpoint."""
    text: str
    platform: str = "generic"
    customer_context: Dict[str, Any]
    competitor_responses: List[str] = []


class EntityDetectionRequest(BaseModel):
    """Request model for entity detection."""
    text: str
    brand_name: str
    brand_variations: List[str] = []
    industry: str = "General"
    competitors: List[str] = []
    customer_id: str


class VisibilityAnalysisRequest(BaseModel):
    """Request model for visibility analysis."""
    texts: List[str]
    brand_name: str
    brand_variations: List[str] = []
    industry: str = "General"
    competitors: List[str] = []


@router.post("/process")
async def process_response(request: AnalysisRequest):
    """
    Process AI response with customer-specific entity detection.
    
    Example:
    ```
    {
        "text": "Turing is revolutionizing remote work...",
        "platform": "perplexity",
        "customer_context": {
            "brand_name": "Turing",
            "brand_variations": ["Turing.com", "Turing AI"],
            "industry": "Tech staffing",
            "competitors": ["Toptal", "Andela"],
            "customer_id": "cust_123"
        }
    }
    ```
    """
    try:
        # Initialize processor with customer context
        processor = ResponseProcessor(customer_context=request.customer_context)
        
        # Create AI response object
        ai_response = AIResponse(
            id=f"resp_{request.customer_context.get('customer_id', 'unknown')}",
            platform=request.platform,
            prompt_text="",  # Not provided in this example
            response_text=request.text,
            citations=[],
            metadata={}
        )
        
        # Process with customer context
        result = await processor.process(
            ai_response,
            competitor_responses=request.competitor_responses,
            customer_context=request.customer_context
        )
        
        return {
            "success": True,
            "result": result.dict(),
            "processing_time_ms": result.processing_time_ms
        }
        
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detect-entities")
async def detect_entities(request: EntityDetectionRequest):
    """
    Detect entities for a specific brand using LLM.
    
    This endpoint uses OpenAI GPT-4 Turbo for dynamic entity detection
    instead of hardcoded patterns.
    """
    try:
        detector = LLMEntityDetector()
        
        customer_context = {
            "brand_name": request.brand_name,
            "brand_variations": request.brand_variations,
            "industry": request.industry,
            "competitors": request.competitors,
            "customer_id": request.customer_id
        }
        
        entities = await detector.detect(request.text, customer_context)
        
        return {
            "success": True,
            "entities": [e.dict() for e in entities],
            "count": len(entities),
            "brand_mentions": len([e for e in entities if e.type == "BRAND"]),
            "competitor_mentions": len([e for e in entities if e.type == "COMPETITOR"])
        }
        
    except Exception as e:
        logger.error(f"Entity detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/visibility-analysis")
async def analyze_visibility(request: VisibilityAnalysisRequest):
    """
    Analyze brand visibility across multiple texts.
    
    Returns aggregated metrics about brand presence and sentiment.
    """
    try:
        detector = LLMEntityDetector()
        
        customer_context = {
            "brand_name": request.brand_name,
            "brand_variations": request.brand_variations,
            "industry": request.industry,
            "competitors": request.competitors
        }
        
        result = await detector.analyze_visibility(
            request.texts,
            customer_context
        )
        
        return {
            "success": True,
            "analysis": result,
            "recommendation": _generate_recommendation(result)
        }
        
    except Exception as e:
        logger.error(f"Visibility analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _generate_recommendation(analysis: Dict) -> str:
    """Generate actionable recommendation based on visibility analysis."""
    score = analysis.get("visibility_score", 0)
    sentiment = analysis.get("average_sentiment", 0)
    
    if score < 30:
        return "Critical: Your brand has very low visibility. Focus on creating more content and increasing brand mentions."
    elif score < 60:
        if sentiment < 0:
            return "Improve: Moderate visibility but negative sentiment. Address customer concerns and improve brand perception."
        else:
            return "Grow: Good foundation with positive sentiment. Increase content frequency to boost visibility."
    else:
        if sentiment < 0:
            return "Reputation Risk: High visibility with negative sentiment. Immediate reputation management needed."
        else:
            return "Excellent: Strong visibility and positive sentiment. Maintain momentum and monitor competitors."


@router.get("/health")
async def health_check():
    """Check if analysis service is healthy."""
    return {
        "status": "healthy",
        "service": "intelligence-engine",
        "llm_enabled": True,
        "model": "gpt-4-turbo-preview"
    }
"""Analysis API routes with LLM entity detection."""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, field_validator
from src.processors.response_processor import ResponseProcessor
# NLP functionality now integrated into response_analyzer
from src.core.analysis.response_analyzer import UnifiedResponseAnalyzer
from src.models.schemas import AIResponse
from src.config import settings
from src.api.auth import get_current_user, check_rate_limit, require_customer_id, require_brand_id
from src.utils import cost_tracker
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analysis", tags=["analysis"])


class AnalysisRequest(BaseModel):
    """Request model for analysis endpoint."""
    text: str = Field(..., min_length=1, max_length=50000, description="Text to analyze (max 50KB)")
    platform: str = Field(default="generic", pattern="^[a-z_]+$", max_length=50)
    customer_context: Dict[str, Any] = Field(..., description="Customer context with brand_id and customer_id")
    competitor_responses: List[str] = Field(default=[], max_items=10)
    
    @field_validator('text')
    @classmethod
    def validate_text_length(cls, v):
        if len(v) > 50000:  # 50KB limit
            raise ValueError("Text exceeds maximum length of 50,000 characters")
        return v
    
    @field_validator('customer_context')
    @classmethod
    def validate_customer_context(cls, v):
        if 'customer_id' not in v:
            raise ValueError("customer_context must include customer_id")
        if 'brand_id' not in v:
            raise ValueError("customer_context must include brand_id")
        return v


class EntityDetectionRequest(BaseModel):
    """Request model for entity detection."""
    text: str = Field(..., min_length=1, max_length=50000)
    brand_name: str = Field(..., min_length=1, max_length=100)
    brand_variations: List[str] = Field(default=[], max_items=20)
    industry: str = Field(default="General", max_length=100)
    competitors: List[str] = Field(default=[], max_items=50)
    customer_id: str = Field(..., pattern="^[a-zA-Z0-9_-]+$", max_length=100)
    
    @field_validator('brand_variations', 'competitors')
    @classmethod
    def validate_list_items(cls, v):
        for item in v:
            if len(item) > 100:
                raise ValueError(f"List item '{item[:50]}...' exceeds maximum length of 100 characters")
        return v


class VisibilityAnalysisRequest(BaseModel):
    """Request model for visibility analysis."""
    texts: List[str]
    brand_name: str
    brand_variations: List[str] = []
    industry: str = "General"
    competitors: List[str] = []


class SentimentAnalysisRequest(BaseModel):
    """Request model for sentiment analysis."""
    text: str = Field(..., min_length=1, max_length=50000)
    brand_name: str = Field(default="", max_length=100)
    industry: str = Field(default="General", max_length=100)
    purpose: str = Field(
        default="general_analysis",
        pattern="^(general_analysis|customer_review|social_media|support_ticket)$"
    )
    customer_id: str = Field(default="", max_length=100)


class BatchSentimentRequest(BaseModel):
    """Request model for batch sentiment analysis."""
    texts: List[str] = Field(..., min_items=1, max_items=100)
    brand_name: str = Field(default="", max_length=100)
    industry: str = Field(default="General", max_length=100)
    purpose: str = Field(
        default="general_analysis",
        pattern="^(general_analysis|customer_review|social_media|support_ticket)$"
    )
    
    @field_validator('texts')
    @classmethod
    def validate_texts(cls, v):
        total_size = sum(len(text) for text in v)
        if total_size > 500000:  # 500KB total limit
            raise ValueError("Total text size exceeds 500KB limit")
        for text in v:
            if len(text) > 50000:
                raise ValueError("Individual text exceeds 50KB limit")
        return v


class GapDetectionRequest(BaseModel):
    """Request model for gap detection."""
    query: str
    response: str
    competitor_responses: List[str] = []
    brand_name: str
    industry: str = "General"
    competitors: List[str] = []
    target_audience: str = "General audience"
    business_goals: str = "Improve content quality"


class PortfolioAnalysisRequest(BaseModel):
    """Request model for portfolio gap analysis."""
    content_items: List[Dict[str, str]]  # [{"title": "", "content": "", "type": ""}]
    brand_name: str
    industry: str = "General"
    target_audience: str = "General audience"


@router.post("/process")
async def process_response(
    request: AnalysisRequest,
    current_user: Dict = Depends(get_current_user),
    _: str = Depends(check_rate_limit)
):
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
async def detect_entities(
    request: EntityDetectionRequest,
    current_user: Dict = Depends(get_current_user),
    customer_id: str = Depends(check_rate_limit)
):
    """
    Detect entities for a specific brand using LLM.
    
    This endpoint uses OpenAI GPT-4 Turbo for dynamic entity detection
    instead of hardcoded patterns.
    """
    try:
        analyzer = UnifiedResponseAnalyzer(openai_api_key=settings.OPENAI_API_KEY)
        
        # Override with authenticated customer_id
        customer_context = {
            "brand_name": request.brand_name,
            "brand_variations": request.brand_variations,
            "industry": request.industry,
            "competitors": request.competitors,
            "customer_id": customer_id  # Use authenticated customer_id
        }
        
        # Use analyze_response for entity detection
        analysis = await analyzer.analyze_response(
            response_text=request.text,
            query="entity detection",
            brand_name=customer_context.get('brand_name', ''),
            competitors=customer_context.get('competitors', [])
        )
        entities = {
            'brand_mentions': analysis.brand_analysis.mention_count,
            'competitors': [c.competitor_name for c in analysis.competitors_analysis]
        }
        
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
        analyzer = UnifiedResponseAnalyzer(openai_api_key=settings.OPENAI_API_KEY)
        
        customer_context = {
            "brand_name": request.brand_name,
            "brand_variations": request.brand_variations,
            "industry": request.industry,
            "competitors": request.competitors
        }
        
        # Use analyze_response for visibility analysis
        result = await analyzer.analyze_response(
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


@router.post("/analyze-sentiment")
async def analyze_sentiment(request: SentimentAnalysisRequest):
    """
    Analyze sentiment with deep business insights using LLM.
    
    This uses GPT-4 Turbo for nuanced sentiment analysis including:
    - Aspect-based sentiment
    - Emotional tone detection  
    - Intent classification
    - Business impact assessment
    """
    try:
        analyzer = UnifiedResponseAnalyzer(openai_api_key=settings.OPENAI_API_KEY)
        
        context = {
            "brand_name": request.brand_name,
            "industry": request.industry,
            "purpose": request.purpose,
            "customer_id": request.customer_id
        }
        
        analysis = await analyzer.analyze_response(
            response_text=request.text,
            query=context.get('query', 'sentiment analysis'),
            brand_name=context.get('brand_name', ''),
            competitors=context.get('competitors', [])
        )
        
        return {
            "success": True,
            "analysis": analysis.dict(),
            "summary": {
                "sentiment": analysis.sentiment_label,
                "score": analysis.overall_sentiment,
                "confidence": analysis.confidence,
                "recommendation": analysis.recommendation
            }
        }
        
    except Exception as e:
        logger.error(f"Sentiment analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-sentiment")
async def batch_sentiment_analysis(request: BatchSentimentRequest):
    """
    Analyze sentiment for multiple texts in parallel.
    
    Useful for analyzing multiple reviews, comments, or feedback at once.
    """
    try:
        analyzer = UnifiedResponseAnalyzer(openai_api_key=settings.OPENAI_API_KEY)
        
        context = {
            "brand_name": request.brand_name,
            "industry": request.industry,
            "purpose": request.purpose
        }
        
        analyses = await analyzer.analyze_batch(
            responses=[{'text': text, 'query': context.get('query', 'batch analysis')} for text in request.texts],
            brand_name=context.get('brand_name', ''),
            competitors=context.get('competitors', [])
        )
        
        # Calculate aggregate metrics
        total_sentiment = sum(a.overall_sentiment for a in analyses) / len(analyses)
        sentiment_distribution = {}
        for analysis in analyses:
            label = analysis.sentiment_label
            sentiment_distribution[label] = sentiment_distribution.get(label, 0) + 1
        
        return {
            "success": True,
            "count": len(analyses),
            "aggregate_sentiment": total_sentiment,
            "distribution": sentiment_distribution,
            "analyses": [a.dict() for a in analyses],
            "insights": _generate_batch_insights(analyses)
        }
        
    except Exception as e:
        logger.error(f"Batch sentiment analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _generate_batch_insights(analyses):
    """Generate insights from batch sentiment analysis."""
    positive = sum(1 for a in analyses if a.overall_sentiment > 0.2)
    negative = sum(1 for a in analyses if a.overall_sentiment < -0.2)
    
    # Find common aspects
    aspect_sentiments = {}
    for analysis in analyses:
        for aspect in analysis.aspect_sentiments:
            if aspect.aspect not in aspect_sentiments:
                aspect_sentiments[aspect.aspect] = []
            aspect_sentiments[aspect.aspect].append(aspect.sentiment)
    
    # Calculate average sentiment per aspect
    aspect_averages = {
        aspect: sum(scores) / len(scores)
        for aspect, scores in aspect_sentiments.items()
    }
    
    # Sort by sentiment to find best and worst aspects
    sorted_aspects = sorted(aspect_averages.items(), key=lambda x: x[1])
    
    return {
        "positive_ratio": positive / len(analyses) if analyses else 0,
        "negative_ratio": negative / len(analyses) if analyses else 0,
        "strongest_aspects": sorted_aspects[-3:] if len(sorted_aspects) >= 3 else sorted_aspects,
        "weakest_aspects": sorted_aspects[:3] if len(sorted_aspects) >= 3 else sorted_aspects,
        "urgent_actions": sum(1 for a in analyses if a.urgency_level in ["immediate", "high"]),
        "reputation_risks": sum(1 for a in analyses if a.business_impact == "reputation_risk")
    }


@router.post("/detect-gaps")
async def detect_gaps(request: GapDetectionRequest):
    """
    Detect content gaps using LLM analysis.
    
    Identifies:
    - Missing content compared to query
    - Competitive disadvantages
    - Market opportunities
    - Knowledge gaps
    - Authority gaps
    """
    try:
        analyzer = UnifiedResponseAnalyzer(openai_api_key=settings.OPENAI_API_KEY)
        
        context = {
            "brand_name": request.brand_name,
            "industry": request.industry,
            "competitors": request.competitors,
            "target_audience": request.target_audience,
            "business_goals": request.business_goals
        }
        
        analysis = await analyzer.analyze_response(
            query=request.query,
            response=request.response,
            competitor_responses=request.competitor_responses,
            context=context
        )
        
        return {
            "success": True,
            "analysis": analysis.dict(),
            "summary": {
                "total_gaps": analysis.total_gaps_found,
                "critical_gaps": analysis.critical_gaps,
                "competitive_position": analysis.competitive_position,
                "coverage": analysis.estimated_coverage,
                "top_priority": analysis.gaps[0].title if analysis.gaps else None
            }
        }
        
    except Exception as e:
        logger.error(f"Gap detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-portfolio")
async def analyze_content_portfolio(request: PortfolioAnalysisRequest):
    """
    Analyze entire content portfolio for strategic gaps.
    
    Provides portfolio-level insights and improvement roadmap.
    """
    try:
        analyzer = UnifiedResponseAnalyzer(openai_api_key=settings.OPENAI_API_KEY)
        
        context = {
            "brand_name": request.brand_name,
            "industry": request.industry,
            "target_audience": request.target_audience
        }
        
        # Analyze content portfolio using batch analysis
        analysis = await analyzer.analyze_batch(
            content_items=request.content_items,
            context=context
        )
        
        return {
            "success": True,
            "portfolio_analysis": analysis,
            "executive_summary": _generate_executive_summary(analysis)
        }
        
    except Exception as e:
        logger.error(f"Portfolio analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _generate_executive_summary(analysis: Dict) -> Dict:
    """Generate executive summary from portfolio analysis."""
    coverage = analysis.get("portfolio_coverage", 0)
    maturity = analysis.get("content_maturity", "Unknown")
    
    if coverage >= 80:
        health = "Excellent"
        action = "Focus on optimization and innovation"
    elif coverage >= 60:
        health = "Good"
        action = "Address critical gaps and expand coverage"
    elif coverage >= 40:
        health = "Needs Improvement"
        action = "Significant content development required"
    else:
        health = "Critical"
        action = "Immediate content strategy overhaul needed"
    
    return {
        "portfolio_health": health,
        "maturity_level": maturity,
        "coverage_score": f"{coverage:.1f}%",
        "total_gaps": analysis.get("total_gaps", 0),
        "recommended_action": action,
        "top_focus_areas": analysis.get("strategic_focus_areas", [])[:3],
        "quick_wins_available": len(analysis.get("improvement_roadmap", [])) > 0
    }


@router.get("/health")
async def health_check():
    """Check if analysis service is healthy."""
    return {
        "status": "healthy",
        "service": "intelligence-engine",
        "llm_enabled": True,
        "model": "gpt-5-nano-2025-08-07",
        "features": [
            "entity_detection",
            "sentiment_analysis", 
            "gap_detection",
            "visibility_analysis",
            "portfolio_analysis"
        ]
    }
"""Analysis API routes with LLM entity detection."""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from pydantic import BaseModel
from src.processors.response_processor import ResponseProcessor
from src.nlp.llm_entity_detector import LLMEntityDetector
from src.nlp.llm_sentiment_analyzer import LLMSentimentAnalyzer
from src.nlp.llm_gap_detector import LLMGapDetector
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


class SentimentAnalysisRequest(BaseModel):
    """Request model for sentiment analysis."""
    text: str
    brand_name: str = ""
    industry: str = "General"
    purpose: str = "general_analysis"  # customer_review, social_media, support_ticket
    customer_id: str = ""


class BatchSentimentRequest(BaseModel):
    """Request model for batch sentiment analysis."""
    texts: List[str]
    brand_name: str = ""
    industry: str = "General"
    purpose: str = "general_analysis"


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
        analyzer = LLMSentimentAnalyzer()
        
        context = {
            "brand_name": request.brand_name,
            "industry": request.industry,
            "purpose": request.purpose,
            "customer_id": request.customer_id
        }
        
        analysis = await analyzer.analyze(request.text, context)
        
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
        analyzer = LLMSentimentAnalyzer()
        
        context = {
            "brand_name": request.brand_name,
            "industry": request.industry,
            "purpose": request.purpose
        }
        
        analyses = await analyzer.analyze_batch(request.texts, context)
        
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
        detector = LLMGapDetector()
        
        context = {
            "brand_name": request.brand_name,
            "industry": request.industry,
            "competitors": request.competitors,
            "target_audience": request.target_audience,
            "business_goals": request.business_goals
        }
        
        analysis = await detector.detect(
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
        detector = LLMGapDetector()
        
        context = {
            "brand_name": request.brand_name,
            "industry": request.industry,
            "target_audience": request.target_audience
        }
        
        analysis = await detector.analyze_content_portfolio(
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
        "model": "gpt-4-turbo-preview",
        "features": [
            "entity_detection",
            "sentiment_analysis", 
            "gap_detection",
            "visibility_analysis",
            "portfolio_analysis"
        ]
    }
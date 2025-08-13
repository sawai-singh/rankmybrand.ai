from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import random
from datetime import datetime

router = APIRouter()

class QuickAnalyzeRequest(BaseModel):
    domain: str
    quick: bool = True

class QuickAnalyzeResponse(BaseModel):
    domain: str
    score: float
    metrics: dict
    recommendations: list
    timestamp: str

@router.post("/analyze")
async def quick_analyze(request: QuickAnalyzeRequest):
    """Quick domain analysis for instant scores."""
    
    # Generate realistic demo scores
    base_score = random.uniform(60, 95)
    
    metrics = {
        "statistics": random.uniform(0.6, 0.95),
        "quotation": random.uniform(0.5, 0.9),
        "fluency": random.uniform(0.7, 0.95),
        "relevance": random.uniform(0.6, 0.9),
        "authority": random.uniform(0.5, 0.85),
        "ai_visibility": random.uniform(0.6, 0.9)
    }
    
    recommendations = []
    
    if metrics["statistics"] < 0.7:
        recommendations.append({
            "priority": "high",
            "metric": "statistics",
            "action": "Add more data points and statistics to your content",
            "impact": "Could improve GEO score by 10-15 points"
        })
    
    if metrics["quotation"] < 0.7:
        recommendations.append({
            "priority": "high",
            "metric": "quotation",
            "action": "Include expert quotes and authoritative citations",
            "impact": "Could improve GEO score by 8-12 points"
        })
    
    if metrics["authority"] < 0.7:
        recommendations.append({
            "priority": "medium",
            "metric": "authority",
            "action": "Build more high-quality backlinks and citations",
            "impact": "Could improve GEO score by 5-10 points"
        })
    
    return QuickAnalyzeResponse(
        domain=request.domain,
        score=round(base_score, 1),
        metrics=metrics,
        recommendations=recommendations,
        timestamp=datetime.now().isoformat()
    )

@router.get("/health")
async def health():
    return {"status": "healthy"}
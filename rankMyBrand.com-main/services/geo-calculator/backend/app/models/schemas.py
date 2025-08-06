from pydantic import BaseModel, HttpUrl, Field
from typing import List, Optional, Dict
from datetime import datetime

class GEORequest(BaseModel):
    url: HttpUrl
    content: str = Field(..., min_length=100)
    brand_terms: Optional[List[str]] = None
    target_queries: Optional[List[str]] = None
    check_ai_visibility: bool = True

class MetricDetail(BaseModel):
    score: float
    recommendation: str
    details: Optional[Dict] = None

class GEOMetrics(BaseModel):
    statistics: float
    quotation: float
    fluency: float
    relevance: float
    authority: float
    ai_visibility: float

class Recommendation(BaseModel):
    priority: str
    metric: str
    action: str
    impact: str

class GEOResponse(BaseModel):
    url: str
    domain: str
    geo_score: float
    metrics: GEOMetrics
    detailed_metrics: Optional[Dict] = None
    recommendations: List[Recommendation]
    confidence: str
    timestamp: Optional[str] = None
    cached: bool = False

class BatchRequest(BaseModel):
    urls: List[HttpUrl]
    check_ai_visibility: bool = True

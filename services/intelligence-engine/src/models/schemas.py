"""Pydantic models for data validation."""

from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID
from pydantic import BaseModel, Field


class Citation(BaseModel):
    """Citation/source model."""
    url: str
    domain: str
    title: Optional[str] = None
    snippet: Optional[str] = None
    position: int = 0
    authority_score: Optional[float] = None
    source_name: Optional[str] = None  # Original source name before resolution


class Entity(BaseModel):
    """Detected entity model."""
    text: str
    type: str  # BRAND, COMPETITOR, PRODUCT, etc.
    confidence: float
    start_pos: int
    end_pos: int
    context: Optional[str] = None


class SentimentResult(BaseModel):
    """Sentiment analysis result."""
    score: float  # -1 to 1
    label: str  # POSITIVE, NEUTRAL, NEGATIVE
    confidence: float


class RelevanceResult(BaseModel):
    """Relevance scoring result."""
    score: float  # 0 to 1
    similarity: float
    keywords_matched: List[str]
    coverage: float  # How much of the query is answered


class ContentGap(BaseModel):
    """Identified content gap."""
    type: str  # MISSING_TOPIC, WEAK_COVERAGE, COMPETITOR_ADVANTAGE
    description: str
    priority: int = 5  # 1-10
    query_examples: List[str]
    competitor_advantage: float
    estimated_impact: float


class AIResponse(BaseModel):
    """Input AI response from collector."""
    id: str
    platform: str
    prompt_text: str
    response_text: str
    citations: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {}
    collected_at: datetime
    brand_id: Optional[str] = None  # Required for processing
    customer_id: Optional[str] = None  # Required for multi-tenancy


class ProcessedResponse(BaseModel):
    """Processed AI response with intelligence."""
    response_id: str
    platform: str
    prompt: str
    
    # Extracted intelligence
    citations: List[Citation]
    entities: List[Entity]
    sentiment: SentimentResult
    relevance: RelevanceResult
    authority_score: float
    gaps: List[ContentGap]
    
    # Calculated scores
    geo_score: float
    share_of_voice: float
    citation_frequency: float
    
    # Metadata
    processed_at: datetime
    processing_time_ms: int


class BrandMention(BaseModel):
    """Brand mention in AI response."""
    response_id: str
    brand_id: str
    brand_name: str
    mention_text: str
    sentiment_score: float
    sentiment_label: str
    confidence: float
    position: int
    context: str
    platform: str


class GEOScore(BaseModel):
    """Calculated GEO score."""
    brand_id: str
    platform: str
    score: float
    share_of_voice: float
    citation_frequency: float
    sentiment_average: float
    relevance_average: float
    authority_average: float
    period_start: datetime
    period_end: datetime
    sample_size: int


class MetricEvent(BaseModel):
    """Event to publish to metrics stream."""
    type: str = "geo_metrics"
    brand_id: str
    metrics: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
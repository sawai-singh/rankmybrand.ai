"""SQLAlchemy database models."""

from datetime import datetime
from uuid import uuid4
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, Text, 
    DateTime, UUID, ARRAY, Index, ForeignKey
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID

Base = declarative_base()


class BrandMentionDB(Base):
    """Brand mentions table."""
    __tablename__ = "brand_mentions"
    __table_args__ = {"schema": "intelligence"}
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    response_id = Column(PGUUID(as_uuid=True), nullable=False)
    brand_id = Column(PGUUID(as_uuid=True), nullable=False)
    mention_text = Column(Text, nullable=False)
    sentiment_score = Column(Float)
    sentiment_label = Column(String(20))
    confidence = Column(Float)
    position = Column(Integer)
    context = Column(Text)
    platform = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index("idx_brand_mentions_brand", "brand_id"),
        Index("idx_brand_mentions_sentiment", "sentiment_score"),
        Index("idx_brand_mentions_created", "created_at"),
        {"schema": "intelligence"}
    )


class GEOScoreDB(Base):
    """GEO scores table."""
    __tablename__ = "geo_scores"
    __table_args__ = {"schema": "intelligence"}
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    brand_id = Column(PGUUID(as_uuid=True), nullable=False)
    platform = Column(String(50), nullable=False)
    score = Column(Float, nullable=False)
    share_of_voice = Column(Float)
    citation_frequency = Column(Float)
    sentiment_average = Column(Float)
    relevance_average = Column(Float)
    authority_average = Column(Float)
    calculated_at = Column(DateTime, default=datetime.utcnow)
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    sample_size = Column(Integer, default=0)
    
    # Indexes
    __table_args__ = (
        Index("idx_geo_scores_brand_platform", "brand_id", "platform"),
        Index("idx_geo_scores_calculated", "calculated_at"),
        {"schema": "intelligence"}
    )


class ContentGapDB(Base):
    """Content gaps table."""
    __tablename__ = "content_gaps"
    __table_args__ = {"schema": "intelligence"}
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    brand_id = Column(PGUUID(as_uuid=True), nullable=False)
    gap_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(Integer, default=5)
    query_examples = Column(ARRAY(Text))
    competitor_advantage = Column(Float)
    estimated_impact = Column(Float)
    detected_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)
    
    # Indexes
    __table_args__ = (
        Index("idx_gaps_brand_priority", "brand_id", "priority"),
        Index("idx_gaps_type", "gap_type"),
        {"schema": "intelligence"}
    )


class CitationSourceDB(Base):
    """Citation sources table."""
    __tablename__ = "citation_sources"
    __table_args__ = {"schema": "intelligence"}
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    domain = Column(String(255), nullable=False, unique=True)
    url = Column(Text)
    authority_score = Column(Float)
    citation_count = Column(Integer, default=1)
    last_cited = Column(DateTime, default=datetime.utcnow)
    is_competitor = Column(Boolean, default=False)
    is_owned = Column(Boolean, default=False)


class ProcessedResponseDB(Base):
    """Processed responses tracking table."""
    __tablename__ = "processed_responses"
    __table_args__ = {"schema": "intelligence"}
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    response_id = Column(String, nullable=False, unique=True)
    platform = Column(String(50), nullable=False)
    prompt = Column(Text)
    geo_score = Column(Float)
    share_of_voice = Column(Float)
    citation_frequency = Column(Float)
    sentiment_score = Column(Float)
    relevance_score = Column(Float)
    authority_score = Column(Float)
    processed_at = Column(DateTime, default=datetime.utcnow)
    processing_time_ms = Column(Integer)
    
    # Indexes
    __table_args__ = (
        Index("idx_processed_platform", "platform"),
        Index("idx_processed_at", "processed_at"),
        {"schema": "intelligence"}
    )
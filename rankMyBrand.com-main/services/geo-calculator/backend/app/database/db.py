from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, JSON, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from ..config import settings

engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class GEOAnalysis(Base):
    __tablename__ = "geo_analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, index=True)
    domain = Column(String, index=True)
    content_hash = Column(String)
    
    # Scores
    geo_score = Column(Float)
    citation_score = Column(Float)
    statistics_score = Column(Float)
    quotation_score = Column(Float)
    fluency_score = Column(Float)
    authority_score = Column(Float)
    relevance_score = Column(Float)
    
    # Metadata
    metrics = Column(JSON)
    recommendations = Column(JSON)
    ai_visibility_data = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AIVisibilityCheck(Base):
    __tablename__ = "ai_visibility_checks"
    
    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, index=True)
    query = Column(String)
    platform = Column(String)  # chatgpt, perplexity, google_aio
    
    appears = Column(Integer, default=0)  # boolean
    position = Column(Integer, nullable=True)
    context = Column(Text, nullable=True)
    
    checked_at = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

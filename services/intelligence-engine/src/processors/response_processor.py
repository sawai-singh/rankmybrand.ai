"""Main response processing pipeline."""

import asyncio
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
from src.nlp import (
    CitationExtractor,
    EntityDetector,
    SentimentAnalyzer,
    RelevanceScorer,
    AuthorityScorer,
    GapDetector
)
from src.processors.geo_calculator import GEOCalculator
from src.processors.sov_calculator import SOVCalculator
from src.models.schemas import (
    AIResponse,
    ProcessedResponse,
    BrandMention
)
from src.config import settings


class ResponseProcessor:
    """Process AI responses through NLP pipeline."""
    
    def __init__(self):
        # Initialize NLP components
        self.citation_extractor = CitationExtractor()
        self.entity_detector = EntityDetector()
        self.sentiment_analyzer = SentimentAnalyzer()
        self.relevance_scorer = RelevanceScorer()
        self.authority_scorer = AuthorityScorer()
        self.gap_detector = GapDetector()
        
        # Initialize calculators
        self.geo_calculator = GEOCalculator()
        self.sov_calculator = SOVCalculator()
        
        # Processing metrics
        self.processed_count = 0
        self.error_count = 0
    
    async def process(
        self,
        response: AIResponse,
        competitor_responses: Optional[List[str]] = None
    ) -> ProcessedResponse:
        """Process a single AI response through the NLP pipeline."""
        start_time = time.time()
        
        try:
            # Run NLP pipeline components in parallel where possible
            tasks = []
            
            # Group 1: Can run in parallel (no dependencies)
            tasks.append(self._extract_citations_async(
                response.response_text,
                response.citations
            ))
            tasks.append(self._detect_entities_async(response.response_text))
            tasks.append(self._analyze_sentiment_async(response.response_text))
            tasks.append(self._score_relevance_async(
                response.prompt_text,
                response.response_text
            ))
            
            # Execute parallel tasks
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle results
            citations = results[0] if not isinstance(results[0], Exception) else []
            entities = results[1] if not isinstance(results[1], Exception) else []
            sentiment = results[2] if not isinstance(results[2], Exception) else None
            relevance = results[3] if not isinstance(results[3], Exception) else None
            
            # Group 2: Depends on citations
            authority_score = await self._score_authority_async(citations)
            
            # Group 3: Depends on entities and optionally competitor responses
            gaps = await self._detect_gaps_async(
                response.prompt_text,
                response.response_text,
                competitor_responses or [],
                entities
            )
            
            # Calculate composite scores
            citation_frequency = len(citations) / max(len(response.response_text.split()), 1) * 1000
            
            geo_score = self.geo_calculator.calculate(
                citation_frequency=citation_frequency,
                sentiment_score=sentiment.score if sentiment else 0.0,
                relevance_score=relevance.score if relevance else 0.0,
                authority_score=authority_score,
                position_weight=self._calculate_position_weight(response.metadata)
            )
            
            # Calculate share of voice (requires brand mentions)
            brand_mentions = self._extract_brand_mentions(response.response_text, entities)
            share_of_voice = self.sov_calculator.calculate(
                brand_mentions,
                entities
            )
            
            # Create processed response
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            processed = ProcessedResponse(
                response_id=response.id,
                platform=response.platform,
                prompt=response.prompt_text,
                citations=citations,
                entities=entities,
                sentiment=sentiment,
                relevance=relevance,
                authority_score=authority_score,
                gaps=gaps,
                geo_score=geo_score,
                share_of_voice=share_of_voice,
                citation_frequency=citation_frequency,
                processed_at=datetime.utcnow(),
                processing_time_ms=processing_time_ms
            )
            
            self.processed_count += 1
            return processed
            
        except Exception as e:
            self.error_count += 1
            raise Exception(f"Failed to process response: {str(e)}")
    
    async def process_batch(
        self,
        responses: List[AIResponse],
        batch_size: int = None
    ) -> List[ProcessedResponse]:
        """Process multiple responses in batch."""
        batch_size = batch_size or settings.batch_size
        results = []
        
        # Process in batches to avoid overwhelming the system
        for i in range(0, len(responses), batch_size):
            batch = responses[i:i + batch_size]
            
            # Process batch in parallel
            tasks = [self.process(response) for response in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Filter out errors
            for result in batch_results:
                if not isinstance(result, Exception):
                    results.append(result)
                else:
                    self.error_count += 1
        
        return results
    
    # Async wrapper methods for NLP components
    async def _extract_citations_async(self, text: str, provided_citations: List[Dict]):
        """Async wrapper for citation extraction."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self.citation_extractor.extract,
            text,
            provided_citations
        )
    
    async def _detect_entities_async(self, text: str):
        """Async wrapper for entity detection."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self.entity_detector.detect,
            text
        )
    
    async def _analyze_sentiment_async(self, text: str):
        """Async wrapper for sentiment analysis."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self.sentiment_analyzer.analyze,
            text
        )
    
    async def _score_relevance_async(self, query: str, response: str):
        """Async wrapper for relevance scoring."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self.relevance_scorer.score,
            query,
            response
        )
    
    async def _score_authority_async(self, citations):
        """Async wrapper for authority scoring."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self.authority_scorer.score,
            citations
        )
    
    async def _detect_gaps_async(
        self,
        prompt: str,
        response: str,
        competitor_responses: List[str],
        entities
    ):
        """Async wrapper for gap detection."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self.gap_detector.detect,
            prompt,
            response,
            competitor_responses,
            entities
        )
    
    def _calculate_position_weight(self, metadata: Dict[str, Any]) -> float:
        """Calculate position weight from metadata."""
        # Check if this is a first result or featured snippet
        position = metadata.get("position", 10)
        is_featured = metadata.get("is_featured", False)
        
        if is_featured:
            return 1.0
        elif position == 1:
            return 0.9
        elif position <= 3:
            return 0.7
        elif position <= 5:
            return 0.5
        else:
            return 0.3
    
    def _extract_brand_mentions(self, text: str, entities) -> List[BrandMention]:
        """Extract brand mentions from entities."""
        mentions = []
        
        for entity in entities:
            if entity.type in ["BRAND", "COMPETITOR"]:
                # Get sentiment for this entity's context
                sentiment = self.sentiment_analyzer.analyze(entity.context or entity.text)
                
                mention = BrandMention(
                    response_id="",  # Will be set later
                    brand_id="",  # Will be mapped later
                    brand_name=entity.text,
                    mention_text=entity.context or entity.text,
                    sentiment_score=sentiment.score,
                    sentiment_label=sentiment.label,
                    confidence=entity.confidence,
                    position=entity.start_pos,
                    context=entity.context or "",
                    platform=""  # Will be set from response
                )
                mentions.append(mention)
        
        return mentions
    
    def get_processing_stats(self) -> Dict:
        """Get processing statistics."""
        return {
            "processed_count": self.processed_count,
            "error_count": self.error_count,
            "error_rate": self.error_count / max(self.processed_count, 1),
            "success_rate": 1 - (self.error_count / max(self.processed_count, 1))
        }
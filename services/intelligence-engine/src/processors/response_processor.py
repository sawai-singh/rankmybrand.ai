"""Main response processing pipeline with enhanced error handling and metrics."""

import asyncio
import time
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from src.nlp import (
    CitationExtractor,
    AuthorityScorer
)
from src.nlp.llm_entity_detector import LLMEntityDetector
from src.nlp.llm_sentiment_analyzer import LLMSentimentAnalyzer
from src.nlp.llm_gap_detector import LLMGapDetector
from src.nlp.llm_relevance_scorer import LLMRelevanceScorer
from src.processors.geo_calculator import GEOCalculator
from src.processors.sov_calculator import SOVCalculator
from src.models.schemas import (
    AIResponse,
    ProcessedResponse,
    BrandMention
)
from src.config import settings

# Configure logging
logger = logging.getLogger(__name__)


class ResponseProcessor:
    """Process AI responses through NLP pipeline with robust error handling."""
    
    def __init__(
        self,
        customer_context: Optional[Dict[str, Any]] = None,
        position_weights: Optional[Dict[str, float]] = None,
        enable_caching: bool = False,
        max_retries: int = 3
    ):
        """
        Initialize response processor with configurable parameters.
        
        Args:
            customer_context: Customer-specific context for processing
            position_weights: Custom weights for position scoring
            enable_caching: Enable caching of LLM results
            max_retries: Maximum retries for failed operations
        """
        # Initialize authority scorer first (needed by citation extractor)
        self.authority_scorer = AuthorityScorer()
        
        # Initialize NLP components with proper dependencies
        self.citation_extractor = CitationExtractor(
            authority_scorer=self.authority_scorer
        )
        self.entity_detector = LLMEntityDetector()
        self.sentiment_analyzer = LLMSentimentAnalyzer()
        self.relevance_scorer = LLMRelevanceScorer()
        self.gap_detector = LLMGapDetector()
        
        # Store customer context for entity detection
        self.customer_context = customer_context or {}
        
        # Initialize calculators
        self.geo_calculator = GEOCalculator()
        self.sov_calculator = SOVCalculator()
        
        # Position weights configuration
        self.position_weights = position_weights or {
            "featured": 1.0,
            "position_1": 0.9,
            "position_2_3": 0.7,
            "position_4_5": 0.5,
            "position_6_10": 0.3,
            "position_11_plus": 0.1
        }
        
        # Processing configuration
        self.enable_caching = enable_caching
        self.max_retries = max_retries
        self.cache = {} if enable_caching else None
        
        # Processing metrics
        self.processed_count = 0
        self.error_count = 0
        self.component_metrics = {
            "citation_extraction": {"success": 0, "failure": 0, "total_time": 0},
            "entity_detection": {"success": 0, "failure": 0, "total_time": 0},
            "sentiment_analysis": {"success": 0, "failure": 0, "total_time": 0},
            "relevance_scoring": {"success": 0, "failure": 0, "total_time": 0},
            "authority_scoring": {"success": 0, "failure": 0, "total_time": 0},
            "gap_detection": {"success": 0, "failure": 0, "total_time": 0},
        }
    
    async def process(
        self,
        response: AIResponse,
        competitor_responses: Optional[List[str]] = None,
        customer_context: Optional[Dict[str, Any]] = None
    ) -> ProcessedResponse:
        """
        Process a single AI response through the NLP pipeline.
        
        Args:
            response: AI response to process
            competitor_responses: Optional competitor responses for gap analysis
            customer_context: Optional customer-specific context
            
        Returns:
            ProcessedResponse with all analysis results
        """
        start_time = time.perf_counter()
        
        try:
            # Use provided context or fall back to instance context
            context = customer_context or self.customer_context
            
            # Validate inputs
            if not response or not response.response_text:
                logger.warning("Empty response text provided")
                return self._create_empty_response(response)
            
            # Extract response date for recency calculations
            response_date = response.collected_at if hasattr(response, 'collected_at') else datetime.now(timezone.utc)
            
            # Run NLP pipeline components in parallel where possible
            tasks = []
            
            # Group 1: Can run in parallel (no dependencies)
            tasks.append(self._process_component(
                "citation_extraction",
                self._extract_citations_async,
                response.response_text,
                response.citations
            ))
            
            # Only run entity detection if brand context is available
            if context.get('brand_name'):
                tasks.append(self._process_component(
                    "entity_detection",
                    self._detect_entities_async,
                    response.response_text,
                    context
                ))
            else:
                tasks.append(asyncio.create_task(self._return_empty_list()))
            
            tasks.append(self._process_component(
                "sentiment_analysis",
                self._analyze_sentiment_async,
                response.response_text,
                context
            ))
            
            tasks.append(self._process_component(
                "relevance_scoring",
                self._score_relevance_async,
                response.prompt_text,
                response.response_text
            ))
            
            # Execute parallel tasks with error handling and timeout
            try:
                results = await asyncio.wait_for(
                    asyncio.gather(*tasks, return_exceptions=True),
                    timeout=30.0  # 30 second timeout for all parallel tasks
                )
            except asyncio.TimeoutError:
                logger.error(f"Timeout processing response {response.id}")
                results = [None] * len(tasks)
            
            # Unpack results with validation and exception handling
            citations = results[0] if results[0] is not None and not isinstance(results[0], Exception) else []
            entities = results[1] if results[1] is not None and not isinstance(results[1], Exception) else []
            sentiment = results[2] if not isinstance(results[2], Exception) else None
            relevance = results[3] if not isinstance(results[3], Exception) else None
            
            # Log any exceptions from components
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    component_names = ["citation_extraction", "entity_detection", "sentiment_analysis", "relevance_scoring"]
                    if i < len(component_names):
                        logger.warning(f"Component {component_names[i]} failed: {str(result)}")
            
            # Group 2: Depends on citations
            authority_score = 0.0
            if citations:
                authority_result = await self._process_component(
                    "authority_scoring",
                    self._score_authority_async,
                    citations
                )
                authority_score = authority_result if authority_result is not None else 0.0
            
            # Group 3: Gap detection (optional, depends on competitors)
            gaps = []
            if competitor_responses and context.get('brand_name'):
                gap_result = await self._process_component(
                    "gap_detection",
                    self._detect_gaps_async,
                    response.prompt_text,
                    response.response_text,
                    competitor_responses,
                    entities,
                    context
                )
                gaps = gap_result if gap_result is not None else []
            
            # Calculate metrics
            # Citation frequency: simple count of citations
            citation_frequency = float(len(citations))
            
            # Calculate GEO score with all components
            geo_score = self.geo_calculator.calculate(
                citation_frequency=citation_frequency,
                sentiment_score=sentiment.overall_sentiment if sentiment else 0.0,
                relevance_score=relevance.score if relevance else 0.0,
                authority_score=authority_score,
                position_weight=self._calculate_position_weight(response.metadata),
                response_date=response_date  # Pass response date for recency
            )
            
            # Calculate share of voice
            brand_mentions = self._extract_brand_mentions(response.response_text, entities, response)
            share_of_voice = 0.0
            if brand_mentions:
                # Pass target brand from context if available
                target_brand = context.get('brand_name') if context else None
                share_of_voice = self.sov_calculator.calculate(
                    brand_mentions,
                    entities,
                    target_brand
                )
            
            # Create processed response
            processing_time_ms = int((time.perf_counter() - start_time) * 1000)
            
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
                processed_at=datetime.now(timezone.utc),
                processing_time_ms=processing_time_ms,
                metadata={
                    "response_date": response_date.isoformat() if response_date else None,
                    "has_competitor_analysis": bool(competitor_responses),
                    "component_failures": self._get_component_failures()
                }
            )
            
            self.processed_count += 1
            logger.info(f"Successfully processed response {response.id} in {processing_time_ms}ms")
            return processed
            
        except Exception as e:
            self.error_count += 1
            logger.error(f"Failed to process response {response.id}: {str(e)}", exc_info=True)
            
            # Return partial results instead of failing completely
            return self._create_error_response(response, str(e))
    
    async def process_batch(
        self,
        responses: List[AIResponse],
        batch_size: Optional[int] = None,
        competitor_responses: Optional[Dict[str, List[str]]] = None
    ) -> List[ProcessedResponse]:
        """
        Process multiple responses in batch with improved error handling.
        
        Args:
            responses: List of responses to process
            batch_size: Optional batch size (defaults to settings)
            competitor_responses: Optional dict mapping response IDs to competitor responses
            
        Returns:
            List of processed responses (including partial results for errors)
        """
        batch_size = batch_size or getattr(settings, 'batch_size', 10)
        results = []
        competitor_responses = competitor_responses or {}
        
        logger.info(f"Processing batch of {len(responses)} responses")
        
        # Process in batches to avoid overwhelming the system
        for i in range(0, len(responses), batch_size):
            batch = responses[i:i + batch_size]
            batch_start = time.perf_counter()
            
            # Process batch in parallel with timeout
            tasks = [
                self.process(
                    response,
                    competitor_responses.get(response.id, [])
                )
                for response in batch
            ]
            
            try:
                batch_results = await asyncio.wait_for(
                    asyncio.gather(*tasks, return_exceptions=True),
                    timeout=60.0  # 60 second timeout for batch
                )
                
                # Filter out exceptions and log them
                for i, result in enumerate(batch_results):
                    if isinstance(result, Exception):
                        logger.error(f"Error processing response {batch[i].id}: {str(result)}")
                        # Create error response instead
                        results.append(self._create_error_response(batch[i], str(result)))
                    else:
                        results.append(result)
            except asyncio.TimeoutError:
                batch_time = time.perf_counter() - batch_start
                logger.error(f"Batch timeout after {batch_time:.2f}s")
                # Create error responses for timed out batch
                for resp in batch:
                    results.append(self._create_error_response(resp, "Batch processing timeout"))
            
            batch_time = time.perf_counter() - batch_start
            logger.info(f"Processed batch {i//batch_size + 1} in {batch_time:.2f}s")
        
        success_count = sum(1 for r in results if r.geo_score > 0)
        logger.info(f"Batch processing complete: {success_count}/{len(responses)} successful")
        
        return results
    
    async def _process_component(
        self,
        component_name: str,
        func,
        *args,
        **kwargs
    ):
        """
        Process a component with metrics tracking and error handling.
        
        Args:
            component_name: Name of the component for metrics
            func: Async function to execute
            *args, **kwargs: Arguments for the function
            
        Returns:
            Result of the function or None on error
        """
        start_time = time.perf_counter()
        
        try:
            result = await func(*args, **kwargs)
            
            # Update metrics
            elapsed = time.perf_counter() - start_time
            self.component_metrics[component_name]["success"] += 1
            self.component_metrics[component_name]["total_time"] += elapsed
            
            return result
            
        except Exception as e:
            # Update metrics
            elapsed = time.perf_counter() - start_time
            self.component_metrics[component_name]["failure"] += 1
            self.component_metrics[component_name]["total_time"] += elapsed
            
            logger.warning(f"Component {component_name} failed: {str(e)}")
            return None
    
    async def _return_empty_list(self):
        """Return an empty list (used as placeholder task)."""
        return []
    
    # Async wrapper methods for NLP components
    async def _extract_citations_async(self, text: str, provided_citations: Optional[List[Dict]]):
        """Async wrapper for citation extraction with validation."""
        if not text:
            return []
        
        loop = asyncio.get_running_loop()
        citations = await loop.run_in_executor(
            None,
            self.citation_extractor.extract,
            text,
            provided_citations or []
        )
        return citations or []
    
    async def _detect_entities_async(self, text: str, context: Dict[str, Any]):
        """Async wrapper for LLM entity detection with validation."""
        if not text or not context.get('brand_name'):
            return []
        
        try:
            entities = await asyncio.wait_for(
                self.entity_detector.detect(text, context),
                timeout=10.0  # 10 second timeout for entity detection
            )
            return entities or []
        except asyncio.TimeoutError:
            logger.warning("Entity detection timed out")
            return []
        except Exception as e:
            logger.warning(f"Entity detection failed: {str(e)}")
            return []
    
    async def _analyze_sentiment_async(self, text: str, context: Optional[Dict] = None):
        """Async wrapper for LLM sentiment analysis."""
        if not text:
            return None
        
        try:
            context = context or self.customer_context
            return await asyncio.wait_for(
                self.sentiment_analyzer.analyze(text, context),
                timeout=10.0  # 10 second timeout for sentiment analysis
            )
        except asyncio.TimeoutError:
            logger.warning("Sentiment analysis timed out")
            return None
        except Exception as e:
            logger.warning(f"Sentiment analysis failed: {str(e)}")
            return None
    
    async def _score_relevance_async(self, query: str, response: str):
        """Async wrapper for LLM relevance scoring."""
        if not query or not response:
            return None
        
        try:
            return await asyncio.wait_for(
                self.relevance_scorer.score(query, response),
                timeout=10.0  # 10 second timeout for relevance scoring
            )
        except asyncio.TimeoutError:
            logger.warning("Relevance scoring timed out")
            return None
        except Exception as e:
            logger.warning(f"Relevance scoring failed: {str(e)}")
            return None
    
    async def _score_authority_async(self, citations):
        """Async wrapper for authority scoring."""
        if not citations:
            return 0.0
        
        loop = asyncio.get_running_loop()
        try:
            score = await loop.run_in_executor(
                None,
                self.authority_scorer.score,
                citations
            )
            return max(0.0, min(1.0, score))  # Clamp to [0, 1]
        except Exception as e:
            logger.warning(f"Authority scoring failed: {str(e)}")
            return 0.0
    
    async def _detect_gaps_async(
        self,
        prompt: str,
        response: str,
        competitor_responses: List[str],
        entities,
        context: Optional[Dict] = None
    ):
        """Async wrapper for LLM gap detection."""
        if not prompt or not response:
            return []
        
        try:
            context = context or self.customer_context
            gaps = await asyncio.wait_for(
                self.gap_detector.detect(
                    query=prompt,
                    response=response,
                    competitor_responses=competitor_responses or [],
                    context=context
                ),
                timeout=15.0  # 15 second timeout for gap detection (more complex)
            )
            return gaps or []
        except asyncio.TimeoutError:
            logger.warning("Gap detection timed out")
            return []
        except Exception as e:
            logger.warning(f"Gap detection failed: {str(e)}")
            return []
    
    def _calculate_position_weight(self, metadata: Optional[Dict[str, Any]]) -> float:
        """
        Calculate position weight from metadata using configurable weights.
        
        Args:
            metadata: Response metadata containing position info
            
        Returns:
            Position weight between 0 and 1
        """
        if not metadata:
            return self.position_weights.get("position_11_plus", 0.1)
        
        # Check if this is a featured snippet
        if metadata.get("is_featured", False):
            return self.position_weights.get("featured", 1.0)
        
        # Get position from metadata
        position = metadata.get("position", 11)
        
        # Map position to weight
        if position == 1:
            return self.position_weights.get("position_1", 0.9)
        elif position <= 3:
            return self.position_weights.get("position_2_3", 0.7)
        elif position <= 5:
            return self.position_weights.get("position_4_5", 0.5)
        elif position <= 10:
            return self.position_weights.get("position_6_10", 0.3)
        else:
            return self.position_weights.get("position_11_plus", 0.1)
    
    def _extract_brand_mentions(self, text: str, entities, response: Optional[AIResponse] = None) -> List[BrandMention]:
        """
        Extract brand mentions from entities with validation.
        
        Args:
            text: Response text
            entities: Detected entities
            
        Returns:
            List of brand mentions
        """
        mentions = []
        
        if not entities:
            return mentions
        
        for entity in entities:
            if not entity or not hasattr(entity, 'type'):
                continue
                
            if entity.type in ["BRAND", "COMPETITOR"]:
                # Extract sentiment from metadata if available
                sentiment_score = 0.0
                sentiment_label = "neutral"
                
                if hasattr(entity, 'metadata') and entity.metadata:
                    if 'sentiment' in entity.metadata:
                        sentiment_score = entity.metadata['sentiment']
                        sentiment_label = "positive" if sentiment_score > 0.3 else "negative" if sentiment_score < -0.3 else "neutral"
                
                mention = BrandMention(
                    response_id=response.id if response else "",
                    brand_id="",  # Will be mapped later
                    brand_name=entity.text,
                    mention_text=getattr(entity, 'context', entity.text) or entity.text,
                    sentiment_score=sentiment_score,
                    sentiment_label=sentiment_label,
                    confidence=getattr(entity, 'confidence', 0.5),
                    position=getattr(entity, 'start_pos', 0),
                    context=getattr(entity, 'context', "") or "",
                    platform=response.platform if response else ""
                )
                mentions.append(mention)
        
        return mentions
    
    def _create_empty_response(self, response: AIResponse) -> ProcessedResponse:
        """Create an empty processed response for invalid inputs."""
        return ProcessedResponse(
            response_id=response.id if response else "",
            platform=response.platform if response else "",
            prompt=response.prompt_text if response else "",
            citations=[],
            entities=[],
            sentiment=None,
            relevance=None,
            authority_score=0.0,
            gaps=[],
            geo_score=0.0,
            share_of_voice=0.0,
            citation_frequency=0.0,
            processed_at=datetime.now(timezone.utc),
            processing_time_ms=0,
            metadata={"error": "Empty or invalid response"}
        )
    
    def _create_error_response(self, response: AIResponse, error: str) -> ProcessedResponse:
        """Create a processed response with error information."""
        return ProcessedResponse(
            response_id=response.id,
            platform=response.platform,
            prompt=response.prompt_text,
            citations=[],
            entities=[],
            sentiment=None,
            relevance=None,
            authority_score=0.0,
            gaps=[],
            geo_score=0.0,
            share_of_voice=0.0,
            citation_frequency=0.0,
            processed_at=datetime.now(timezone.utc),
            processing_time_ms=0,
            metadata={"error": error, "partial_result": True}
        )
    
    def _get_component_failures(self) -> Dict[str, int]:
        """Get the failure count for each component."""
        return {
            name: metrics["failure"]
            for name, metrics in self.component_metrics.items()
        }
    
    def get_processing_stats(self) -> Dict:
        """
        Get comprehensive processing statistics.
        
        Returns:
            Dictionary with detailed processing metrics
        """
        total_processed = max(self.processed_count, 1)
        
        # Calculate component statistics
        component_stats = {}
        for name, metrics in self.component_metrics.items():
            total = metrics["success"] + metrics["failure"]
            if total > 0:
                component_stats[name] = {
                    "success_rate": metrics["success"] / total,
                    "failure_rate": metrics["failure"] / total,
                    "avg_time": metrics["total_time"] / total,
                    "total_calls": total
                }
        
        return {
            "processed_count": self.processed_count,
            "error_count": self.error_count,
            "error_rate": self.error_count / max(self.processed_count + self.error_count, 1),
            "success_rate": self.processed_count / max(self.processed_count + self.error_count, 1),
            "component_stats": component_stats,
            "cache_enabled": self.enable_caching,
            "cache_size": len(self.cache) if self.cache else 0
        }
    
    def reset_metrics(self):
        """Reset all processing metrics."""
        self.processed_count = 0
        self.error_count = 0
        for metrics in self.component_metrics.values():
            metrics["success"] = 0
            metrics["failure"] = 0
            metrics["total_time"] = 0
        if self.cache:
            self.cache.clear()
        logger.info("Processing metrics reset")
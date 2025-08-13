"""Redis Stream consumer for processing AI responses."""

import asyncio
import signal
import sys
from typing import Dict, Any
from datetime import datetime
from src.config import settings
from src.storage import PostgresClient, RedisClient, CacheManager
from src.processors import ResponseProcessor
from src.models.schemas import AIResponse, MetricEvent
from src.monitoring.metrics import metrics_collector


class StreamConsumer:
    """Consume and process messages from Redis stream."""
    
    def __init__(self):
        self.redis = RedisClient()
        self.postgres = PostgresClient()
        self.cache = CacheManager()
        self.processor = ResponseProcessor()
        self.running = False
        self.processed_count = 0
        self.error_count = 0
    
    async def initialize(self):
        """Initialize all components."""
        print("Initializing Stream Consumer...")
        
        # Initialize storage
        await self.redis.initialize()
        await self.postgres.initialize()
        await self.cache.initialize()
        
        print("Stream Consumer initialized successfully")
    
    async def start(self):
        """Start consuming messages."""
        self.running = True
        print(f"Starting consumer: {settings.redis_consumer_name}")
        print(f"Input stream: {settings.redis_stream_input}")
        print(f"Output stream: {settings.redis_stream_output}")
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        # Start processing loop
        await self.process_loop()
    
    async def process_loop(self):
        """Main processing loop."""
        while self.running:
            try:
                # Check for abandoned messages periodically
                if self.processed_count % 100 == 0:
                    abandoned = await self.redis.claim_abandoned_messages()
                    if abandoned:
                        print(f"Claimed {len(abandoned)} abandoned messages")
                        for message_id, data in abandoned:
                            await self.process_message(message_id, data)
                
                # Consume new messages
                messages = await self.redis.consume_messages(
                    block_ms=settings.batch_timeout * 1000,
                    count=settings.batch_size
                )
                
                if messages:
                    print(f"Processing {len(messages)} messages")
                    
                    # Update stream lag metric
                    stream_length = await self.redis.get_stream_length(
                        settings.redis_stream_input
                    )
                    metrics_collector.set_stream_lag(stream_length)
                    
                    # Process messages
                    for message_id, data in messages:
                        await self.process_message(message_id, data)
                
                # Brief pause to prevent CPU spinning
                await asyncio.sleep(0.1)
                
            except Exception as e:
                print(f"Error in process loop: {e}")
                self.error_count += 1
                metrics_collector.record_processing_error("loop_error")
                await asyncio.sleep(5)  # Wait before retrying
    
    async def process_message(self, message_id: str, data: Dict[str, Any]):
        """Process a single message."""
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Parse AI response
            response = self._parse_response(data)
            
            # Check cache first
            cached = await self.cache.get_processed_response(response.id)
            if cached:
                print(f"Using cached result for {response.id}")
                metrics_collector.record_cache_operation("get", "hit")
                
                # Acknowledge message
                await self.redis.acknowledge_message(message_id)
                return
            
            metrics_collector.record_cache_operation("get", "miss")
            
            # Process response through NLP pipeline
            print(f"Processing response {response.id} from {response.platform}")
            processed = await self.processor.process(response)
            
            # Save to database
            await self._save_results(processed)
            
            # Cache result
            await self.cache.set_processed_response(
                response.id,
                processed.dict()
            )
            
            # Publish metrics to output stream
            await self._publish_metrics(processed)
            
            # Record metrics
            duration = asyncio.get_event_loop().time() - start_time
            metrics_collector.record_response_processed(response.platform, "success")
            metrics_collector.record_processing_time(response.platform, duration)
            metrics_collector.record_geo_score("default", response.platform, processed.geo_score)
            metrics_collector.record_share_of_voice("default", processed.share_of_voice)
            
            # Acknowledge message
            await self.redis.acknowledge_message(message_id)
            
            self.processed_count += 1
            print(f"Successfully processed {response.id} in {duration:.2f}s")
            
        except Exception as e:
            print(f"Error processing message {message_id}: {e}")
            self.error_count += 1
            
            # Record error metrics
            metrics_collector.record_response_processed(
                data.get("platform", "unknown"),
                "error"
            )
            metrics_collector.record_processing_error(type(e).__name__)
            
            # Send to failed queue
            await self.redis.send_to_failed_queue(
                message_id,
                str(e),
                data
            )
            
            # Still acknowledge to prevent reprocessing
            await self.redis.acknowledge_message(message_id)
    
    def _parse_response(self, data: Dict[str, Any]) -> AIResponse:
        """Parse message data into AIResponse."""
        return AIResponse(
            id=data.get("id", ""),
            platform=data.get("platform", "unknown"),
            prompt_text=data.get("promptText", ""),
            response_text=data.get("responseText", ""),
            citations=data.get("citations", []),
            metadata=data.get("metadata", {}),
            collected_at=datetime.fromisoformat(
                data.get("collectedAt", datetime.utcnow().isoformat())
            )
        )
    
    async def _save_results(self, processed):
        """Save processing results to database."""
        try:
            # Save processed response
            response_id = await self.postgres.save_processed_response(processed)
            
            # Extract brand mentions and save
            brand_mentions = []
            for entity in processed.entities:
                if entity.type in ["BRAND", "COMPETITOR"]:
                    # This would be enhanced with proper brand mapping
                    brand_mentions.append({
                        "brand_id": "00000000-0000-0000-0000-000000000000",
                        "brand_name": entity.text,
                        "mention_text": entity.context or entity.text,
                        "sentiment_score": processed.sentiment.score if processed.sentiment else 0,
                        "sentiment_label": processed.sentiment.label if processed.sentiment else "NEUTRAL",
                        "confidence": entity.confidence,
                        "position": entity.start_pos,
                        "context": entity.context,
                        "platform": processed.platform
                    })
            
            if brand_mentions:
                await self.postgres.save_brand_mentions(brand_mentions, response_id)
            
            # Save content gaps
            if processed.gaps:
                await self.postgres.save_content_gaps(
                    processed.gaps,
                    "00000000-0000-0000-0000-000000000000"  # Default brand ID
                )
            
            # Update citation sources
            for citation in processed.citations:
                if citation.domain:
                    await self.postgres.update_citation_source(
                        citation.domain,
                        citation.authority_score
                    )
            
        except Exception as e:
            print(f"Database save error: {e}")
            metrics_collector.record_db_error("processed_responses")
            raise
    
    async def _publish_metrics(self, processed):
        """Publish calculated metrics to output stream."""
        metric_event = MetricEvent(
            type="geo_metrics",
            brand_id="00000000-0000-0000-0000-000000000000",  # Default brand ID
            metrics={
                "geo_score": processed.geo_score,
                "share_of_voice": processed.share_of_voice,
                "citation_frequency": processed.citation_frequency,
                "sentiment_score": processed.sentiment.score if processed.sentiment else 0,
                "relevance_score": processed.relevance.score if processed.relevance else 0,
                "authority_score": processed.authority_score,
                "gaps_count": len(processed.gaps),
                "platform": processed.platform,
                "response_id": processed.response_id
            }
        )
        
        await self.redis.publish_metrics(metric_event.dict())
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        print(f"\nReceived signal {signum}, shutting down...")
        self.running = False
    
    async def shutdown(self):
        """Cleanup and shutdown."""
        print("Shutting down Stream Consumer...")
        self.running = False
        
        # Close connections
        await self.redis.close()
        await self.postgres.close()
        await self.cache.close()
        
        print(f"Processed {self.processed_count} messages with {self.error_count} errors")
        print("Stream Consumer shutdown complete")
    
    def get_stats(self) -> Dict:
        """Get consumer statistics."""
        return {
            "processed_count": self.processed_count,
            "error_count": self.error_count,
            "error_rate": self.error_count / max(self.processed_count, 1),
            "running": self.running
        }


async def main():
    """Main entry point for consumer."""
    consumer = StreamConsumer()
    
    try:
        await consumer.initialize()
        await consumer.start()
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    except Exception as e:
        print(f"Fatal error: {e}")
    finally:
        await consumer.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
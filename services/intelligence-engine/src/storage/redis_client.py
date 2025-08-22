"""Redis client for stream processing."""

import json
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import redis.asyncio as redis
from src.config import settings


class RedisClient:
    """Async Redis client for stream processing."""
    
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self.consumer_group = settings.redis_consumer_group
        self.consumer_name = settings.redis_consumer_name
        self.input_stream = settings.redis_stream_input
        self.output_stream = settings.redis_stream_output
        self.failed_stream = settings.redis_stream_failed
    
    async def initialize(self):
        """Initialize Redis connection."""
        # Only include password if it's set and not empty
        redis_kwargs = {
            'host': settings.redis_host,
            'port': settings.redis_port,
            'db': settings.redis_db,
            'decode_responses': True
        }
        # Check for actual password value, not empty string
        if settings.redis_password and settings.redis_password.strip():
            redis_kwargs['password'] = settings.redis_password
            
        self.redis = redis.Redis(**redis_kwargs)
        
        # Create consumer group if not exists
        await self.create_consumer_group()
    
    async def close(self):
        """Close Redis connection."""
        if self.redis:
            await self.redis.close()
    
    async def create_consumer_group(self):
        """Create consumer group for stream processing."""
        try:
            await self.redis.xgroup_create(
                self.input_stream,
                self.consumer_group,
                id="0",
                mkstream=True
            )
        except redis.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise
    
    async def consume_messages(
        self,
        block_ms: int = 5000,
        count: int = 10
    ) -> List[Tuple[str, Dict]]:
        """
        Consume messages from input stream.
        
        Returns:
            List of (message_id, data) tuples
        """
        try:
            messages = await self.redis.xreadgroup(
                self.consumer_group,
                self.consumer_name,
                {self.input_stream: ">"},
                block=block_ms,
                count=count
            )
            
            if not messages:
                return []
            
            result = []
            for stream_name, stream_messages in messages:
                for message_id, data in stream_messages:
                    # Parse JSON data
                    parsed_data = {}
                    for key, value in data.items():
                        try:
                            parsed_data[key] = json.loads(value) if value else None
                        except (json.JSONDecodeError, TypeError):
                            parsed_data[key] = value
                    
                    result.append((message_id, parsed_data))
            
            return result
            
        except Exception as e:
            print(f"Error consuming messages: {e}")
            return []
    
    async def acknowledge_message(self, message_id: str):
        """Acknowledge a processed message."""
        await self.redis.xack(
            self.input_stream,
            self.consumer_group,
            message_id
        )
    
    async def publish_metrics(self, metrics: Dict[str, Any]):
        """Publish calculated metrics to output stream."""
        # Serialize data
        serialized = {}
        for key, value in metrics.items():
            if isinstance(value, (dict, list)):
                serialized[key] = json.dumps(value)
            elif isinstance(value, datetime):
                serialized[key] = value.isoformat()
            else:
                serialized[key] = str(value)
        
        # Add to stream
        message_id = await self.redis.xadd(
            self.output_stream,
            serialized,
            maxlen=10000  # Keep last 10k messages
        )
        
        return message_id
    
    async def send_to_failed_queue(
        self,
        message_id: str,
        error: str,
        original_data: Dict,
        retry_count: int = 0,
        is_recoverable: bool = False
    ):
        """Send failed message to dead letter queue with retry tracking."""
        # Preserve retry count in the data
        if 'retry_count' not in original_data:
            original_data['retry_count'] = retry_count
        else:
            original_data['retry_count'] = retry_count
            
        failed_data = {
            "original_id": message_id,
            "error": error,
            "failed_at": datetime.utcnow().isoformat(),
            "retry_count": str(retry_count),
            "is_recoverable": "true" if is_recoverable else "false",
            "original_data": json.dumps(original_data)
        }
        
        await self.redis.xadd(
            self.failed_stream,
            failed_data,
            maxlen=1000  # Keep last 1k failed messages
        )
    
    async def get_stream_info(self, stream_name: str) -> Dict:
        """Get information about a stream."""
        info = await self.redis.xinfo_stream(stream_name)
        return info
    
    async def get_consumer_info(self) -> List[Dict]:
        """Get information about consumers in the group."""
        consumers = await self.redis.xinfo_consumers(
            self.input_stream,
            self.consumer_group
        )
        return consumers
    
    async def get_pending_messages(self) -> List[Dict]:
        """Get pending messages for this consumer."""
        pending = await self.redis.xpending(
            self.input_stream,
            self.consumer_group
        )
        return pending
    
    async def claim_abandoned_messages(
        self,
        min_idle_time: int = 60000  # 1 minute
    ) -> List[Tuple[str, Dict]]:
        """Claim messages abandoned by other consumers."""
        # Get pending messages
        pending = await self.redis.xpending_range(
            self.input_stream,
            self.consumer_group,
            min="-",
            max="+",
            count=10
        )
        
        if not pending:
            return []
        
        # Claim old messages
        message_ids = [msg["message_id"] for msg in pending if msg["time_since_delivered"] > min_idle_time]
        
        if not message_ids:
            return []
        
        claimed = await self.redis.xclaim(
            self.input_stream,
            self.consumer_group,
            self.consumer_name,
            min_idle_time,
            message_ids
        )
        
        result = []
        for message_id, data in claimed:
            parsed_data = {}
            for key, value in data.items():
                try:
                    parsed_data[key] = json.loads(value) if value else None
                except (json.JSONDecodeError, TypeError):
                    parsed_data[key] = value
            result.append((message_id, parsed_data))
        
        return result
    
    async def get_stream_length(self, stream_name: str) -> int:
        """Get the number of messages in a stream."""
        return await self.redis.xlen(stream_name)
    
    async def trim_stream(self, stream_name: str, max_len: int):
        """Trim stream to maximum length."""
        await self.redis.xtrim(stream_name, maxlen=max_len, approximate=True)
    
    async def health_check(self) -> bool:
        """Check Redis connection health."""
        try:
            await self.redis.ping()
            return True
        except Exception:
            return False
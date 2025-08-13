"""Cache manager for computed results."""

import json
import hashlib
from typing import Any, Optional, Dict
from datetime import datetime, timedelta
import redis.asyncio as redis
from src.config import settings


class CacheManager:
    """Manage caching of computed NLP results."""
    
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self.enabled = settings.cache_enabled
        self.ttl = settings.cache_ttl_seconds
        self.namespace = "intelligence:cache"
    
    async def initialize(self):
        """Initialize cache connection."""
        if not self.enabled:
            return
        
        self.redis = redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            db=settings.redis_db,
            password=settings.redis_password,
            decode_responses=True
        )
    
    async def close(self):
        """Close cache connection."""
        if self.redis:
            await self.redis.close()
    
    def _generate_key(self, prefix: str, data: Any) -> str:
        """Generate cache key from data."""
        # Create hash of data
        if isinstance(data, dict):
            data_str = json.dumps(data, sort_keys=True)
        else:
            data_str = str(data)
        
        hash_digest = hashlib.md5(data_str.encode()).hexdigest()
        return f"{self.namespace}:{prefix}:{hash_digest}"
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.enabled or not self.redis:
            return None
        
        try:
            value = await self.redis.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            print(f"Cache get error: {e}")
        
        return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ):
        """Set value in cache."""
        if not self.enabled or not self.redis:
            return
        
        try:
            serialized = json.dumps(value, default=str)
            ttl = ttl or self.ttl
            await self.redis.setex(key, ttl, serialized)
        except Exception as e:
            print(f"Cache set error: {e}")
    
    async def get_sentiment(self, text: str) -> Optional[Dict]:
        """Get cached sentiment analysis result."""
        key = self._generate_key("sentiment", text[:500])
        return await self.get(key)
    
    async def set_sentiment(self, text: str, sentiment: Dict):
        """Cache sentiment analysis result."""
        key = self._generate_key("sentiment", text[:500])
        await self.set(key, sentiment)
    
    async def get_relevance(self, query: str, response: str) -> Optional[Dict]:
        """Get cached relevance score."""
        key = self._generate_key("relevance", {
            "query": query[:200],
            "response": response[:500]
        })
        return await self.get(key)
    
    async def set_relevance(self, query: str, response: str, relevance: Dict):
        """Cache relevance score."""
        key = self._generate_key("relevance", {
            "query": query[:200],
            "response": response[:500]
        })
        await self.set(key, relevance)
    
    async def get_entities(self, text: str) -> Optional[list]:
        """Get cached entity detection result."""
        key = self._generate_key("entities", text[:1000])
        return await self.get(key)
    
    async def set_entities(self, text: str, entities: list):
        """Cache entity detection result."""
        key = self._generate_key("entities", text[:1000])
        await self.set(key, entities)
    
    async def get_processed_response(self, response_id: str) -> Optional[Dict]:
        """Get cached processed response."""
        key = f"{self.namespace}:response:{response_id}"
        return await self.get(key)
    
    async def set_processed_response(
        self,
        response_id: str,
        processed: Dict
    ):
        """Cache processed response."""
        key = f"{self.namespace}:response:{response_id}"
        # Shorter TTL for responses (1 hour)
        await self.set(key, processed, ttl=3600)
    
    async def invalidate(self, pattern: str):
        """Invalidate cache entries matching pattern."""
        if not self.redis:
            return
        
        try:
            cursor = 0
            while True:
                cursor, keys = await self.redis.scan(
                    cursor,
                    match=f"{self.namespace}:{pattern}*",
                    count=100
                )
                
                if keys:
                    await self.redis.delete(*keys)
                
                if cursor == 0:
                    break
        except Exception as e:
            print(f"Cache invalidation error: {e}")
    
    async def get_stats(self) -> Dict:
        """Get cache statistics."""
        if not self.redis:
            return {}
        
        try:
            info = await self.redis.info("stats")
            keys_count = await self.redis.dbsize()
            
            return {
                "enabled": self.enabled,
                "keys_count": keys_count,
                "hit_rate": info.get("keyspace_hits", 0) / 
                           max(info.get("keyspace_hits", 0) + info.get("keyspace_misses", 1), 1),
                "memory_used": info.get("used_memory_human", "0"),
                "evicted_keys": info.get("evicted_keys", 0)
            }
        except Exception:
            return {"enabled": self.enabled, "error": "Failed to get stats"}
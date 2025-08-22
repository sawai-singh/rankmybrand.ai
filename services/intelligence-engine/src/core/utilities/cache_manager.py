"""
Enhanced Redis Cache Manager for AI Visibility Audit
Intelligent caching with TTL management, pre-warming, and deduplication
"""

import json
import hashlib
import asyncio
from typing import Dict, List, Any, Optional, Set, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import redis.asyncio as redis
from redis.asyncio.lock import Lock
import msgpack
import zlib
import logging

logger = logging.getLogger(__name__)


@dataclass
class CacheConfig:
    """Cache configuration with intelligent TTL management"""
    
    # TTL configurations (in seconds)
    query_result_ttl: int = 3600  # 1 hour for LLM responses
    analysis_result_ttl: int = 7200  # 2 hours for analysis results
    audit_summary_ttl: int = 86400  # 24 hours for audit summaries
    query_generation_ttl: int = 1800  # 30 minutes for generated queries
    
    # Cache size limits
    max_cached_responses_per_query: int = 100
    max_cached_audits: int = 1000
    
    # Compression settings
    compression_threshold: int = 1024  # Compress if larger than 1KB
    compression_level: int = 6  # zlib compression level (1-9)
    
    # Pre-warming settings
    prewarm_popular_queries: bool = True
    prewarm_batch_size: int = 10
    
    # Deduplication
    enable_deduplication: bool = True
    dedup_window_seconds: int = 60  # Prevent duplicate requests within window


class IntelligentCacheManager:
    """Advanced cache manager with intelligent features"""
    
    def __init__(
        self,
        redis_client: redis.Redis,
        config: Optional[CacheConfig] = None
    ):
        self.redis = redis_client
        self.config = config or CacheConfig()
        self.namespace = "ai_visibility"
        
        # Track cache statistics
        self.stats = {
            'hits': 0,
            'misses': 0,
            'compressed_saves': 0,
            'dedup_prevented': 0
        }
        
        # In-memory LRU cache for hot data
        self.hot_cache: Dict[str, Tuple[Any, datetime]] = {}
        self.hot_cache_max_size = 100
    
    # =====================================================
    # Key Generation
    # =====================================================
    
    def _generate_key(self, prefix: str, *components) -> str:
        """Generate consistent cache keys"""
        parts = [self.namespace, prefix]
        for component in components:
            if isinstance(component, (dict, list)):
                parts.append(hashlib.md5(json.dumps(component, sort_keys=True).encode()).hexdigest()[:12])
            else:
                parts.append(str(component))
        return ":".join(parts)
    
    def _hash_query(self, query: str, provider: Optional[str] = None) -> str:
        """Generate hash for query deduplication"""
        content = f"{query}:{provider or 'any'}"
        return hashlib.sha256(content.encode()).hexdigest()
    
    # =====================================================
    # Compression
    # =====================================================
    
    def _compress_data(self, data: Any) -> bytes:
        """Compress data if above threshold"""
        serialized = msgpack.packb(data, use_bin_type=True)
        
        if len(serialized) > self.config.compression_threshold:
            compressed = zlib.compress(serialized, self.config.compression_level)
            self.stats['compressed_saves'] += 1
            # Add compression marker
            return b'COMPRESSED:' + compressed
        
        return serialized
    
    def _decompress_data(self, data: bytes) -> Any:
        """Decompress data if compressed"""
        if data.startswith(b'COMPRESSED:'):
            decompressed = zlib.decompress(data[11:])
            return msgpack.unpackb(decompressed, raw=False)
        
        return msgpack.unpackb(data, raw=False)
    
    # =====================================================
    # Core Cache Operations
    # =====================================================
    
    async def get(
        self,
        key: str,
        check_hot_cache: bool = True
    ) -> Optional[Any]:
        """Get value from cache with hot cache check"""
        
        # Check hot cache first
        if check_hot_cache and key in self.hot_cache:
            value, timestamp = self.hot_cache[key]
            if (datetime.now() - timestamp).seconds < 60:  # Hot cache TTL: 1 minute
                self.stats['hits'] += 1
                return value
        
        try:
            data = await self.redis.get(key)
            if data:
                self.stats['hits'] += 1
                value = self._decompress_data(data)
                
                # Update hot cache
                self._update_hot_cache(key, value)
                
                return value
        except Exception as e:
            logger.error(f"Cache get error for {key}: {e}")
        
        self.stats['misses'] += 1
        return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        compress: bool = True
    ) -> bool:
        """Set value in cache with optional compression"""
        
        try:
            data = self._compress_data(value) if compress else msgpack.packb(value)
            
            if ttl:
                await self.redis.set(key, data, ex=ttl)
            else:
                await self.redis.set(key, data)
            
            # Update hot cache
            self._update_hot_cache(key, value)
            
            return True
        except Exception as e:
            logger.error(f"Cache set error for {key}: {e}")
            return False
    
    def _update_hot_cache(self, key: str, value: Any):
        """Update in-memory hot cache with LRU eviction"""
        
        self.hot_cache[key] = (value, datetime.now())
        
        # Evict oldest if cache is full
        if len(self.hot_cache) > self.hot_cache_max_size:
            oldest_key = min(self.hot_cache, key=lambda k: self.hot_cache[k][1])
            del self.hot_cache[oldest_key]
    
    # =====================================================
    # LLM Response Caching
    # =====================================================
    
    async def cache_llm_response(
        self,
        query: str,
        provider: str,
        response: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> str:
        """Cache LLM response with intelligent key generation"""
        
        query_hash = self._hash_query(query, provider)
        key = self._generate_key("llm_response", provider, query_hash)
        
        ttl = ttl or self.config.query_result_ttl
        
        # Store response with metadata
        cache_data = {
            'response': response,
            'cached_at': datetime.now().isoformat(),
            'query': query[:100],  # Store truncated query for debugging
            'provider': provider
        }
        
        await self.set(key, cache_data, ttl)
        
        # Also store in query index for batch retrieval
        index_key = self._generate_key("query_index", query_hash)
        await self.redis.sadd(index_key, provider)
        await self.redis.expire(index_key, ttl)
        
        return key
    
    async def get_llm_response(
        self,
        query: str,
        provider: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached LLM response"""
        
        query_hash = self._hash_query(query, provider)
        key = self._generate_key("llm_response", provider, query_hash)
        
        cache_data = await self.get(key)
        if cache_data:
            return cache_data.get('response')
        
        return None
    
    async def get_all_cached_providers(self, query: str) -> Set[str]:
        """Get all providers that have cached responses for a query"""
        
        query_hash = self._hash_query(query)
        index_key = self._generate_key("query_index", query_hash)
        
        providers = await self.redis.smembers(index_key)
        return set(providers) if providers else set()
    
    # =====================================================
    # Analysis Result Caching
    # =====================================================
    
    async def cache_analysis_result(
        self,
        response_text: str,
        brand: str,
        competitors: List[str],
        analysis: Dict[str, Any]
    ) -> str:
        """Cache analysis results"""
        
        # Create deterministic key
        content_hash = hashlib.md5(
            f"{response_text[:500]}:{brand}:{':'.join(sorted(competitors))}".encode()
        ).hexdigest()
        
        key = self._generate_key("analysis", content_hash)
        
        cache_data = {
            'analysis': analysis,
            'brand': brand,
            'competitors': competitors,
            'cached_at': datetime.now().isoformat()
        }
        
        await self.set(key, cache_data, self.config.analysis_result_ttl)
        return key
    
    async def get_analysis_result(
        self,
        response_text: str,
        brand: str,
        competitors: List[str]
    ) -> Optional[Dict[str, Any]]:
        """Get cached analysis result"""
        
        content_hash = hashlib.md5(
            f"{response_text[:500]}:{brand}:{':'.join(sorted(competitors))}".encode()
        ).hexdigest()
        
        key = self._generate_key("analysis", content_hash)
        
        cache_data = await self.get(key)
        if cache_data:
            return cache_data.get('analysis')
        
        return None
    
    # =====================================================
    # Audit Summary Caching
    # =====================================================
    
    async def cache_audit_summary(
        self,
        audit_id: str,
        summary: Dict[str, Any]
    ):
        """Cache audit summary for quick retrieval"""
        
        key = self._generate_key("audit_summary", audit_id)
        
        await self.set(key, summary, self.config.audit_summary_ttl)
        
        # Add to audit index
        await self.redis.zadd(
            f"{self.namespace}:audit_index",
            {audit_id: datetime.now().timestamp()}
        )
        
        # Trim old audits
        await self.redis.zremrangebyrank(
            f"{self.namespace}:audit_index",
            0,
            -self.config.max_cached_audits - 1
        )
    
    async def get_audit_summary(self, audit_id: str) -> Optional[Dict[str, Any]]:
        """Get cached audit summary"""
        
        key = self._generate_key("audit_summary", audit_id)
        return await self.get(key)
    
    # =====================================================
    # Request Deduplication
    # =====================================================
    
    async def check_duplicate_request(
        self,
        request_id: str,
        window_seconds: Optional[int] = None
    ) -> bool:
        """Check if request is duplicate within time window"""
        
        if not self.config.enable_deduplication:
            return False
        
        window = window_seconds or self.config.dedup_window_seconds
        key = self._generate_key("dedup", request_id)
        
        # Try to set with NX (only if not exists)
        result = await self.redis.set(key, "1", ex=window, nx=True)
        
        if not result:
            self.stats['dedup_prevented'] += 1
            return True  # Duplicate detected
        
        return False  # Not a duplicate
    
    async def acquire_processing_lock(
        self,
        resource_id: str,
        timeout: int = 300
    ) -> Optional[Lock]:
        """Acquire distributed lock for processing"""
        
        lock_key = self._generate_key("lock", resource_id)
        lock = Lock(self.redis, lock_key, timeout=timeout)
        
        acquired = await lock.acquire(blocking=False)
        if acquired:
            return lock
        
        return None
    
    # =====================================================
    # Cache Pre-warming
    # =====================================================
    
    async def prewarm_popular_queries(
        self,
        company_context: Dict[str, Any],
        executor_func = None
    ):
        """Pre-warm cache with popular queries"""
        
        if not self.config.prewarm_popular_queries or not executor_func:
            return
        
        # Get popular query patterns
        popular_patterns = await self._get_popular_query_patterns(company_context)
        
        # Execute in batches
        for i in range(0, len(popular_patterns), self.config.prewarm_batch_size):
            batch = popular_patterns[i:i + self.config.prewarm_batch_size]
            
            tasks = []
            for query in batch:
                # Check if already cached
                if not await self.get_llm_response(query, 'openai'):
                    tasks.append(executor_func(query))
            
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _get_popular_query_patterns(
        self,
        company_context: Dict[str, Any]
    ) -> List[str]:
        """Get popular query patterns for pre-warming"""
        
        industry = company_context.get('industry', '')
        company_name = company_context.get('name', '')
        
        patterns = [
            f"What is {company_name}",
            f"Best {industry} companies",
            f"{company_name} pricing",
            f"{company_name} reviews",
            f"{company_name} alternatives",
            f"How does {company_name} work",
            f"{industry} comparison",
            f"Top {industry} tools 2025"
        ]
        
        return patterns
    
    # =====================================================
    # Cache Analytics
    # =====================================================
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        
        # Calculate hit rate
        total_requests = self.stats['hits'] + self.stats['misses']
        hit_rate = (self.stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        # Get Redis memory info
        info = await self.redis.info('memory')
        
        return {
            'hit_rate': hit_rate,
            'total_hits': self.stats['hits'],
            'total_misses': self.stats['misses'],
            'compressed_saves': self.stats['compressed_saves'],
            'dedup_prevented': self.stats['dedup_prevented'],
            'hot_cache_size': len(self.hot_cache),
            'redis_memory_used': info.get('used_memory_human', 'N/A'),
            'redis_memory_peak': info.get('used_memory_peak_human', 'N/A')
        }
    
    async def clear_cache_pattern(self, pattern: str):
        """Clear cache entries matching pattern"""
        
        cursor = 0
        count = 0
        
        while True:
            cursor, keys = await self.redis.scan(
                cursor,
                match=f"{self.namespace}:{pattern}*",
                count=100
            )
            
            if keys:
                await self.redis.delete(*keys)
                count += len(keys)
            
            if cursor == 0:
                break
        
        return count
    
    # =====================================================
    # Batch Operations
    # =====================================================
    
    async def batch_get(self, keys: List[str]) -> Dict[str, Any]:
        """Get multiple values in batch"""
        
        if not keys:
            return {}
        
        # Use pipeline for efficiency
        pipe = self.redis.pipeline()
        for key in keys:
            pipe.get(key)
        
        results = await pipe.execute()
        
        decoded_results = {}
        for key, data in zip(keys, results):
            if data:
                try:
                    decoded_results[key] = self._decompress_data(data)
                    self.stats['hits'] += 1
                except Exception as e:
                    logger.error(f"Error decoding {key}: {e}")
                    self.stats['misses'] += 1
            else:
                self.stats['misses'] += 1
        
        return decoded_results
    
    async def batch_set(
        self,
        items: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> int:
        """Set multiple values in batch"""
        
        if not items:
            return 0
        
        pipe = self.redis.pipeline()
        
        for key, value in items.items():
            data = self._compress_data(value)
            if ttl:
                pipe.set(key, data, ex=ttl)
            else:
                pipe.set(key, data)
        
        results = await pipe.execute()
        return sum(1 for r in results if r)
    
    # =====================================================
    # Cache Maintenance
    # =====================================================
    
    async def cleanup_expired_entries(self):
        """Clean up expired cache entries (Redis handles this automatically)"""
        
        # Clear hot cache of old entries
        now = datetime.now()
        keys_to_remove = []
        
        for key, (_, timestamp) in self.hot_cache.items():
            if (now - timestamp).seconds > 300:  # Remove if older than 5 minutes
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.hot_cache[key]
        
        return len(keys_to_remove)
    
    async def optimize_memory(self):
        """Optimize Redis memory usage"""
        
        # Run Redis memory optimization
        await self.redis.memory_purge()
        
        # Get fragmentation ratio
        info = await self.redis.info('memory')
        fragmentation = info.get('mem_fragmentation_ratio', 1.0)
        
        # If fragmentation is high, consider restart (in production)
        if fragmentation > 1.5:
            logger.warning(f"High memory fragmentation detected: {fragmentation}")
        
        return fragmentation

# Alias for backward compatibility
CacheManager = IntelligentCacheManager

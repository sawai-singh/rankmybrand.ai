"""
Multi-LLM Orchestration Service
Enterprise-grade orchestration with circuit breakers, retry logic, and parallel execution
"""

import asyncio
import time
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import aiohttp
import json
import logging
from asyncio import Semaphore
from collections import defaultdict, deque
import hashlib
from contextlib import asynccontextmanager

from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
import google.generativeai as genai
import backoff

from src.config import settings

logger = logging.getLogger(__name__)


class LLMProvider(Enum):
    """Supported LLM providers"""
    OPENAI_GPT5 = "openai_gpt5"
    ANTHROPIC_CLAUDE = "anthropic_claude"
    GOOGLE_GEMINI = "google_gemini"
    PERPLEXITY = "perplexity"


@dataclass
class LLMResponse:
    """Structured response from LLM"""
    provider: LLMProvider
    query: str
    response_text: str
    response_time_ms: float
    tokens_used: Optional[int]
    model_version: str
    timestamp: datetime = field(default_factory=datetime.now)
    error: Optional[str] = None
    retry_count: int = 0
    cache_hit: bool = False
    request_id: str = field(default_factory=lambda: hashlib.md5(
        f"{time.time()}".encode()).hexdigest()[:12])
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker configuration per provider"""
    failure_threshold: int = 5
    recovery_timeout: int = 60  # seconds
    half_open_requests: int = 3
    fallback_provider: Optional[LLMProvider] = None


@dataclass
class RateLimitConfig:
    """Rate limiting configuration"""
    requests_per_minute: int
    requests_per_hour: int
    concurrent_requests: int
    burst_size: int = 10


class CircuitBreaker:
    """Improved circuit breaker with half-open state"""
    
    def __init__(self, config: CircuitBreakerConfig):
        self.config = config
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half_open
        self.half_open_successes = 0
        self.state_history = deque(maxlen=100)  # Keep last 100 state changes
    
    def record_success(self):
        """Record successful request"""
        if self.state == "half_open":
            self.half_open_successes += 1
            if self.half_open_successes >= self.config.half_open_requests:
                self.close()
        elif self.state == "closed":
            self.failure_count = 0
    
    def record_failure(self):
        """Record failed request"""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.config.failure_threshold:
            self.open()
        
        if self.state == "half_open":
            self.open()
    
    def open(self):
        """Open the circuit"""
        self.state = "open"
        self.state_history.append(("open", datetime.now()))
        logger.warning(f"Circuit breaker opened after {self.failure_count} failures")
    
    def close(self):
        """Close the circuit"""
        self.state = "closed"
        self.failure_count = 0
        self.half_open_successes = 0
        self.state_history.append(("closed", datetime.now()))
        logger.info("Circuit breaker closed")
    
    def is_available(self) -> bool:
        """Check if circuit allows requests"""
        if self.state == "closed":
            return True
        
        if self.state == "open" and self.last_failure_time:
            time_since_failure = (datetime.now() - self.last_failure_time).total_seconds()
            if time_since_failure > self.config.recovery_timeout:
                self.state = "half_open"
                self.half_open_successes = 0
                self.state_history.append(("half_open", datetime.now()))
                return True
        
        return self.state == "half_open"


class RequestDeduplicator:
    """Prevent duplicate requests within a time window"""
    
    def __init__(self, window_seconds: int = 60):
        self.window = window_seconds
        self.recent_requests = {}
        self._cleanup_task = None
    
    def get_request_key(self, query: str, provider: LLMProvider) -> str:
        """Generate unique key for request"""
        return hashlib.md5(f"{query}:{provider.value}".encode()).hexdigest()
    
    async def check_duplicate(self, query: str, provider: LLMProvider) -> Optional[LLMResponse]:
        """Check if request was recently made"""
        key = self.get_request_key(query, provider)
        
        if key in self.recent_requests:
            cached_time, response = self.recent_requests[key]
            if time.time() - cached_time < self.window:
                logger.debug(f"Duplicate request detected for {provider}")
                response.cache_hit = True
                return response
        
        return None
    
    def store_response(self, query: str, provider: LLMProvider, response: LLMResponse):
        """Store response for deduplication"""
        key = self.get_request_key(query, provider)
        self.recent_requests[key] = (time.time(), response)
    
    async def cleanup_old_entries(self):
        """Remove old entries periodically"""
        while True:
            await asyncio.sleep(self.window)
            current_time = time.time()
            self.recent_requests = {
                k: v for k, v in self.recent_requests.items()
                if current_time - v[0] < self.window
            }


class ProviderHealthMonitor:
    """Enhanced health monitoring with auto-recovery"""
    
    def __init__(self):
        self.metrics = defaultdict(lambda: {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'total_latency_ms': 0,
            'error_types': defaultdict(int),
            'last_success': None,
            'last_failure': None,
            'avg_latency_ms': 0,
            'success_rate': 1.0,
            'health_score': 1.0  # 0-1, considers multiple factors
        })
        self.latency_history = defaultdict(lambda: deque(maxlen=100))
    
    def record_success(self, provider: LLMProvider, latency_ms: float):
        """Record successful request"""
        metrics = self.metrics[provider]
        metrics['total_requests'] += 1
        metrics['successful_requests'] += 1
        metrics['total_latency_ms'] += latency_ms
        metrics['last_success'] = datetime.now()
        
        # Update rolling averages
        self.latency_history[provider].append(latency_ms)
        metrics['avg_latency_ms'] = sum(self.latency_history[provider]) / len(self.latency_history[provider])
        metrics['success_rate'] = metrics['successful_requests'] / metrics['total_requests']
        
        # Calculate health score
        self._update_health_score(provider)
    
    def record_failure(self, provider: LLMProvider, error_type: str):
        """Record failed request"""
        metrics = self.metrics[provider]
        metrics['total_requests'] += 1
        metrics['failed_requests'] += 1
        metrics['error_types'][error_type] += 1
        metrics['last_failure'] = datetime.now()
        metrics['success_rate'] = metrics['successful_requests'] / metrics['total_requests']
        
        self._update_health_score(provider)
    
    def _update_health_score(self, provider: LLMProvider):
        """Calculate overall health score"""
        metrics = self.metrics[provider]
        
        # Factors: success rate (50%), latency (30%), recency (20%)
        success_factor = metrics['success_rate'] * 0.5
        
        # Normalize latency (assume 2000ms is bad, 200ms is good)
        latency_factor = max(0, min(1, (2000 - metrics['avg_latency_ms']) / 1800)) * 0.3
        
        # Recency factor
        if metrics['last_success']:
            time_since_success = (datetime.now() - metrics['last_success']).total_seconds()
            recency_factor = max(0, min(1, (300 - time_since_success) / 300)) * 0.2
        else:
            recency_factor = 0
        
        metrics['health_score'] = success_factor + latency_factor + recency_factor
    
    def get_healthiest_provider(self, providers: List[LLMProvider]) -> Optional[LLMProvider]:
        """Get the healthiest available provider"""
        if not providers:
            return None
        
        return max(providers, key=lambda p: self.metrics[p]['health_score'])


@dataclass
class OrchestratorConfig:
    """Configuration for LLM Orchestrator"""
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    perplexity_api_key: Optional[str] = None
    max_parallel_requests: int = 10
    request_timeout: int = 30
    circuit_breaker_threshold: int = 5
    circuit_breaker_timeout: int = 300  # For backward compatibility
    enable_deduplication: bool = True
    enable_circuit_breaker: bool = True
    cache_enabled: bool = True
    cache_ttl: int = 300


class LLMOrchestrator:
    """Multi-LLM Orchestration Service"""
    
    def __init__(
        self,
        config: Optional[OrchestratorConfig] = None,
        openai_api_key: Optional[str] = None,
        anthropic_api_key: Optional[str] = None,
        google_api_key: Optional[str] = None,
        perplexity_api_key: Optional[str] = None,
        max_parallel_requests: int = 10,
        request_timeout: int = 30,
        enable_deduplication: bool = True,
        enable_circuit_breaker: bool = True
    ):
        """Initialize orchestrator with improved configuration"""
        
        # Handle config object if provided
        if config:
            openai_api_key = config.openai_api_key or openai_api_key
            anthropic_api_key = config.anthropic_api_key or anthropic_api_key
            google_api_key = config.google_api_key or google_api_key
            perplexity_api_key = config.perplexity_api_key or perplexity_api_key
            max_parallel_requests = config.max_parallel_requests
            request_timeout = config.request_timeout
            enable_deduplication = config.enable_deduplication
            enable_circuit_breaker = config.enable_circuit_breaker
            self.cache_ttl = config.cache_ttl
        else:
            self.cache_ttl = 300  # Default 5 minutes
        
        # API Keys from config, parameters, or settings
        self.openai_key = openai_api_key or settings.openai_api_key
        self.anthropic_key = anthropic_api_key or settings.anthropic_api_key
        self.google_key = google_api_key or settings.gemini_api_key
        self.perplexity_key = perplexity_api_key or settings.perplexity_api_key
        
        # Configuration
        self.request_timeout = request_timeout
        self.max_parallel = max_parallel_requests
        
        # Initialize clients
        self.clients = {}
        self._initialize_clients()
        
        # Shared aiohttp session for better connection pooling
        self.session = None
        
        # Circuit breakers
        self.circuit_breakers = {}
        if enable_circuit_breaker:
            self._initialize_circuit_breakers()
        
        # Rate limiting
        self.semaphores = {
            LLMProvider.OPENAI_GPT5: Semaphore(5),
            LLMProvider.ANTHROPIC_CLAUDE: Semaphore(5),
            LLMProvider.GOOGLE_GEMINI: Semaphore(10),
            LLMProvider.PERPLEXITY: Semaphore(3),
        }
        
        # Health monitoring
        self.health_monitor = ProviderHealthMonitor()
        
        # Request deduplication
        self.deduplicator = RequestDeduplicator() if enable_deduplication else None
        
        # Cache for responses
        self.response_cache = {}
        # cache_ttl already set above from config or default
    
    def _initialize_clients(self):
        """Initialize LLM clients"""
        if self.openai_key:
            self.clients[LLMProvider.OPENAI_GPT5] = AsyncOpenAI(api_key=self.openai_key)
        
        if self.anthropic_key:
            self.clients[LLMProvider.ANTHROPIC_CLAUDE] = AsyncAnthropic(api_key=self.anthropic_key)
        
        if self.google_key:
            genai.configure(api_key=self.google_key)
            self.gemini_model = genai.GenerativeModel('gemini-2.5-flash')
            self.clients[LLMProvider.GOOGLE_GEMINI] = self.gemini_model
        
        if self.perplexity_key:
            # Perplexity uses HTTP API, so we mark it as available
            self.clients[LLMProvider.PERPLEXITY] = "perplexity_http"
    
    def _initialize_circuit_breakers(self):
        """Initialize circuit breakers with fallback chains"""
        self.circuit_breakers = {
            LLMProvider.OPENAI_GPT5: CircuitBreaker(
                CircuitBreakerConfig(fallback_provider=LLMProvider.ANTHROPIC_CLAUDE)
            ),
            LLMProvider.ANTHROPIC_CLAUDE: CircuitBreaker(
                CircuitBreakerConfig(fallback_provider=LLMProvider.GOOGLE_GEMINI)
            ),
            LLMProvider.GOOGLE_GEMINI: CircuitBreaker(
                CircuitBreakerConfig(fallback_provider=LLMProvider.PERPLEXITY)
            ),
            LLMProvider.PERPLEXITY: CircuitBreaker(
                CircuitBreakerConfig(fallback_provider=None)
            ),
        }
    
    @asynccontextmanager
    async def get_session(self):
        """Get or create aiohttp session"""
        if not self.session:
            connector = aiohttp.TCPConnector(
                limit=100,
                limit_per_host=30,
                ttl_dns_cache=300
            )
            self.session = aiohttp.ClientSession(
                connector=connector,
                timeout=aiohttp.ClientTimeout(total=self.request_timeout)
            )
        try:
            yield self.session
        finally:
            pass  # Keep session alive for reuse
    
    async def execute_audit_queries(
        self,
        queries: List[str],
        providers: Optional[List[LLMProvider]] = None,
        parallel_execution: bool = True,
        use_cache: bool = True,
        use_fallback: bool = True,
        priority_queries: Optional[List[str]] = None,
        response_callback: Optional[callable] = None
    ) -> Dict[str, List[LLMResponse]]:
        """Execute queries across multiple LLMs with improved resilience"""
        
        if providers is None:
            providers = list(self.clients.keys())
        
        # Filter available providers
        available_providers = [
            p for p in providers 
            if p in self.clients and (
                not hasattr(self, 'circuit_breakers') or 
                self.circuit_breakers[p].is_available()
            )
        ]
        
        if not available_providers:
            logger.error("No available providers")
            return {}
        
        results = defaultdict(list)
        
        # Handle priority queries first
        if priority_queries:
            priority_set = set(priority_queries)
            queries = [q for q in queries if q in priority_set] + \
                     [q for q in queries if q not in priority_set]
        
        if parallel_execution:
            # Batch queries for better performance
            batch_size = self.max_parallel // len(available_providers)
            
            for i in range(0, len(queries), batch_size):
                batch = queries[i:i + batch_size]
                tasks = []
                
                for query in batch:
                    # Check deduplication
                    if self.deduplicator:
                        for provider in available_providers:
                            cached = await self.deduplicator.check_duplicate(query, provider)
                            if cached:
                                results[query].append(cached)
                                continue
                            
                            task = self._execute_with_resilience(
                                query, provider, use_cache, use_fallback
                            )
                            tasks.append((query, provider, task))
                    else:
                        for provider in available_providers:
                            task = self._execute_with_resilience(
                                query, provider, use_cache, use_fallback
                            )
                            tasks.append((query, provider, task))
                
                # Execute batch with independent provider processing
                if tasks:
                    # Create a mapping of tasks to their metadata
                    # This avoids the index lookup issue with asyncio.as_completed
                    task_map = {}
                    
                    for query, provider, task in tasks:
                        # Create a wrapper that includes metadata
                        async def task_wrapper(q=query, p=provider, t=task):
                            try:
                                result = await t
                                return (q, p, result, None)
                            except Exception as e:
                                return (q, p, None, e)
                        
                        task_map[asyncio.create_task(task_wrapper())] = (query, provider)
                    
                    # Process results as they complete, not waiting for all
                    completed_count = 0
                    failed_providers = set()
                    provider_failure_counts = defaultdict(int)  # Track failures per provider

                    for completed_task in asyncio.as_completed(task_map.keys()):
                        try:
                            query, provider, result, error = await completed_task

                            if error:
                                logger.error(f"Provider {provider.value} failed for query '{query[:50]}...': {error}")
                                failed_providers.add(provider)
                                provider_failure_counts[provider] += 1

                                # Skip failing providers after multiple consecutive failures
                                if provider_failure_counts[provider] >= 3:
                                    logger.warning(f"Provider {provider.value} has {provider_failure_counts[provider]} failures - continuing with other providers")

                                # Don't block other providers - continue processing
                                continue

                            elif result:
                                results[query].append(result)
                                if self.deduplicator:
                                    self.deduplicator.store_response(query, provider, result)
                                completed_count += 1
                                logger.debug(f"✓ {provider.value} completed query {completed_count}/{len(tasks)}")

                                # Call the callback to save response immediately
                                # Don't let callback failures stop processing
                                if response_callback:
                                    try:
                                        await response_callback(query, provider, result)
                                    except Exception as cb_error:
                                        logger.error(f"Callback failed for {provider.value} (non-fatal): {cb_error}")
                                        # Continue processing - callback failure shouldn't stop the audit

                        except Exception as e:
                            logger.error(f"Task processing error (non-fatal): {e}")
                            # Continue processing other tasks
                                
                    logger.info(f"Batch completed: {completed_count} successful, {len(failed_providers)} providers with failures")
        else:
            # Sequential execution
            for query in queries:
                for provider in available_providers:
                    response = await self._execute_with_resilience(
                        query, provider, use_cache, use_fallback
                    )
                    results[query].append(response)
        
        return dict(results)
    
    @backoff.on_exception(
        backoff.expo,
        (aiohttp.ClientError, asyncio.TimeoutError),
        max_tries=3,
        max_time=30
    )
    async def _execute_with_resilience(
        self,
        query: str,
        provider: LLMProvider,
        use_cache: bool,
        use_fallback: bool
    ) -> LLMResponse:
        """Execute query with improved error handling"""
        
        # Check cache
        cache_key = f"{provider.value}:{hashlib.md5(query.encode()).hexdigest()}"
        if use_cache and cache_key in self.response_cache:
            cached_time, cached_response = self.response_cache[cache_key]
            if time.time() - cached_time < self.cache_ttl:
                cached_response.cache_hit = True
                return cached_response
        
        # Check circuit breaker
        if hasattr(self, 'circuit_breakers'):
            if not self.circuit_breakers[provider].is_available():
                if use_fallback:
                    fallback = self.circuit_breakers[provider].config.fallback_provider
                    if fallback:
                        logger.info(f"Using fallback {fallback} for {provider}")
                        return await self._execute_with_resilience(
                            query, fallback, use_cache, False
                        )
                raise Exception(f"Circuit breaker open for {provider}")
        
        # Rate limiting
        async with self.semaphores[provider]:
            try:
                response = await self._execute_provider_query(query, provider)
                
                # Record success
                self.health_monitor.record_success(provider, response.response_time_ms)
                if hasattr(self, 'circuit_breakers'):
                    self.circuit_breakers[provider].record_success()
                
                # Cache response
                if use_cache:
                    self.response_cache[cache_key] = (time.time(), response)
                
                return response
                
            except Exception as e:
                # Record failure
                self.health_monitor.record_failure(provider, str(type(e).__name__))
                if hasattr(self, 'circuit_breakers'):
                    self.circuit_breakers[provider].record_failure()
                
                logger.error(f"Error with {provider}: {e}")
                
                if use_fallback and hasattr(self, 'circuit_breakers'):
                    fallback = self.circuit_breakers[provider].config.fallback_provider
                    if fallback:
                        return await self._execute_with_resilience(
                            query, fallback, use_cache, False
                        )
                
                raise
    
    async def _execute_provider_query(self, query: str, provider: LLMProvider) -> LLMResponse:
        """Execute query on specific provider with correct models"""
        
        start_time = time.time()
        request_id = hashlib.md5(f"{query}{provider.value}{start_time}".encode()).hexdigest()[:12]
        
        try:
            if provider == LLMProvider.OPENAI_GPT5:
                # Use GPT-5 model from settings
                model = settings.openai_model  # Should be gpt-5-nano
                
                # GPT-5 Nano only supports temperature=1 (default), so we omit it
                response = await self.clients[provider].chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": query}],
                    max_completion_tokens=1500,
                    timeout=self.request_timeout
                )
                
                return LLMResponse(
                    provider=provider,
                    query=query,
                    response_text=response.choices[0].message.content,
                    response_time_ms=(time.time() - start_time) * 1000,
                    tokens_used=response.usage.total_tokens if response.usage else None,
                    model_version=model,
                    request_id=request_id
                )
            
            elif provider == LLMProvider.ANTHROPIC_CLAUDE:
                response = await self.clients[provider].messages.create(
                    model="claude-3-haiku-20240307",
                    messages=[{"role": "user", "content": query}],
                    max_tokens=1500,
                    temperature=0.7
                )

                return LLMResponse(
                    provider=provider,
                    query=query,
                    response_text=response.content[0].text,
                    response_time_ms=(time.time() - start_time) * 1000,
                    tokens_used=None,
                    model_version="claude-3-haiku-20240307",
                    request_id=request_id
                )
            
            elif provider == LLMProvider.GOOGLE_GEMINI:
                response = await asyncio.to_thread(
                    self.gemini_model.generate_content,
                    query
                )
                
                return LLMResponse(
                    provider=provider,
                    query=query,
                    response_text=response.text,
                    response_time_ms=(time.time() - start_time) * 1000,
                    tokens_used=None,
                    model_version="gemini-2.5-flash",
                    request_id=request_id
                )
            
            elif provider == LLMProvider.PERPLEXITY:
                async with self.get_session() as session:
                    headers = {
                        "Authorization": f"Bearer {self.perplexity_key}",
                        "Content-Type": "application/json"
                    }
                    
                    payload = {
                        "model": "sonar",
                        "messages": [{"role": "user", "content": query}],
                        "temperature": 0.7,
                        "max_tokens": 1500
                    }
                    
                    async with session.post(
                        "https://api.perplexity.ai/chat/completions",
                        headers=headers,
                        json=payload
                    ) as response:
                        data = await response.json()
                        
                        return LLMResponse(
                            provider=provider,
                            query=query,
                            response_text=data["choices"][0]["message"]["content"],
                            response_time_ms=(time.time() - start_time) * 1000,
                            tokens_used=data.get("usage", {}).get("total_tokens"),
                            model_version="sonar",
                            request_id=request_id
                        )
            
            else:
                raise ValueError(f"Unsupported provider: {provider}")
                
        except Exception as e:
            logger.error(f"Provider {provider} execution failed: {e}")
            return LLMResponse(
                provider=provider,
                query=query,
                response_text="",
                response_time_ms=(time.time() - start_time) * 1000,
                tokens_used=0,
                model_version="",
                error=str(e),
                request_id=request_id
            )
    
    async def get_provider_health(self) -> Dict[str, Any]:
        """Get health status of all providers"""
        return {
            provider.value: {
                "health_score": metrics["health_score"],
                "success_rate": metrics["success_rate"],
                "avg_latency_ms": metrics["avg_latency_ms"],
                "circuit_state": self.circuit_breakers[provider].state if hasattr(self, 'circuit_breakers') else "N/A"
            }
            for provider, metrics in self.health_monitor.metrics.items()
        }
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()
        
        if self.deduplicator and self.deduplicator._cleanup_task:
            self.deduplicator._cleanup_task.cancel()
    
    async def __aenter__(self):
        """Context manager entry"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        await self.cleanup()


# Backward compatibility alias
MultiLLMOrchestrator = LLMOrchestrator
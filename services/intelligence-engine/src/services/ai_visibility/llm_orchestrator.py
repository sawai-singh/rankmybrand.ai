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
from collections import defaultdict
import hashlib

from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
import google.generativeai as genai
from google.generativeai import GenerativeModel
import backoff
# Circuit breaker implementation inline (no external dependency needed)

logger = logging.getLogger(__name__)


class LLMProvider(Enum):
    """Supported LLM providers"""
    OPENAI_GPT4 = "openai_gpt4"
    OPENAI_GPT5 = "openai_gpt5"
    ANTHROPIC_CLAUDE = "anthropic_claude"
    GOOGLE_GEMINI = "google_gemini"
    GOOGLE_AI_OVERVIEW = "google_ai_overview"  # Google Search AI Mode
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
    response_id: str = field(default_factory=lambda: hashlib.md5(
        str(datetime.now()).encode()).hexdigest()[:12])
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker configuration per provider"""
    failure_threshold: int = 5
    recovery_timeout: int = 60  # seconds
    expected_exception: type = Exception
    fallback_provider: Optional[LLMProvider] = None


@dataclass
class RateLimitConfig:
    """Rate limiting configuration"""
    requests_per_minute: int
    requests_per_hour: int
    concurrent_requests: int
    burst_size: int = 10


class CostTracker:
    """Track costs for each LLM provider"""
    
    # Cost per 1K tokens (approximate as of 2024)
    COST_PER_1K_TOKENS = {
        LLMProvider.OPENAI_GPT4: {'input': 0.03, 'output': 0.06},
        LLMProvider.OPENAI_GPT5: {'input': 0.05, 'output': 0.10},  # Estimated
        LLMProvider.ANTHROPIC_CLAUDE: {'input': 0.008, 'output': 0.024},
        LLMProvider.GOOGLE_GEMINI: {'input': 0.0005, 'output': 0.0015},
        LLMProvider.PERPLEXITY: {'input': 0.001, 'output': 0.001},
        LLMProvider.GOOGLE_AI_OVERVIEW: {'input': 0.0, 'output': 0.0},  # Free via search
    }
    
    def __init__(self, daily_limit: float = 100.0):
        self.daily_limit = daily_limit
        self.daily_costs = defaultdict(float)
        self.total_costs = defaultdict(float)
        self.last_reset = datetime.now().date()
    
    def calculate_cost(self, provider: LLMProvider, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost for a request"""
        if provider not in self.COST_PER_1K_TOKENS:
            return 0.0
        
        rates = self.COST_PER_1K_TOKENS[provider]
        cost = (input_tokens / 1000 * rates['input']) + (output_tokens / 1000 * rates['output'])
        return cost
    
    def add_cost(self, provider: LLMProvider, cost: float) -> bool:
        """Add cost and check if within limits"""
        # Reset daily costs if new day
        current_date = datetime.now().date()
        if current_date != self.last_reset:
            self.daily_costs.clear()
            self.last_reset = current_date
        
        # Check if adding this cost would exceed daily limit
        total_daily = sum(self.daily_costs.values()) + cost
        if total_daily > self.daily_limit:
            logger.warning(f"Daily cost limit would be exceeded: ${total_daily:.2f} > ${self.daily_limit}")
            return False
        
        self.daily_costs[provider] += cost
        self.total_costs[provider] += cost
        return True
    
    def get_remaining_budget(self) -> float:
        """Get remaining budget for today"""
        return self.daily_limit - sum(self.daily_costs.values())


class ProviderHealthMonitor:
    """Monitor health and performance of each provider"""
    
    def __init__(self):
        self.metrics = defaultdict(lambda: {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'total_latency_ms': 0,
            'error_types': defaultdict(int),
            'last_success': None,
            'last_failure': None,
            'circuit_state': 'closed',
            'consecutive_failures': 0,
            'total_cost': 0.0
        })
        self.circuit_breaker_thresholds = {
            provider: 5 for provider in LLMProvider
        }
        self.circuit_recovery_time = timedelta(minutes=5)
    
    def record_success(self, provider: LLMProvider, latency_ms: float, cost: float = 0.0):
        """Record successful request"""
        metrics = self.metrics[provider]
        metrics['total_requests'] += 1
        metrics['successful_requests'] += 1
        metrics['total_latency_ms'] += latency_ms
        metrics['last_success'] = datetime.now()
        metrics['circuit_state'] = 'closed'
        metrics['consecutive_failures'] = 0
        metrics['total_cost'] += cost
    
    def record_failure(self, provider: LLMProvider, error_type: str):
        """Record failed request"""
        metrics = self.metrics[provider]
        metrics['total_requests'] += 1
        metrics['failed_requests'] += 1
        metrics['error_types'][error_type] += 1
        metrics['last_failure'] = datetime.now()
    
    def get_health_score(self, provider: LLMProvider) -> float:
        """Calculate health score (0-1) for provider"""
        metrics = self.metrics[provider]
        
        if metrics['total_requests'] == 0:
            return 1.0
        
        success_rate = metrics['successful_requests'] / metrics['total_requests']
        
        # Factor in recent failures
        if metrics['last_failure']:
            time_since_failure = (datetime.now() - metrics['last_failure']).seconds
            recency_factor = min(1.0, time_since_failure / 300)  # 5 minute recovery
        else:
            recency_factor = 1.0
        
        return success_rate * recency_factor
    
    def get_average_latency(self, provider: LLMProvider) -> float:
        """Get average latency for provider"""
        metrics = self.metrics[provider]
        
        if metrics['successful_requests'] == 0:
            return 0
        
        return metrics['total_latency_ms'] / metrics['successful_requests']


@dataclass
class OrchestratorConfig:
    """Configuration for the Multi-LLM Orchestrator"""
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    perplexity_api_key: Optional[str] = None
    max_parallel_requests: int = 5
    request_timeout: int = 30
    circuit_breaker_threshold: int = 5
    circuit_breaker_timeout: int = 300
    daily_cost_limit: float = 100.0


class MultiLLMOrchestrator:
    """Enterprise-grade LLM orchestration with resilience patterns"""
    
    def __init__(
        self,
        config: OrchestratorConfig,
        cache_client: Optional[Any] = None
    ):
        # Store config
        self.config = config
        
        # Initialize clients
        self.clients = {}
        if config.openai_api_key:
            self.clients[LLMProvider.OPENAI_GPT4] = AsyncOpenAI(api_key=config.openai_api_key)
            self.clients[LLMProvider.OPENAI_GPT5] = AsyncOpenAI(api_key=config.openai_api_key)
        
        if config.anthropic_api_key:
            self.clients[LLMProvider.ANTHROPIC_CLAUDE] = AsyncAnthropic(api_key=config.anthropic_api_key)
        
        self.clients[LLMProvider.PERPLEXITY] = None  # Will use HTTP client
        
        # Configure Google Gemini
        if config.google_api_key:
            genai.configure(api_key=config.google_api_key)
            self.gemini_model = GenerativeModel('gemini-pro')
        else:
            self.gemini_model = None
        
        # Perplexity configuration
        self.perplexity_key = config.perplexity_api_key
        
        # Circuit breakers per provider
        self.circuit_breakers = self._initialize_circuit_breakers()
        
        # Rate limiters
        self.rate_limiters = self._initialize_rate_limiters()
        
        # Health monitoring
        self.health_monitor = ProviderHealthMonitor()
        
        # Cache client (Redis)
        self.cache = cache_client
        
        # Semaphores for concurrency control
        self.semaphores = {
            LLMProvider.OPENAI_GPT4: Semaphore(10),
            LLMProvider.OPENAI_GPT5: Semaphore(10),
            LLMProvider.ANTHROPIC_CLAUDE: Semaphore(8),
            LLMProvider.GOOGLE_GEMINI: Semaphore(6),
            LLMProvider.PERPLEXITY: Semaphore(5)
        }
    
    def _initialize_circuit_breakers(self) -> Dict[LLMProvider, CircuitBreakerConfig]:
        """Initialize circuit breaker configurations"""
        return {
            LLMProvider.OPENAI_GPT4: CircuitBreakerConfig(
                failure_threshold=5,
                recovery_timeout=60,
                fallback_provider=LLMProvider.ANTHROPIC_CLAUDE
            ),
            LLMProvider.OPENAI_GPT5: CircuitBreakerConfig(
                failure_threshold=3,
                recovery_timeout=120,
                fallback_provider=LLMProvider.OPENAI_GPT4
            ),
            LLMProvider.ANTHROPIC_CLAUDE: CircuitBreakerConfig(
                failure_threshold=5,
                recovery_timeout=60,
                fallback_provider=LLMProvider.OPENAI_GPT4
            ),
            LLMProvider.GOOGLE_GEMINI: CircuitBreakerConfig(
                failure_threshold=7,
                recovery_timeout=45,
                fallback_provider=LLMProvider.OPENAI_GPT4
            ),
            LLMProvider.PERPLEXITY: CircuitBreakerConfig(
                failure_threshold=10,
                recovery_timeout=30,
                fallback_provider=LLMProvider.GOOGLE_GEMINI
            )
        }
    
    def _initialize_rate_limiters(self) -> Dict[LLMProvider, RateLimitConfig]:
        """Initialize rate limiting configurations"""
        return {
            LLMProvider.OPENAI_GPT4: RateLimitConfig(
                requests_per_minute=60,
                requests_per_hour=3000,
                concurrent_requests=10
            ),
            LLMProvider.OPENAI_GPT5: RateLimitConfig(
                requests_per_minute=30,
                requests_per_hour=1500,
                concurrent_requests=5
            ),
            LLMProvider.ANTHROPIC_CLAUDE: RateLimitConfig(
                requests_per_minute=50,
                requests_per_hour=2500,
                concurrent_requests=8
            ),
            LLMProvider.GOOGLE_GEMINI: RateLimitConfig(
                requests_per_minute=40,
                requests_per_hour=2000,
                concurrent_requests=6
            ),
            LLMProvider.PERPLEXITY: RateLimitConfig(
                requests_per_minute=20,
                requests_per_hour=1000,
                concurrent_requests=4
            )
        }
    
    async def execute_audit_queries(
        self,
        queries: List[str],
        providers: Optional[List[LLMProvider]] = None,
        parallel_execution: bool = True,
        use_cache: bool = True,
        fallback_on_failure: bool = True
    ) -> Dict[str, List[LLMResponse]]:
        """Execute queries across multiple LLMs with resilience"""
        
        if providers is None:
            providers = [
                LLMProvider.OPENAI_GPT4,
                LLMProvider.ANTHROPIC_CLAUDE,
                LLMProvider.GOOGLE_GEMINI,
                LLMProvider.PERPLEXITY
            ]
        
        results = defaultdict(list)
        
        if parallel_execution:
            # Execute all queries across all providers in parallel
            tasks = []
            for query in queries:
                for provider in providers:
                    task = self._execute_with_resilience(
                        query, provider, use_cache, fallback_on_failure
                    )
                    tasks.append((query, provider, task))
            
            # Gather results
            task_results = await asyncio.gather(
                *[task for _, _, task in tasks],
                return_exceptions=True
            )
            
            # Process results
            for (query, provider, _), result in zip(tasks, task_results):
                if isinstance(result, Exception):
                    logger.error(f"Failed to execute query on {provider}: {result}")
                    if fallback_on_failure:
                        # Try fallback provider
                        fallback = self.circuit_breakers[provider].fallback_provider
                        if fallback:
                            fallback_result = await self._execute_with_resilience(
                                query, fallback, use_cache, False
                            )
                            results[query].append(fallback_result)
                else:
                    results[query].append(result)
        else:
            # Sequential execution
            for query in queries:
                for provider in providers:
                    response = await self._execute_with_resilience(
                        query, provider, use_cache, fallback_on_failure
                    )
                    results[query].append(response)
        
        return dict(results)
    
    @backoff.on_exception(
        backoff.expo,
        (aiohttp.ClientError, Exception),
        max_tries=3,
        max_time=30
    )
    async def _execute_with_resilience(
        self,
        query: str,
        provider: LLMProvider,
        use_cache: bool,
        fallback_on_failure: bool
    ) -> LLMResponse:
        """Execute query with circuit breaker, retry, and caching"""
        
        start_time = time.time()
        
        # Check cache first
        if use_cache and self.cache:
            cached_response = await self._get_cached_response(query, provider)
            if cached_response:
                cached_response.cache_hit = True
                return cached_response
        
        # Check circuit breaker state
        if not self._is_circuit_closed(provider):
            if fallback_on_failure:
                fallback = self.circuit_breakers[provider].fallback_provider
                if fallback:
                    logger.warning(f"Circuit open for {provider}, using fallback {fallback}")
                    return await self._execute_with_resilience(
                        query, fallback, use_cache, False
                    )
            raise Exception(f"Circuit breaker open for {provider}")
        
        # Acquire semaphore for rate limiting
        async with self.semaphores[provider]:
            try:
                # Execute query based on provider
                response = await self._execute_provider_query(query, provider)
                
                # Record success
                latency_ms = (time.time() - start_time) * 1000
                self.health_monitor.record_success(provider, latency_ms)
                
                # Cache response
                if use_cache and self.cache:
                    await self._cache_response(query, provider, response)
                
                return response
                
            except Exception as e:
                # Record failure
                self.health_monitor.record_failure(provider, str(type(e).__name__))
                
                # Update circuit breaker
                self._record_circuit_failure(provider)
                
                logger.error(f"Error executing query on {provider}: {e}")
                
                if fallback_on_failure:
                    fallback = self.circuit_breakers[provider].fallback_provider
                    if fallback:
                        logger.info(f"Attempting fallback to {fallback}")
                        return await self._execute_with_resilience(
                            query, fallback, use_cache, False
                        )
                
                raise
    
    async def _execute_provider_query(self, query: str, provider: LLMProvider) -> LLMResponse:
        """Execute query on specific provider"""
        
        start_time = time.time()
        
        try:
            if provider in [LLMProvider.OPENAI_GPT4, LLMProvider.OPENAI_GPT5]:
                model = "gpt-4o" if provider == LLMProvider.OPENAI_GPT4 else "gpt-4o"
                
                response = await self.clients[provider].chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": query}],
                    temperature=0.7,
                    max_tokens=1500
                )
                
                return LLMResponse(
                    provider=provider,
                    query=query,
                    response_text=response.choices[0].message.content,
                    response_time_ms=(time.time() - start_time) * 1000,
                    tokens_used=response.usage.total_tokens if response.usage else None,
                    model_version=model
                )
            
            elif provider == LLMProvider.ANTHROPIC_CLAUDE:
                response = await self.clients[provider].messages.create(
                    model="claude-3-5-sonnet-20241022",
                    messages=[{"role": "user", "content": query}],
                    max_tokens=1500,
                    temperature=0.7
                )
                
                return LLMResponse(
                    provider=provider,
                    query=query,
                    response_text=response.content[0].text,
                    response_time_ms=(time.time() - start_time) * 1000,
                    tokens_used=None,  # Claude doesn't return token usage in same format
                    model_version="claude-3.5-sonnet"
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
                    model_version="gemini-pro"
                )
            
            elif provider == LLMProvider.PERPLEXITY:
                async with aiohttp.ClientSession() as session:
                    headers = {
                        "Authorization": f"Bearer {self.perplexity_key}",
                        "Content-Type": "application/json"
                    }
                    
                    payload = {
                        "model": "pplx-70b-online",
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
                            model_version="pplx-70b-online"
                        )
            
            elif provider == LLMProvider.GOOGLE_AI_OVERVIEW:
                # Google AI Overview (Search AI Mode) - using custom endpoint
                # This would need Google Search API with AI features enabled
                return await self._execute_google_ai_overview(query, start_time)
            
            else:
                raise ValueError(f"Unsupported provider: {provider}")
                
        except Exception as e:
            logger.error(f"Provider {provider} execution failed: {e}")
            return LLMResponse(
                provider=provider,
                query=query,
                response_text="",
                response_time_ms=(time.time() - start_time) * 1000,
                tokens_used=None,
                model_version="",
                error=str(e)
            )
    
    async def _execute_google_ai_overview(self, query: str, start_time: float) -> LLMResponse:
        """Execute Google AI Overview (Search AI Mode)"""
        
        # This would integrate with Google's AI-powered search
        # For now, using Gemini as fallback
        
        # In production, this would call Google Search API with AI features
        # or scrape Google search results with AI overview
        
        response = await asyncio.to_thread(
            self.gemini_model.generate_content,
            f"Provide a comprehensive overview for the search query: {query}"
        )
        
        return LLMResponse(
            provider=LLMProvider.GOOGLE_AI_OVERVIEW,
            query=query,
            response_text=response.text,
            response_time_ms=(time.time() - start_time) * 1000,
            tokens_used=None,
            model_version="google-ai-overview",
            metadata={"fallback_used": True}
        )
    
    async def _get_cached_response(
        self,
        query: str,
        provider: LLMProvider
    ) -> Optional[LLMResponse]:
        """Get cached response if available"""
        
        if not self.cache:
            return None
        
        cache_key = f"llm_response:{provider.value}:{hashlib.md5(query.encode()).hexdigest()}"
        
        try:
            cached_data = await self.cache.get(cache_key)
            if cached_data:
                return LLMResponse(**json.loads(cached_data))
        except Exception as e:
            logger.warning(f"Cache retrieval failed: {e}")
        
        return None
    
    async def _cache_response(
        self,
        query: str,
        provider: LLMProvider,
        response: LLMResponse
    ):
        """Cache response with TTL"""
        
        if not self.cache:
            return
        
        cache_key = f"llm_response:{provider.value}:{hashlib.md5(query.encode()).hexdigest()}"
        ttl = 3600  # 1 hour cache
        
        try:
            # Convert response to dict, handling datetime
            response_dict = {
                "provider": response.provider.value,
                "query": response.query,
                "response_text": response.response_text,
                "response_time_ms": response.response_time_ms,
                "tokens_used": response.tokens_used,
                "model_version": response.model_version,
                "timestamp": response.timestamp.isoformat(),
                "error": response.error,
                "retry_count": response.retry_count,
                "cache_hit": response.cache_hit,
                "response_id": response.response_id,
                "metadata": response.metadata
            }
            
            await self.cache.set(
                cache_key,
                json.dumps(response_dict),
                ex=ttl
            )
        except Exception as e:
            logger.warning(f"Cache storage failed: {e}")
    
    def _is_circuit_closed(self, provider: LLMProvider) -> bool:
        """Check if circuit breaker is closed (operational)"""
        
        # Simple implementation - in production use py-breaker or similar
        metrics = self.health_monitor.metrics[provider]
        
        if metrics['circuit_state'] == 'open':
            # Check if recovery timeout has passed
            if metrics['last_failure']:
                recovery_timeout = self.circuit_breakers[provider].recovery_timeout
                time_since_failure = (datetime.now() - metrics['last_failure']).seconds
                
                if time_since_failure > recovery_timeout:
                    metrics['circuit_state'] = 'half-open'
                    return True  # Allow one test request
                else:
                    return False
        
        return True
    
    def _record_circuit_failure(self, provider: LLMProvider):
        """Record failure for circuit breaker"""
        
        metrics = self.health_monitor.metrics[provider]
        threshold = self.circuit_breakers[provider].failure_threshold
        
        # Check recent failures
        if metrics['failed_requests'] >= threshold:
            metrics['circuit_state'] = 'open'
            logger.warning(f"Circuit breaker opened for {provider}")
    
    async def get_provider_status(self) -> Dict[str, Any]:
        """Get current status of all providers"""
        
        status = {}
        
        for provider in LLMProvider:
            metrics = self.health_monitor.metrics[provider]
            
            status[provider.value] = {
                'health_score': self.health_monitor.get_health_score(provider),
                'average_latency_ms': self.health_monitor.get_average_latency(provider),
                'total_requests': metrics['total_requests'],
                'success_rate': (
                    metrics['successful_requests'] / metrics['total_requests']
                    if metrics['total_requests'] > 0 else 1.0
                ),
                'circuit_state': metrics['circuit_state'],
                'last_success': metrics['last_success'].isoformat() if metrics['last_success'] else None,
                'last_failure': metrics['last_failure'].isoformat() if metrics['last_failure'] else None,
                'error_distribution': dict(metrics['error_types'])
            }
        
        return status
    
    async def warmup(self):
        """Warmup connections to all providers"""
        
        test_query = "Hello, please respond with 'OK' if you're operational."
        
        tasks = []
        for provider in LLMProvider:
            if provider != LLMProvider.GOOGLE_AI_OVERVIEW:  # Skip special providers
                task = self._execute_provider_query(test_query, provider)
                tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for provider, result in zip(LLMProvider, results):
            if isinstance(result, Exception):
                logger.warning(f"Warmup failed for {provider}: {result}")
            else:
                logger.info(f"Warmup successful for {provider}")
        
        return results
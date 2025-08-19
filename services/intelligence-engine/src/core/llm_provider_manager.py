"""
Robust LLM Provider Manager with Fallback and Resilience
Handles multiple LLM APIs with graceful degradation
"""

import os
import time
import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, as_completed
import openai
import anthropic
import google.generativeai as genai
from datetime import datetime, timedelta
import json
import hashlib
from functools import lru_cache
import redis

logger = logging.getLogger(__name__)


class LLMProvider(Enum):
    """Available LLM providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    PERPLEXITY = "perplexity"
    COHERE = "cohere"
    HUGGINGFACE = "huggingface"


@dataclass
class ProviderConfig:
    """Configuration for each provider"""
    name: LLMProvider
    api_key: Optional[str]
    base_url: Optional[str] = None
    model: str = ""
    max_tokens: int = 2000
    temperature: float = 0.7
    priority: int = 1  # Higher priority = preferred provider
    weight: float = 1.0  # Weight for aggregated scoring
    timeout: int = 30  # Timeout in seconds
    retry_count: int = 3
    retry_delay: float = 1.0  # Initial retry delay


@dataclass
class ProviderHealth:
    """Health status of a provider"""
    provider: LLMProvider
    is_healthy: bool
    last_check: datetime
    success_rate: float
    avg_response_time: float
    error_count: int
    last_error: Optional[str] = None


@dataclass
class LLMResponse:
    """Standardized LLM response"""
    provider: LLMProvider
    content: str
    confidence: float  # 0-1 confidence score
    response_time: float
    tokens_used: int
    cached: bool = False
    partial: bool = False  # True if response is partial due to failures


class LLMProviderManager:
    """
    Manages multiple LLM providers with fallback, caching, and resilience
    """
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.providers: Dict[LLMProvider, ProviderConfig] = {}
        self.health_status: Dict[LLMProvider, ProviderHealth] = {}
        self.redis_client = redis_client
        self.executor = ThreadPoolExecutor(max_workers=10)
        self._initialize_providers()
        self._initialize_health_checks()
        
    def _initialize_providers(self):
        """Initialize all available providers based on environment variables"""
        
        # OpenAI
        if os.getenv("OPENAI_API_KEY"):
            self.providers[LLMProvider.OPENAI] = ProviderConfig(
                name=LLMProvider.OPENAI,
                api_key=os.getenv("OPENAI_API_KEY"),
                model="gpt-4o",  # Using GPT-4o
                priority=1,
                weight=1.2  # Higher weight for GPT-4
            )
            
        # Anthropic Claude
        if os.getenv("ANTHROPIC_API_KEY"):
            self.providers[LLMProvider.ANTHROPIC] = ProviderConfig(
                name=LLMProvider.ANTHROPIC,
                api_key=os.getenv("ANTHROPIC_API_KEY"),
                model="claude-3-opus-20240229",
                priority=2,
                weight=1.2
            )
            
        # Google Gemini
        if os.getenv("GOOGLE_AI_API_KEY") or os.getenv("GEMINI_API_KEY"):
            self.providers[LLMProvider.GEMINI] = ProviderConfig(
                name=LLMProvider.GEMINI,
                api_key=os.getenv("GOOGLE_AI_API_KEY") or os.getenv("GEMINI_API_KEY"),
                model="gemini-2.5-flash",  # Gemini 2.5 Flash
                priority=3,
                weight=1.0
            )
            
        # Perplexity
        if os.getenv("PERPLEXITY_API_KEY"):
            self.providers[LLMProvider.PERPLEXITY] = ProviderConfig(
                name=LLMProvider.PERPLEXITY,
                api_key=os.getenv("PERPLEXITY_API_KEY"),
                base_url="https://api.perplexity.ai",
                model="sonar",  # Using sonar as default model
                priority=4,
                weight=1.1  # Good for real-time data
            )
            
        logger.info(f"Initialized {len(self.providers)} LLM providers")
        
    def _initialize_health_checks(self):
        """Initialize health status for all providers"""
        for provider in self.providers:
            self.health_status[provider] = ProviderHealth(
                provider=provider,
                is_healthy=True,  # Assume healthy initially
                last_check=datetime.now(),
                success_rate=1.0,
                avg_response_time=0.0,
                error_count=0
            )
            
    async def check_provider_health(self, provider: LLMProvider) -> bool:
        """Check if a provider is healthy with a simple test query"""
        try:
            config = self.providers.get(provider)
            if not config:
                return False
                
            start_time = time.time()
            
            # Simple health check query
            response = await self._call_provider(
                provider=provider,
                prompt="Say 'OK' if you're working",
                max_tokens=10
            )
            
            response_time = time.time() - start_time
            
            # Update health status
            health = self.health_status[provider]
            health.is_healthy = True
            health.last_check = datetime.now()
            health.avg_response_time = (health.avg_response_time * 0.9 + response_time * 0.1)
            health.success_rate = min(1.0, health.success_rate * 1.05)  # Slowly recover
            
            return True
            
        except Exception as e:
            # Mark as unhealthy
            health = self.health_status[provider]
            health.is_healthy = False
            health.last_check = datetime.now()
            health.error_count += 1
            health.last_error = str(e)
            health.success_rate *= 0.9  # Decay success rate
            
            logger.warning(f"Provider {provider.value} health check failed: {e}")
            return False
            
    async def _call_provider(self, provider: LLMProvider, prompt: str, 
                            max_tokens: Optional[int] = None) -> str:
        """Call a specific provider with the given prompt"""
        config = self.providers[provider]
        
        if provider == LLMProvider.OPENAI:
            return await self._call_openai(config, prompt, max_tokens)
        elif provider == LLMProvider.ANTHROPIC:
            return await self._call_anthropic(config, prompt, max_tokens)
        elif provider == LLMProvider.GEMINI:
            return await self._call_gemini(config, prompt, max_tokens)
        elif provider == LLMProvider.PERPLEXITY:
            return await self._call_perplexity(config, prompt, max_tokens)
        else:
            raise ValueError(f"Provider {provider} not implemented")
            
    async def _call_openai(self, config: ProviderConfig, prompt: str, 
                           max_tokens: Optional[int] = None) -> str:
        """Call OpenAI API"""
        client = openai.OpenAI(api_key=config.api_key)
        
        response = client.chat.completions.create(
            model=config.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens or config.max_tokens,
            temperature=config.temperature
        )
        
        return response.choices[0].message.content
        
    async def _call_anthropic(self, config: ProviderConfig, prompt: str,
                              max_tokens: Optional[int] = None) -> str:
        """Call Anthropic Claude API"""
        client = anthropic.Anthropic(api_key=config.api_key)
        
        response = client.messages.create(
            model=config.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens or config.max_tokens,
            temperature=config.temperature
        )
        
        return response.content[0].text
        
    async def _call_gemini(self, config: ProviderConfig, prompt: str,
                           max_tokens: Optional[int] = None) -> str:
        """Call Google Gemini API"""
        genai.configure(api_key=config.api_key)
        model = genai.GenerativeModel(config.model)
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=max_tokens or config.max_tokens,
                temperature=config.temperature
            )
        )
        
        return response.text
        
    async def _call_perplexity(self, config: ProviderConfig, prompt: str,
                               max_tokens: Optional[int] = None) -> str:
        """Call Perplexity API (OpenAI-compatible)"""
        client = openai.OpenAI(
            api_key=config.api_key,
            base_url=config.base_url
        )
        
        response = client.chat.completions.create(
            model=config.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens or config.max_tokens,
            temperature=config.temperature
        )
        
        return response.choices[0].message.content
        
    def _get_cache_key(self, prompt: str, providers: List[LLMProvider]) -> str:
        """Generate cache key for a prompt and provider combination"""
        provider_str = ",".join(sorted([p.value for p in providers]))
        content = f"{prompt}:{provider_str}"
        return f"llm_cache:{hashlib.md5(content.encode()).hexdigest()}"
        
    def _get_from_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached response if available"""
        if not self.redis_client:
            return None
            
        try:
            cached = self.redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Cache retrieval failed: {e}")
            
        return None
        
    def _save_to_cache(self, cache_key: str, data: Dict[str, Any], ttl: int = 3600):
        """Save response to cache"""
        if not self.redis_client:
            return
            
        try:
            self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(data)
            )
        except Exception as e:
            logger.warning(f"Cache save failed: {e}")
            
    async def query_with_fallback(self, prompt: str, 
                                  required_confidence: float = 0.5,
                                  use_cache: bool = True) -> LLMResponse:
        """
        Query LLM providers with automatic fallback
        Returns best available response even if some providers fail
        """
        
        # Check cache first
        available_providers = self.get_available_providers()
        cache_key = self._get_cache_key(prompt, available_providers)
        
        if use_cache:
            cached = self._get_from_cache(cache_key)
            if cached:
                return LLMResponse(
                    provider=LLMProvider(cached["provider"]),
                    content=cached["content"],
                    confidence=cached["confidence"],
                    response_time=0,
                    tokens_used=cached.get("tokens_used", 0),
                    cached=True
                )
                
        # Try providers in priority order
        responses = []
        tasks = []
        
        for provider in available_providers:
            task = asyncio.create_task(self._try_provider(provider, prompt))
            tasks.append((provider, task))
            
        # Collect responses as they complete
        for provider, task in tasks:
            try:
                response = await asyncio.wait_for(task, timeout=30)
                if response:
                    responses.append(response)
                    
                    # If we get a high-confidence response, we can return early
                    if response.confidence >= required_confidence:
                        # Cache the response
                        if use_cache:
                            self._save_to_cache(cache_key, {
                                "provider": response.provider.value,
                                "content": response.content,
                                "confidence": response.confidence,
                                "tokens_used": response.tokens_used
                            })
                        return response
                        
            except asyncio.TimeoutError:
                logger.warning(f"Provider {provider.value} timed out")
                self._mark_provider_failed(provider)
            except Exception as e:
                logger.error(f"Provider {provider.value} failed: {e}")
                self._mark_provider_failed(provider)
                
        # If we have any responses, return the best one
        if responses:
            best_response = max(responses, key=lambda r: r.confidence)
            
            # Cache the response
            if use_cache:
                self._save_to_cache(cache_key, {
                    "provider": best_response.provider.value,
                    "content": best_response.content,
                    "confidence": best_response.confidence,
                    "tokens_used": best_response.tokens_used
                })
                
            return best_response
            
        # If all providers failed, return a degraded response
        return LLMResponse(
            provider=LLMProvider.OPENAI,  # Default provider
            content="Unable to process request at this time. All AI providers are currently unavailable.",
            confidence=0.0,
            response_time=0,
            tokens_used=0,
            partial=True
        )
        
    async def _try_provider(self, provider: LLMProvider, prompt: str) -> Optional[LLMResponse]:
        """Try to get response from a specific provider"""
        try:
            start_time = time.time()
            
            # Call the provider
            content = await self._call_provider(provider, prompt)
            
            response_time = time.time() - start_time
            
            # Update health metrics
            health = self.health_status[provider]
            health.success_rate = min(1.0, health.success_rate * 1.01)
            health.avg_response_time = (health.avg_response_time * 0.9 + response_time * 0.1)
            
            # Calculate confidence based on provider health and response
            confidence = self._calculate_confidence(provider, content, response_time)
            
            return LLMResponse(
                provider=provider,
                content=content,
                confidence=confidence,
                response_time=response_time,
                tokens_used=len(content.split())  # Rough estimate
            )
            
        except Exception as e:
            logger.error(f"Provider {provider.value} failed: {e}")
            self._mark_provider_failed(provider)
            return None
            
    def _calculate_confidence(self, provider: LLMProvider, content: str, 
                             response_time: float) -> float:
        """Calculate confidence score for a response"""
        config = self.providers[provider]
        health = self.health_status[provider]
        
        # Base confidence from provider weight
        confidence = config.weight
        
        # Adjust based on health metrics
        confidence *= health.success_rate
        
        # Adjust based on response time (faster is better)
        if response_time < 2:
            confidence *= 1.1
        elif response_time > 10:
            confidence *= 0.9
            
        # Adjust based on content length (too short might be bad)
        if len(content) < 50:
            confidence *= 0.8
            
        # Normalize to 0-1 range
        return min(1.0, max(0.0, confidence))
        
    def _mark_provider_failed(self, provider: LLMProvider):
        """Mark a provider as failed"""
        health = self.health_status[provider]
        health.error_count += 1
        health.success_rate *= 0.9
        health.last_error = f"Failed at {datetime.now()}"
        
        # Mark as unhealthy if too many failures
        if health.error_count > 5 or health.success_rate < 0.3:
            health.is_healthy = False
            
    def get_available_providers(self) -> List[LLMProvider]:
        """Get list of currently available providers sorted by priority"""
        available = []
        
        for provider, config in self.providers.items():
            health = self.health_status[provider]
            
            # Include if healthy or hasn't been checked recently
            if health.is_healthy or (datetime.now() - health.last_check).seconds > 300:
                available.append(provider)
                
        # Sort by priority
        available.sort(key=lambda p: self.providers[p].priority)
        
        return available
        
    async def aggregate_responses(self, prompt: str, 
                                 min_providers: int = 2) -> Dict[str, Any]:
        """
        Get responses from multiple providers and aggregate them
        Useful for getting diverse perspectives
        """
        available = self.get_available_providers()[:min_providers + 2]  # Get a few extra
        
        tasks = []
        for provider in available:
            task = asyncio.create_task(self._try_provider(provider, prompt))
            tasks.append(task)
            
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out failures
        valid_responses = [r for r in responses if isinstance(r, LLMResponse) and r]
        
        if not valid_responses:
            return {
                "status": "failed",
                "message": "No providers available",
                "responses": []
            }
            
        # Aggregate the responses
        aggregated = {
            "status": "success",
            "provider_count": len(valid_responses),
            "responses": [],
            "consensus_confidence": 0.0,
            "primary_response": None
        }
        
        total_confidence = 0.0
        for response in valid_responses:
            aggregated["responses"].append({
                "provider": response.provider.value,
                "content": response.content,
                "confidence": response.confidence
            })
            total_confidence += response.confidence
            
        # Set primary response as highest confidence
        best_response = max(valid_responses, key=lambda r: r.confidence)
        aggregated["primary_response"] = best_response.content
        aggregated["consensus_confidence"] = total_confidence / len(valid_responses)
        
        return aggregated
        
    def get_system_status(self) -> Dict[str, Any]:
        """Get current system status for all providers"""
        status = {
            "total_providers": len(self.providers),
            "healthy_providers": 0,
            "providers": {}
        }
        
        for provider, config in self.providers.items():
            health = self.health_status[provider]
            
            status["providers"][provider.value] = {
                "healthy": health.is_healthy,
                "success_rate": round(health.success_rate, 2),
                "avg_response_time": round(health.avg_response_time, 2),
                "error_count": health.error_count,
                "last_check": health.last_check.isoformat(),
                "priority": config.priority,
                "weight": config.weight
            }
            
            if health.is_healthy:
                status["healthy_providers"] += 1
                
        status["system_health"] = status["healthy_providers"] / status["total_providers"]
        
        return status


# Singleton instance
llm_manager = None

def get_llm_manager(redis_client: Optional[redis.Redis] = None) -> LLMProviderManager:
    """Get or create the LLM provider manager singleton"""
    global llm_manager
    if llm_manager is None:
        llm_manager = LLMProviderManager(redis_client)
    return llm_manager
"""
Scalable AI visibility provider system with multiple backends.
Supports easy addition of new AI platforms and scoring methods.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import asyncio
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class VisibilityProvider(str, Enum):
    """Supported AI visibility providers."""
    PERPLEXITY = "perplexity"
    GOOGLE_AI = "google_ai"
    CHATGPT = "chatgpt"
    CLAUDE = "claude"
    BING_CHAT = "bing_chat"
    YOU_COM = "you_com"
    MOCK = "mock"  # For testing


@dataclass
class VisibilityResult:
    """Standardized result from visibility check."""
    provider: str
    query: str
    found: bool
    position: Optional[int] = None
    confidence: float = 1.0
    mentions: List[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    checked_at: datetime = None
    error: Optional[str] = None
    
    def __post_init__(self):
        if self.checked_at is None:
            self.checked_at = datetime.utcnow()
        if self.mentions is None:
            self.mentions = []


class AIVisibilityProvider(ABC):
    """Abstract base class for AI visibility providers."""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.name = self.__class__.__name__
        self.rate_limit = self.config.get('rate_limit', 10)  # requests per minute
        self._last_request_time = 0
    
    @abstractmethod
    async def check_visibility(
        self, 
        query: str, 
        brand_terms: List[str],
        **kwargs
    ) -> VisibilityResult:
        """Check if brand appears in AI results for given query."""
        pass
    
    async def _rate_limit_check(self):
        """Implement rate limiting."""
        current_time = asyncio.get_event_loop().time()
        time_since_last = current_time - self._last_request_time
        min_interval = 60.0 / self.rate_limit
        
        if time_since_last < min_interval:
            await asyncio.sleep(min_interval - time_since_last)
        
        self._last_request_time = asyncio.get_event_loop().time()
    
    def calculate_visibility_score(self, results: List[VisibilityResult]) -> float:
        """Calculate visibility score from results."""
        if not results:
            return 0.0
        
        total_score = 0.0
        for result in results:
            if result.found:
                # Base score for being found
                score = 50.0
                
                # Position bonus (if available)
                if result.position is not None:
                    if result.position == 1:
                        score += 50.0
                    elif result.position <= 3:
                        score += 30.0
                    elif result.position <= 5:
                        score += 20.0
                    else:
                        score += 10.0
                
                # Adjust by confidence
                score *= result.confidence
                
                total_score += score
        
        # Normalize by number of queries
        return min(100.0, total_score / len(results))


class MockAIProvider(AIVisibilityProvider):
    """Mock provider for testing and development."""
    
    async def check_visibility(
        self, 
        query: str, 
        brand_terms: List[str],
        **kwargs
    ) -> VisibilityResult:
        """Simulate visibility check for testing."""
        await self._rate_limit_check()
        
        # Simulate some logic
        import random
        found = random.random() > 0.3  # 70% chance of being found
        
        result = VisibilityResult(
            provider=VisibilityProvider.MOCK.value,
            query=query,
            found=found,
            position=random.randint(1, 10) if found else None,
            confidence=0.9,
            mentions=[
                {
                    'term': term,
                    'context': f"Mock context mentioning {term}..."
                }
                for term in brand_terms if found
            ],
            metadata={'mock': True}
        )
        
        logger.debug(f"Mock check for '{query}': {'found' if found else 'not found'}")
        return result


class APIBasedProvider(AIVisibilityProvider):
    """Base class for API-based providers."""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.api_key = self.config.get('api_key')
        self.base_url = self.config.get('base_url')
        self.timeout = self.config.get('timeout', 30)
    
    async def _make_api_request(
        self, 
        endpoint: str, 
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Make API request with error handling."""
        import aiohttp
        
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/{endpoint}",
                    json=params,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=self.timeout)
                ) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        error_text = await response.text()
                        raise Exception(f"API error {response.status}: {error_text}")
        except Exception as e:
            logger.error(f"API request failed: {e}")
            raise


class PerplexityAPIProvider(APIBasedProvider):
    """Official Perplexity API provider."""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        if not self.base_url:
            self.base_url = "https://api.perplexity.ai"
    
    async def check_visibility(
        self, 
        query: str, 
        brand_terms: List[str],
        **kwargs
    ) -> VisibilityResult:
        """Check visibility using Perplexity API."""
        await self._rate_limit_check()
        
        try:
            # Make API request
            response = await self._make_api_request(
                "chat/completions",
                {
                    "model": "pplx-7b-online",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a search assistant. Answer queries factually."
                        },
                        {
                            "role": "user",
                            "content": query
                        }
                    ]
                }
            )
            
            # Extract answer
            answer = response.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            # Check for brand mentions
            found = False
            mentions = []
            for term in brand_terms:
                if term.lower() in answer.lower():
                    found = True
                    # Find context
                    index = answer.lower().find(term.lower())
                    start = max(0, index - 50)
                    end = min(len(answer), index + len(term) + 50)
                    context = answer[start:end]
                    mentions.append({
                        'term': term,
                        'context': context
                    })
            
            return VisibilityResult(
                provider=VisibilityProvider.PERPLEXITY.value,
                query=query,
                found=found,
                mentions=mentions,
                confidence=0.95,
                metadata={'api_response': response}
            )
            
        except Exception as e:
            logger.error(f"Perplexity API check failed: {e}")
            return VisibilityResult(
                provider=VisibilityProvider.PERPLEXITY.value,
                query=query,
                found=False,
                error=str(e),
                confidence=0.0
            )


class VisibilityOrchestrator:
    """Orchestrates visibility checks across multiple providers."""
    
    def __init__(self, providers: Dict[str, AIVisibilityProvider] = None):
        self.providers = providers or {}
        self._default_providers = [VisibilityProvider.PERPLEXITY, VisibilityProvider.GOOGLE_AI]
    
    def register_provider(self, name: str, provider: AIVisibilityProvider):
        """Register a new provider."""
        self.providers[name] = provider
        logger.info(f"Registered visibility provider: {name}")
    
    async def check_visibility(
        self,
        queries: List[str],
        brand_terms: List[str],
        providers: Optional[List[str]] = None,
        parallel: bool = True
    ) -> Dict[str, Any]:
        """Check visibility across multiple providers and queries."""
        
        # Use specified providers or defaults
        provider_names = providers or [p.value for p in self._default_providers]
        active_providers = {
            name: provider 
            for name, provider in self.providers.items() 
            if name in provider_names
        }
        
        if not active_providers:
            logger.warning("No active providers available, using mock")
            active_providers = {'mock': MockAIProvider()}
        
        results = {
            'summary': {
                'total_queries': len(queries),
                'providers_checked': list(active_providers.keys()),
                'brand_terms': brand_terms,
                'timestamp': datetime.utcnow().isoformat()
            },
            'details': [],
            'provider_scores': {}
        }
        
        all_results = []
        
        # Check each query
        for query in queries:
            query_results = {
                'query': query,
                'providers': {}
            }
            
            if parallel:
                # Check all providers in parallel
                tasks = [
                    provider.check_visibility(query, brand_terms)
                    for provider in active_providers.values()
                ]
                provider_results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for (name, provider), result in zip(active_providers.items(), provider_results):
                    if isinstance(result, Exception):
                        result = VisibilityResult(
                            provider=name,
                            query=query,
                            found=False,
                            error=str(result),
                            confidence=0.0
                        )
                    query_results['providers'][name] = result
                    all_results.append(result)
            else:
                # Sequential checking (for rate limiting)
                for name, provider in active_providers.items():
                    try:
                        result = await provider.check_visibility(query, brand_terms)
                    except Exception as e:
                        result = VisibilityResult(
                            provider=name,
                            query=query,
                            found=False,
                            error=str(e),
                            confidence=0.0
                        )
                    query_results['providers'][name] = result
                    all_results.append(result)
            
            results['details'].append(query_results)
        
        # Calculate provider-specific scores
        for name, provider in active_providers.items():
            provider_results = [r for r in all_results if r.provider == name]
            score = provider.calculate_visibility_score(provider_results)
            results['provider_scores'][name] = score
        
        # Calculate overall score
        if results['provider_scores']:
            results['summary']['overall_score'] = sum(
                results['provider_scores'].values()
            ) / len(results['provider_scores'])
        else:
            results['summary']['overall_score'] = 0.0
        
        return results


# Factory function to create providers based on configuration
def create_visibility_providers(config: Dict[str, Any]) -> VisibilityOrchestrator:
    """Create visibility orchestrator with configured providers."""
    orchestrator = VisibilityOrchestrator()
    
    # Always include mock provider for testing
    orchestrator.register_provider('mock', MockAIProvider())
    
    # Add configured providers
    if config.get('perplexity_api_key'):
        orchestrator.register_provider(
            VisibilityProvider.PERPLEXITY.value,
            PerplexityAPIProvider({
                'api_key': config['perplexity_api_key'],
                'rate_limit': config.get('perplexity_rate_limit', 10)
            })
        )
    
    # Add more providers as they become available
    # Example: Google AI, ChatGPT plugins, etc.
    
    return orchestrator
"""
Unified GEO (Generative Engine Optimization) Calculator
Combines best features from both legacy implementations
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone
import math
import hashlib
import requests
from bs4 import BeautifulSoup
import re

logger = logging.getLogger(__name__)


class GEOCalculator:
    """
    Calculate GEO (Generative Engine Optimization) scores.
    
    GEO scores range from 0-100 and measure brand visibility/performance in AI responses.
    Higher scores indicate better optimization for generative AI engines.
    
    Score interpretation:
    - 80-100: Excellent visibility and optimization
    - 60-79: Good performance with room for improvement  
    - 40-59: Average performance, significant optimization needed
    - 20-39: Poor visibility, major improvements required
    - 0-19: Critical issues, comprehensive optimization needed
    """
    
    def __init__(
        self,
        weights: Optional[Dict[str, float]] = None,
        citation_cap: int = 10,
        recency_half_life_days: float = 30.0,
        use_real_data: bool = True
    ):
        """
        Initialize GEO calculator with configurable parameters.
        
        Args:
            weights: Component weights (must sum to ~1.0)
            citation_cap: Maximum citations to consider
            recency_half_life_days: Days for score to halve
            use_real_data: Whether to fetch real website data
        """
        # Default weight configuration (optimized)
        self.weights = weights or {
            "citation_frequency": 0.30,
            "sentiment": 0.25,
            "relevance": 0.20,
            "authority": 0.15,
            "position": 0.10
        }
        
        # Validate and normalize weights
        self._normalize_weights()
        
        self.citation_cap = citation_cap
        self.recency_half_life_days = recency_half_life_days
        self.use_real_data = use_real_data
    
    def _normalize_weights(self):
        """Normalize weights to sum to 1.0"""
        total = sum(self.weights.values())
        if abs(total - 1.0) > 0.01:
            for key in self.weights:
                self.weights[key] /= total
    
    def calculate(
        self,
        domain: str,
        content: Optional[str] = None,
        brand_terms: Optional[List[str]] = None,
        queries: Optional[List[Dict]] = None,
        llm_responses: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive GEO score.
        
        Args:
            domain: The domain to analyze
            content: Optional content to analyze
            brand_terms: Brand terms to search for
            queries: List of queries with performance data
            llm_responses: LLM response data for analysis
        
        Returns:
            Dictionary with GEO scores and detailed metrics
        """
        
        # Fetch real website content if enabled and not provided
        if self.use_real_data and not content:
            content = self._fetch_website_content(domain)
        
        # Calculate individual metrics
        metrics = {
            'citation_frequency': self._calculate_citation_frequency(
                domain, llm_responses or []
            ),
            'sentiment_score': self._calculate_sentiment_score(
                llm_responses or []
            ),
            'relevance_score': self._calculate_relevance_score(
                content, brand_terms or [], queries or []
            ),
            'authority_score': self._calculate_authority_score(
                domain, content
            ),
            'position_score': self._calculate_position_score(
                llm_responses or []
            )
        }
        
        # Calculate weighted overall score
        overall_score = sum(
            metrics[key] * self.weights.get(key.replace('_score', ''), 0)
            for key in metrics
        )
        
        # Generate insights
        insights = self._generate_insights(metrics, overall_score)
        
        return {
            'overall_score': round(overall_score, 2),
            'metrics': metrics,
            'weights': self.weights,
            'insights': insights,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'domain': domain
        }
    
    def _fetch_website_content(self, domain: str) -> str:
        """Fetch and extract website content"""
        try:
            # Ensure proper URL format
            if not domain.startswith(('http://', 'https://')):
                domain = f'https://{domain}'
            
            response = requests.get(domain, timeout=10, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; GEOBot/1.0)'
            })
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(['script', 'style']):
                script.decompose()
            
            # Extract text content
            text = soup.get_text()
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = ' '.join(chunk for chunk in chunks if chunk)
            
            return text[:10000]  # Limit content size
            
        except Exception as e:
            logger.warning(f"Could not fetch content from {domain}: {e}")
            return ""
    
    def _calculate_citation_frequency(
        self, 
        domain: str, 
        llm_responses: List[Dict]
    ) -> float:
        """Calculate citation frequency score (0-100)"""
        if not llm_responses:
            return 0.0
        
        citations = 0
        domain_clean = domain.replace('https://', '').replace('http://', '').replace('www.', '')
        
        for response in llm_responses:
            response_text = response.get('response_text', '').lower()
            if domain_clean.lower() in response_text:
                citations += 1
            
            # Check for brand mentions
            if response.get('brand_mentioned'):
                citations += 0.5
        
        # Cap citations and normalize to 0-100
        capped_citations = min(citations, self.citation_cap)
        score = (capped_citations / self.citation_cap) * 100
        
        return round(score, 2)
    
    def _calculate_sentiment_score(self, llm_responses: List[Dict]) -> float:
        """Calculate sentiment score (0-100)"""
        if not llm_responses:
            return 50.0  # Neutral baseline
        
        sentiment_map = {
            'positive': 100,
            'neutral': 50,
            'negative': 0
        }
        
        total_score = 0
        count = 0
        
        for response in llm_responses:
            sentiment = response.get('sentiment', 'neutral')
            total_score += sentiment_map.get(sentiment, 50)
            count += 1
        
        if count == 0:
            return 50.0
        
        return round(total_score / count, 2)
    
    def _calculate_relevance_score(
        self,
        content: str,
        brand_terms: List[str],
        queries: List[Dict]
    ) -> float:
        """Calculate relevance score (0-100)"""
        if not content:
            return 0.0
        
        content_lower = content.lower()
        
        # Check brand term presence
        brand_score = 0
        if brand_terms:
            for term in brand_terms:
                if term.lower() in content_lower:
                    brand_score += 100 / len(brand_terms)
        
        # Check query relevance
        query_score = 0
        if queries:
            for query in queries:
                query_text = query.get('query_text', '').lower()
                if any(word in content_lower for word in query_text.split()):
                    query_score += 100 / len(queries)
        
        # Combine scores
        final_score = (brand_score * 0.6 + query_score * 0.4) if queries else brand_score
        
        return round(min(final_score, 100), 2)
    
    def _calculate_authority_score(self, domain: str, content: str) -> float:
        """Calculate domain authority score (0-100)"""
        
        # Simple heuristic-based authority scoring
        score = 50  # Base score
        
        # Check for HTTPS
        if domain.startswith('https://'):
            score += 10
        
        # Check content quality indicators
        if content:
            # Long-form content
            if len(content) > 2000:
                score += 10
            
            # Professional indicators
            professional_terms = ['privacy', 'terms', 'copyright', 'about', 'contact']
            for term in professional_terms:
                if term in content.lower():
                    score += 2
            
            # Technical SEO indicators
            if '<meta' in content or 'schema.org' in content:
                score += 10
        
        # Domain age and structure (simplified)
        if not any(free_host in domain for free_host in ['blogspot', 'wordpress.com', 'wix.com']):
            score += 10
        
        return round(min(score, 100), 2)
    
    def _calculate_position_score(self, llm_responses: List[Dict]) -> float:
        """Calculate position/ranking score (0-100)"""
        if not llm_responses:
            return 0.0
        
        total_position_score = 0
        count = 0
        
        for response in llm_responses:
            # Check mention position
            position = response.get('mention_position', 100)
            
            # Convert position to score (earlier = better)
            if position <= 1:
                score = 100
            elif position <= 3:
                score = 80
            elif position <= 5:
                score = 60
            elif position <= 10:
                score = 40
            else:
                score = 20
            
            total_position_score += score
            count += 1
        
        if count == 0:
            return 0.0
        
        return round(total_position_score / count, 2)
    
    def _generate_insights(self, metrics: Dict[str, float], overall_score: float) -> List[str]:
        """Generate actionable insights based on metrics"""
        insights = []
        
        # Overall performance
        if overall_score >= 80:
            insights.append("Excellent GEO performance! Your brand is well-optimized for AI engines.")
        elif overall_score >= 60:
            insights.append("Good GEO performance with room for improvement.")
        elif overall_score >= 40:
            insights.append("Average GEO performance. Consider optimization strategies.")
        else:
            insights.append("Poor GEO performance. Immediate optimization needed.")
        
        # Specific metric insights
        if metrics.get('citation_frequency', 0) < 30:
            insights.append("Low citation frequency. Increase brand mentions and backlinks.")
        
        if metrics.get('sentiment_score', 50) < 50:
            insights.append("Negative sentiment detected. Address customer concerns and improve brand perception.")
        
        if metrics.get('relevance_score', 0) < 40:
            insights.append("Low relevance score. Align content with target queries and brand terms.")
        
        if metrics.get('authority_score', 0) < 50:
            insights.append("Low authority score. Build domain credibility and technical SEO.")
        
        if metrics.get('position_score', 0) < 40:
            insights.append("Poor positioning in AI responses. Optimize for featured snippets and top results.")
        
        return insights
    
    def calculate_batch(self, domains: List[str], **kwargs) -> List[Dict[str, Any]]:
        """Calculate GEO scores for multiple domains"""
        results = []
        for domain in domains:
            try:
                result = self.calculate(domain, **kwargs)
                results.append(result)
            except Exception as e:
                logger.error(f"Error calculating GEO for {domain}: {e}")
                results.append({
                    'domain': domain,
                    'error': str(e),
                    'overall_score': 0
                })
        
        return results


# Backward compatibility alias
RealGEOCalculator = GEOCalculator
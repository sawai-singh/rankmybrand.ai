"""Real GEO Calculator - Generates actual scores based on data"""

import logging
from typing import Dict, List, Optional, Any
import json
import hashlib
from datetime import datetime
import requests
from bs4 import BeautifulSoup
import re

logger = logging.getLogger(__name__)

class RealGEOCalculator:
    """Calculate real GEO scores based on actual data analysis."""
    
    def __init__(self):
        self.weights = {
            'citation_frequency': 0.25,
            'sentiment_score': 0.20,
            'relevance_score': 0.20,
            'authority_score': 0.20,
            'position_weight': 0.15
        }
    
    def calculate(
        self,
        domain: str,
        content: Optional[str] = None,
        brand_terms: List[str] = None,
        queries: List[Dict] = None
    ) -> Dict[str, Any]:
        """
        Calculate real GEO score based on actual data.
        
        Args:
            domain: The domain to analyze
            content: Optional content to analyze
            brand_terms: Brand terms to search for
            queries: List of queries with performance data
        
        Returns:
            Dictionary with GEO scores and metrics
        """
        
        # Fetch website content if not provided
        if not content:
            content = self._fetch_website_content(domain)
        
        # Calculate individual metrics
        citation_freq = self._calculate_citation_frequency(content, brand_terms or [domain.split('.')[0]])
        sentiment = self._analyze_sentiment(content)
        relevance = self._calculate_relevance(content, queries)
        authority = self._calculate_authority(domain)
        position = self._calculate_position_weight(domain, queries)
        
        # Calculate statistics metrics
        statistics = self._calculate_statistics_metric(content)
        quotation = self._calculate_quotation_metric(content)
        fluency = self._calculate_fluency_metric(content)
        
        # Calculate overall score (0-100)
        overall_score = (
            citation_freq * self.weights['citation_frequency'] +
            sentiment * self.weights['sentiment_score'] +
            relevance * self.weights['relevance_score'] +
            authority * self.weights['authority_score'] +
            position * self.weights['position_weight']
        ) * 100
        
        # Generate recommendations based on weak areas
        recommendations = self._generate_recommendations({
            'citation_frequency': citation_freq,
            'sentiment': sentiment,
            'relevance': relevance,
            'authority': authority,
            'statistics': statistics,
            'quotation': quotation
        })
        
        return {
            'overall_score': round(overall_score, 2),
            'metrics': {
                'citation_frequency': round(citation_freq, 3),
                'sentiment_score': round(sentiment, 3),
                'relevance_score': round(relevance, 3),
                'authority_score': round(authority, 3),
                'position_weight': round(position, 3),
                'statistics': round(statistics, 3),
                'quotation': round(quotation, 3),
                'fluency': round(fluency, 3),
                'ai_visibility': round(overall_score / 100, 3)
            },
            'recommendations': recommendations,
            'analysis_timestamp': datetime.utcnow().isoformat()
        }
    
    def _fetch_website_content(self, domain: str) -> str:
        """Fetch actual website content."""
        try:
            url = f"https://{domain}" if not domain.startswith('http') else domain
            response = requests.get(url, timeout=10, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; GEOAnalyzer/1.0)'
            })
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract text content
            for script in soup(["script", "style"]):
                script.decompose()
            
            text = soup.get_text()
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = ' '.join(chunk for chunk in chunks if chunk)
            
            return text[:10000]  # Limit to first 10k chars
        except Exception as e:
            logger.error(f"Failed to fetch content for {domain}: {e}")
            return ""
    
    def _calculate_citation_frequency(self, content: str, brand_terms: List[str]) -> float:
        """Calculate how frequently brand is mentioned."""
        if not content:
            return 0.0
        
        content_lower = content.lower()
        total_mentions = 0
        
        for term in brand_terms:
            # Count exact matches and variations
            term_lower = term.lower()
            total_mentions += content_lower.count(term_lower)
            
            # Check for variations (e.g., "Brand's", "Brand-related")
            pattern = re.compile(rf'\b{re.escape(term_lower)}\w*\b')
            total_mentions += len(pattern.findall(content_lower))
        
        # Normalize by content length (mentions per 1000 chars)
        frequency = (total_mentions / max(len(content), 1)) * 1000
        
        # Convert to 0-1 scale (cap at 10 mentions per 1000 chars)
        return min(frequency / 10, 1.0)
    
    def _analyze_sentiment(self, content: str) -> float:
        """Analyze content sentiment (simplified version)."""
        if not content:
            return 0.5  # Neutral
        
        # Simple sentiment analysis based on positive/negative words
        positive_words = [
            'excellent', 'great', 'amazing', 'wonderful', 'fantastic',
            'best', 'superior', 'outstanding', 'perfect', 'innovative',
            'leading', 'trusted', 'reliable', 'efficient', 'powerful'
        ]
        
        negative_words = [
            'bad', 'poor', 'terrible', 'awful', 'worst',
            'fail', 'problem', 'issue', 'difficult', 'complicated',
            'slow', 'expensive', 'limited', 'outdated', 'broken'
        ]
        
        content_lower = content.lower()
        positive_count = sum(1 for word in positive_words if word in content_lower)
        negative_count = sum(1 for word in negative_words if word in content_lower)
        
        # Calculate sentiment score (0-1, where 1 is most positive)
        if positive_count + negative_count == 0:
            return 0.5  # Neutral
        
        sentiment = positive_count / (positive_count + negative_count)
        return sentiment
    
    def _calculate_relevance(self, content: str, queries: List[Dict]) -> float:
        """Calculate content relevance to target queries."""
        if not content or not queries:
            return 0.5
        
        content_lower = content.lower()
        relevance_scores = []
        
        for query_data in queries[:10]:  # Check top 10 queries
            if isinstance(query_data, dict):
                query = query_data.get('query_text', '').lower()
            else:
                query = str(query_data).lower()
            
            # Check if query terms appear in content
            query_words = query.split()
            matches = sum(1 for word in query_words if word in content_lower)
            relevance_scores.append(matches / max(len(query_words), 1))
        
        return sum(relevance_scores) / max(len(relevance_scores), 1)
    
    def _calculate_authority(self, domain: str) -> float:
        """Calculate domain authority (simplified)."""
        # In production, this would check:
        # - Domain age
        # - Backlink profile
        # - SSL certificate
        # - Page speed
        # - Mobile responsiveness
        
        authority_score = 0.5  # Base score
        
        # Check if HTTPS
        try:
            response = requests.head(f"https://{domain}", timeout=5)
            if response.status_code < 400:
                authority_score += 0.1
        except:
            pass
        
        # Check domain characteristics
        if not any(spam in domain for spam in ['-', '_', 'free', 'cheap']):
            authority_score += 0.1
        
        # Premium TLDs get higher score
        if domain.endswith(('.com', '.org', '.net', '.edu', '.gov')):
            authority_score += 0.1
        
        return min(authority_score, 1.0)
    
    def _calculate_position_weight(self, domain: str, queries: List[Dict]) -> float:
        """Calculate average position weight across queries."""
        # In production, this would check actual SERP positions
        # For now, return a moderate score
        return 0.6
    
    def _calculate_statistics_metric(self, content: str) -> float:
        """Calculate presence of statistics and data."""
        if not content:
            return 0.0
        
        # Look for statistical indicators
        stat_patterns = [
            r'\d+%',  # Percentages
            r'\$[\d,]+',  # Dollar amounts
            r'\d+x',  # Multipliers
            r'\d{4}',  # Years
            r'\d+\s*(million|billion|thousand)',  # Large numbers
            r'(survey|study|research|report)',  # Research mentions
        ]
        
        stat_count = 0
        for pattern in stat_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            stat_count += len(matches)
        
        # Normalize (cap at 20 statistical elements)
        return min(stat_count / 20, 1.0)
    
    def _calculate_quotation_metric(self, content: str) -> float:
        """Calculate presence of quotes and citations."""
        if not content:
            return 0.0
        
        # Look for quotation indicators
        quote_patterns = [
            r'"[^"]{20,}"',  # Quoted text
            r"'[^']{20,}'",  # Single quoted text
            r'(said|says|stated|according to|cited)',  # Attribution words
            r'(CEO|President|Director|Expert|Professor)',  # Titles
        ]
        
        quote_count = 0
        for pattern in quote_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            quote_count += len(matches)
        
        # Normalize (cap at 10 quotes)
        return min(quote_count / 10, 1.0)
    
    def _calculate_fluency_metric(self, content: str) -> float:
        """Calculate content fluency and readability."""
        if not content:
            return 0.0
        
        # Simple readability check
        sentences = content.split('.')
        words = content.split()
        
        if len(sentences) == 0 or len(words) == 0:
            return 0.5
        
        # Average sentence length (ideal is 15-20 words)
        avg_sentence_length = len(words) / len(sentences)
        
        # Score based on ideal range
        if 15 <= avg_sentence_length <= 20:
            fluency = 1.0
        elif 10 <= avg_sentence_length <= 30:
            fluency = 0.8
        else:
            fluency = 0.6
        
        # Check for proper capitalization and punctuation
        if content[0].isupper():
            fluency = min(fluency + 0.1, 1.0)
        
        return fluency
    
    def _generate_recommendations(self, metrics: Dict[str, float]) -> List[str]:
        """Generate actionable recommendations based on metrics."""
        recommendations = []
        
        if metrics['citation_frequency'] < 0.5:
            recommendations.append(
                "Increase brand mentions and entity markers throughout your content"
            )
        
        if metrics['statistics'] < 0.5:
            recommendations.append(
                "Add more statistical data, research findings, and numerical evidence"
            )
        
        if metrics['quotation'] < 0.5:
            recommendations.append(
                "Include expert quotes, testimonials, and authoritative citations"
            )
        
        if metrics['authority'] < 0.7:
            recommendations.append(
                "Improve domain authority through quality backlinks and technical SEO"
            )
        
        if metrics['relevance'] < 0.6:
            recommendations.append(
                "Optimize content for target queries and search intent"
            )
        
        if metrics['sentiment'] < 0.6:
            recommendations.append(
                "Balance content tone with more positive language and success stories"
            )
        
        # Always provide at least one recommendation
        if not recommendations:
            recommendations.append(
                "Continue optimizing content freshness and regular updates"
            )
        
        return recommendations[:3]  # Return top 3 recommendations
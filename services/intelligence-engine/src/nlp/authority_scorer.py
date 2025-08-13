"""Authority scoring for domains and sources."""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from src.models.schemas import Citation


class AuthorityScorer:
    """Calculate authority scores for citations and domains."""
    
    def __init__(self):
        # Pre-computed domain authority scores
        self.domain_scores = self._initialize_domain_scores()
        
        # TLD authority weights
        self.tld_weights = {
            ".edu": 0.9,
            ".gov": 0.95,
            ".org": 0.7,
            ".com": 0.5,
            ".net": 0.4,
            ".io": 0.4,
            ".ai": 0.45,
            ".me": 0.3,
            ".info": 0.3
        }
        
        # Source type weights
        self.source_weights = {
            "academic": 0.95,
            "government": 0.92,
            "news": 0.75,
            "corporate": 0.65,
            "blog": 0.45,
            "social": 0.35,
            "unknown": 0.4
        }
    
    def _initialize_domain_scores(self) -> Dict[str, float]:
        """Initialize known domain authority scores."""
        return {
            # Academic and Research
            "arxiv.org": 0.92,
            "scholar.google.com": 0.90,
            "nature.com": 0.95,
            "sciencedirect.com": 0.90,
            "ieee.org": 0.88,
            "acm.org": 0.87,
            "springer.com": 0.85,
            "jstor.org": 0.88,
            
            # News and Media
            "nytimes.com": 0.85,
            "washingtonpost.com": 0.83,
            "bbc.com": 0.87,
            "cnn.com": 0.80,
            "reuters.com": 0.88,
            "apnews.com": 0.86,
            "bloomberg.com": 0.84,
            "wsj.com": 0.86,
            
            # Tech and Developer
            "github.com": 0.85,
            "stackoverflow.com": 0.82,
            "microsoft.com": 0.88,
            "google.com": 0.90,
            "aws.amazon.com": 0.87,
            "developer.mozilla.org": 0.85,
            
            # Reference
            "wikipedia.org": 0.80,
            "britannica.com": 0.85,
            "merriam-webster.com": 0.82,
            
            # AI/ML Specific
            "openai.com": 0.88,
            "anthropic.com": 0.85,
            "huggingface.co": 0.80,
            "deepmind.com": 0.87,
            
            # Social and Community
            "reddit.com": 0.55,
            "quora.com": 0.50,
            "medium.com": 0.60,
            "dev.to": 0.58,
            "hackernews.com": 0.65,
            
            # General
            "linkedin.com": 0.70,
            "twitter.com": 0.45,
            "facebook.com": 0.40,
            "youtube.com": 0.50
        }
    
    def score(self, citations: List[Citation]) -> float:
        """Calculate overall authority score from citations."""
        if not citations:
            return 0.0
        
        scores = []
        for citation in citations:
            domain_score = self.score_domain(citation.domain)
            
            # Adjust for position (earlier citations usually more important)
            position_weight = 1.0 / (1 + citation.position * 0.1)
            
            weighted_score = domain_score * position_weight
            scores.append(weighted_score)
        
        # Return weighted average
        return sum(scores) / len(scores) if scores else 0.0
    
    def score_domain(self, domain: str) -> float:
        """Score a single domain."""
        if not domain:
            return 0.0
        
        domain = domain.lower().strip()
        
        # Check if we have a pre-computed score
        if domain in self.domain_scores:
            return self.domain_scores[domain]
        
        # Calculate based on TLD
        tld_score = self._get_tld_score(domain)
        
        # Estimate source type
        source_type = self._classify_source_type(domain)
        source_score = self.source_weights.get(source_type, 0.4)
        
        # Combine scores
        final_score = 0.6 * tld_score + 0.4 * source_score
        
        # Cache the score
        self.domain_scores[domain] = final_score
        
        return final_score
    
    def _get_tld_score(self, domain: str) -> float:
        """Get score based on TLD."""
        for tld, weight in self.tld_weights.items():
            if domain.endswith(tld):
                return weight
        return 0.4  # Default for unknown TLDs
    
    def _classify_source_type(self, domain: str) -> str:
        """Classify the type of source."""
        domain_lower = domain.lower()
        
        # Academic indicators
        academic_keywords = ['university', 'edu', 'academic', 'journal', 'research', 'scholar']
        if any(kw in domain_lower for kw in academic_keywords):
            return "academic"
        
        # Government indicators
        if '.gov' in domain_lower or 'government' in domain_lower:
            return "government"
        
        # News indicators
        news_keywords = ['news', 'times', 'post', 'journal', 'daily', 'tribune', 'herald']
        if any(kw in domain_lower for kw in news_keywords):
            return "news"
        
        # Corporate indicators
        corporate_keywords = ['corp', 'inc', 'company', 'business', 'enterprise']
        if any(kw in domain_lower for kw in corporate_keywords):
            return "corporate"
        
        # Blog indicators
        blog_keywords = ['blog', 'wordpress', 'medium', 'substack', 'ghost']
        if any(kw in domain_lower for kw in blog_keywords):
            return "blog"
        
        # Social indicators
        social_keywords = ['social', 'forum', 'community', 'reddit', 'twitter', 'facebook']
        if any(kw in domain_lower for kw in social_keywords):
            return "social"
        
        return "unknown"
    
    def calculate_citation_diversity(self, citations: List[Citation]) -> float:
        """Calculate diversity score of citations."""
        if len(citations) <= 1:
            return 0.0
        
        # Get unique domains
        domains = {c.domain for c in citations if c.domain}
        
        # Calculate diversity metrics
        unique_ratio = len(domains) / len(citations)
        
        # Get source types
        source_types = set()
        for domain in domains:
            source_types.add(self._classify_source_type(domain))
        
        type_diversity = len(source_types) / 7  # 7 possible types
        
        # Combine metrics
        diversity_score = 0.7 * unique_ratio + 0.3 * type_diversity
        
        return diversity_score
    
    def rank_citations(self, citations: List[Citation]) -> List[Citation]:
        """Rank citations by authority."""
        scored_citations = []
        
        for citation in citations:
            score = self.score_domain(citation.domain)
            citation.authority_score = score
            scored_citations.append((score, citation))
        
        # Sort by score (descending)
        scored_citations.sort(key=lambda x: x[0], reverse=True)
        
        return [c for _, c in scored_citations]
    
    def get_citation_statistics(self, citations: List[Citation]) -> Dict:
        """Get statistics about citations."""
        if not citations:
            return {
                "total": 0,
                "unique_domains": 0,
                "average_authority": 0.0,
                "max_authority": 0.0,
                "min_authority": 0.0,
                "diversity_score": 0.0,
                "source_distribution": {}
            }
        
        domains = [c.domain for c in citations if c.domain]
        unique_domains = set(domains)
        
        # Calculate authority scores
        scores = [self.score_domain(d) for d in domains]
        
        # Get source type distribution
        source_distribution = {}
        for domain in unique_domains:
            source_type = self._classify_source_type(domain)
            source_distribution[source_type] = source_distribution.get(source_type, 0) + 1
        
        return {
            "total": len(citations),
            "unique_domains": len(unique_domains),
            "average_authority": sum(scores) / len(scores) if scores else 0.0,
            "max_authority": max(scores) if scores else 0.0,
            "min_authority": min(scores) if scores else 0.0,
            "diversity_score": self.calculate_citation_diversity(citations),
            "source_distribution": source_distribution
        }
    
    def update_domain_score(self, domain: str, new_score: float):
        """Update or add a domain score."""
        self.domain_scores[domain.lower()] = min(max(new_score, 0.0), 1.0)
"""Authority scoring for domains and sources with advanced parsing and metrics."""

from typing import Dict, List, Optional, Tuple, Set
from datetime import datetime, timedelta
from urllib.parse import urlparse
import math
import tldextract
import idna
from collections import defaultdict
from src.models.schemas import Citation


class AuthorityScorer:
    """Calculate authority scores for citations and domains with enhanced parsing."""
    
    def __init__(self):
        # Domain scores at registered domain level
        self.domain_scores = self._initialize_domain_scores()
        
        # Subdomain-specific overrides
        self.domain_overrides = self._initialize_domain_overrides()
        
        # Source type allowlist for accurate classification
        self.source_type_allowlist = self._initialize_source_allowlist()
        
        # Multi-level TLD weights (more specific)
        self.tld_weights = {
            # Government domains (highest authority)
            "gov": 0.95,
            "gov.uk": 0.95,
            "gov.au": 0.95,
            "gov.ca": 0.95,
            "go.jp": 0.95,
            "gob.mx": 0.94,
            "gov.in": 0.93,
            "gov.br": 0.93,
            "mil": 0.92,
            "int": 0.90,
            
            # Academic domains
            "edu": 0.90,
            "ac.uk": 0.90,
            "edu.au": 0.90,
            "edu.cn": 0.88,
            "ac.jp": 0.88,
            "edu.br": 0.87,
            "ac.in": 0.87,
            
            # Organizations
            "org": 0.70,
            "org.uk": 0.70,
            
            # Commercial
            "com": 0.50,
            "co.uk": 0.50,
            "com.au": 0.50,
            
            # Network/Tech
            "net": 0.40,
            "io": 0.40,
            "ai": 0.45,
            "tech": 0.42,
            "dev": 0.42,
            
            # Personal/Blog
            "me": 0.30,
            "info": 0.30,
            "blog": 0.25,
            
            # Country codes (default)
            "uk": 0.45,
            "au": 0.45,
            "ca": 0.45,
            "de": 0.45,
            "fr": 0.45,
            "jp": 0.45,
        }
        
        # Source type weights
        self.source_weights = {
            "academic": 0.95,
            "government": 0.92,
            "news": 0.75,
            "reference": 0.78,
            "corporate": 0.65,
            "technical": 0.70,
            "blog": 0.45,
            "social": 0.35,
            "unknown": 0.40
        }
        
        # Cache for parsed domains
        self._parse_cache = {}
        self._score_cache = {}
    
    def _initialize_domain_scores(self) -> Dict[str, float]:
        """Initialize known domain authority scores at registered domain level."""
        return {
            # Academic and Research
            "arxiv.org": 0.92,
            "google.com": 0.90,  # For scholar.google.com
            "nature.com": 0.95,
            "sciencedirect.com": 0.90,
            "ieee.org": 0.88,
            "acm.org": 0.87,
            "springer.com": 0.85,
            "jstor.org": 0.88,
            "pubmed.gov": 0.93,
            "nih.gov": 0.92,
            
            # News and Media
            "nytimes.com": 0.85,
            "washingtonpost.com": 0.83,
            "bbc.com": 0.87,
            "bbc.co.uk": 0.87,
            "cnn.com": 0.80,
            "reuters.com": 0.88,
            "apnews.com": 0.86,
            "bloomberg.com": 0.84,
            "wsj.com": 0.86,
            "theguardian.com": 0.84,
            "ft.com": 0.85,
            
            # Tech and Developer
            "github.com": 0.85,
            "stackoverflow.com": 0.82,
            "microsoft.com": 0.88,
            "amazon.com": 0.85,  # For aws.amazon.com
            "mozilla.org": 0.83,
            "apache.org": 0.82,
            
            # Reference
            "wikipedia.org": 0.80,
            "britannica.com": 0.85,
            "merriam-webster.com": 0.82,
            "dictionary.com": 0.75,
            
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
            "ycombinator.com": 0.65,  # Fixed: was hackernews.com
            "substack.com": 0.55,
            "wordpress.com": 0.45,
            
            # Social Media
            "linkedin.com": 0.70,
            "x.com": 0.45,  # Twitter rebrand
            "twitter.com": 0.45,
            "t.co": 0.40,
            "facebook.com": 0.40,
            "youtube.com": 0.50,
            "mastodon.social": 0.48,
        }
    
    def _initialize_domain_overrides(self) -> Dict[str, float]:
        """Initialize subdomain-specific score overrides."""
        return {
            # Academic subdomains
            "scholar.google.com": 0.92,
            "arxiv.org": 0.92,
            
            # Developer/Technical subdomains
            "developer.mozilla.org": 0.88,
            "docs.aws.amazon.com": 0.87,
            "aws.amazon.com": 0.87,
            "docs.microsoft.com": 0.86,
            "developer.apple.com": 0.85,
            "docs.python.org": 0.85,
            
            # News subdomains
            "news.ycombinator.com": 0.68,
        }
    
    def _initialize_source_allowlist(self) -> Dict[str, str]:
        """Initialize domain to source type mapping."""
        return {
            # Academic
            "arxiv.org": "academic",
            "scholar.google.com": "academic",
            "nature.com": "academic",
            "sciencedirect.com": "academic",
            "ieee.org": "academic",
            "acm.org": "academic",
            "springer.com": "academic",
            "jstor.org": "academic",
            "pubmed.gov": "academic",
            
            # Government
            "nih.gov": "government",
            "cdc.gov": "government",
            "fda.gov": "government",
            "whitehouse.gov": "government",
            
            # News
            "nytimes.com": "news",
            "washingtonpost.com": "news",
            "bbc.com": "news",
            "cnn.com": "news",
            "reuters.com": "news",
            "apnews.com": "news",
            "bloomberg.com": "news",
            "wsj.com": "news",
            "ycombinator.com": "news",
            
            # Reference
            "wikipedia.org": "reference",
            "britannica.com": "reference",
            "merriam-webster.com": "reference",
            
            # Technical
            "github.com": "technical",
            "stackoverflow.com": "technical",
            "developer.mozilla.org": "technical",
            
            # Social/Blog
            "reddit.com": "social",
            "twitter.com": "social",
            "x.com": "social",
            "facebook.com": "social",
            "medium.com": "blog",
            "substack.com": "blog",
            "wordpress.com": "blog",
            "dev.to": "blog",
        }
    
    def parse_domain(self, url_or_domain: str) -> Tuple[str, str, str]:
        """
        Parse URL or domain into components.
        Returns: (full_host, registered_domain, suffix)
        """
        if not url_or_domain:
            return ("", "", "")
        
        # Check cache
        if url_or_domain in self._parse_cache:
            return self._parse_cache[url_or_domain]
        
        # Clean input
        url_or_domain = url_or_domain.strip().lower()
        
        # Add scheme if missing
        if not url_or_domain.startswith(('http://', 'https://', '//')):
            url_or_domain = 'https://' + url_or_domain
        
        try:
            # Parse URL to get hostname
            parsed = urlparse(url_or_domain)
            hostname = parsed.hostname or parsed.path.split('/')[0]
            
            # Handle IDN domains
            try:
                hostname = idna.decode(hostname)
            except (idna.IDNAError, UnicodeError):
                pass  # Keep original if decode fails
            
            # Extract domain parts using tldextract
            ext = tldextract.extract(hostname)
            
            # Build registered domain
            registered = f"{ext.domain}.{ext.suffix}" if ext.suffix else ext.domain
            
            result = (hostname, registered, ext.suffix)
            self._parse_cache[url_or_domain] = result
            return result
            
        except Exception:
            # Fallback to simple parsing
            parts = url_or_domain.replace('https://', '').replace('http://', '').split('/')[0]
            result = (parts, parts, "")
            self._parse_cache[url_or_domain] = result
            return result
    
    def _get_tld_score(self, suffix: str) -> float:
        """Get score based on TLD/suffix with multi-level support."""
        if not suffix:
            return 0.4
        
        suffix = suffix.lower()
        
        # Check exact match first (e.g., "gov.uk")
        if suffix in self.tld_weights:
            return self.tld_weights[suffix]
        
        # Check last part (e.g., "uk" from "gov.uk")
        last_part = suffix.split('.')[-1]
        if last_part in self.tld_weights:
            return self.tld_weights[last_part]
        
        # Default for unknown TLDs
        return 0.4
    
    def _classify_source_type(self, hostname: str, registered_domain: str) -> str:
        """Classify the type of source with allowlist and heuristics."""
        # Check subdomain-specific classification first
        if hostname in self.source_type_allowlist:
            return self.source_type_allowlist[hostname]
        
        # Check registered domain classification
        if registered_domain in self.source_type_allowlist:
            return self.source_type_allowlist[registered_domain]
        
        # Fallback to keyword heuristics (last resort)
        domain_lower = hostname.lower()
        
        # Academic indicators
        if any(kw in domain_lower for kw in ['university', 'edu', 'academic', 'research', 'scholar', 'journal']):
            return "academic"
        
        # Government indicators
        if '.gov' in domain_lower or 'government' in domain_lower:
            return "government"
        
        # News indicators (more restrictive)
        if any(kw in domain_lower for kw in ['news', 'times', 'post', 'tribune', 'herald', 'gazette']):
            return "news"
        
        # Technical indicators
        if any(kw in domain_lower for kw in ['developer', 'docs', 'documentation', 'api']):
            return "technical"
        
        # Blog indicators
        if any(kw in domain_lower for kw in ['blog', 'wordpress', 'medium', 'substack', 'ghost']):
            return "blog"
        
        # Social indicators
        if any(kw in domain_lower for kw in ['social', 'forum', 'community', 'reddit', 'twitter', 'facebook']):
            return "social"
        
        # Corporate indicators
        if any(kw in domain_lower for kw in ['corp', 'inc', 'company', 'business', 'enterprise']):
            return "corporate"
        
        return "unknown"
    
    def score_domain(self, url_or_domain: str) -> float:
        """Score a single domain or URL with clamping."""
        if not url_or_domain:
            return 0.0
        
        # Check cache
        cache_key = url_or_domain.lower().strip()
        if cache_key in self._score_cache:
            return self._score_cache[cache_key]
        
        # Parse domain
        hostname, registered, suffix = self.parse_domain(url_or_domain)
        
        if not hostname:
            return 0.0
        
        # Check subdomain overrides first
        if hostname in self.domain_overrides:
            score = self.domain_overrides[hostname]
        # Then check registered domain scores
        elif registered in self.domain_scores:
            score = self.domain_scores[registered]
        else:
            # Calculate score from components
            tld_score = self._get_tld_score(suffix)
            source_type = self._classify_source_type(hostname, registered)
            source_score = self.source_weights.get(source_type, 0.4)
            
            # Weighted combination
            score = 0.6 * tld_score + 0.4 * source_score
        
        # Clamp to [0, 1]
        score = max(0.0, min(1.0, score))
        
        # Cache the result
        self._score_cache[cache_key] = score
        
        return score
    
    def score(self, citations: List[Citation]) -> float:
        """Calculate overall authority score with exponential decay position weighting."""
        if not citations:
            return 0.0
        
        scores = []
        weights = []
        
        for citation in citations:
            domain_score = self.score_domain(citation.domain)
            
            # Exponential decay for position (0-based index assumed)
            position_weight = math.exp(-0.2 * citation.position)
            
            scores.append(domain_score)
            weights.append(position_weight)
        
        # Calculate weighted average with normalization
        total_weight = sum(weights)
        if total_weight > 0:
            weighted_sum = sum(s * w for s, w in zip(scores, weights))
            return max(0.0, min(1.0, weighted_sum / total_weight))
        
        return 0.0
    
    def calculate_citation_diversity(self, citations: List[Citation]) -> Dict[str, float]:
        """Calculate diversity using Shannon entropy for both source types and domains."""
        if len(citations) <= 1:
            return {
                "type_entropy": 0.0,
                "domain_entropy": 0.0,
                "unique_ratio": 0.0,
                "overall_diversity": 0.0
            }
        
        # Parse all domains
        parsed_domains = []
        for c in citations:
            if c.domain:
                hostname, registered, _ = self.parse_domain(c.domain)
                parsed_domains.append((hostname, registered))
        
        if not parsed_domains:
            return {
                "type_entropy": 0.0,
                "domain_entropy": 0.0,
                "unique_ratio": 0.0,
                "overall_diversity": 0.0
            }
        
        # Calculate unique domain ratio
        unique_registered = set(reg for _, reg in parsed_domains)
        unique_ratio = len(unique_registered) / len(citations)
        
        # Calculate source type entropy
        type_counts = defaultdict(int)
        for hostname, registered in parsed_domains:
            source_type = self._classify_source_type(hostname, registered)
            type_counts[source_type] += 1
        
        type_entropy = self._calculate_shannon_entropy(list(type_counts.values()))
        max_type_entropy = math.log2(len(self.source_weights)) if len(self.source_weights) > 1 else 1
        normalized_type_entropy = type_entropy / max_type_entropy if max_type_entropy > 0 else 0
        
        # Calculate domain entropy (by registered domain)
        domain_counts = defaultdict(int)
        for _, registered in parsed_domains:
            domain_counts[registered] += 1
        
        domain_entropy = self._calculate_shannon_entropy(list(domain_counts.values()))
        max_domain_entropy = math.log2(len(citations))
        normalized_domain_entropy = domain_entropy / max_domain_entropy if max_domain_entropy > 0 else 0
        
        # Overall diversity score
        overall_diversity = (
            0.4 * normalized_type_entropy +
            0.3 * normalized_domain_entropy +
            0.3 * unique_ratio
        )
        
        return {
            "type_entropy": normalized_type_entropy,
            "domain_entropy": normalized_domain_entropy,
            "unique_ratio": unique_ratio,
            "overall_diversity": max(0.0, min(1.0, overall_diversity))
        }
    
    def _calculate_shannon_entropy(self, counts: List[int]) -> float:
        """Calculate Shannon entropy from count distribution."""
        total = sum(counts)
        if total == 0:
            return 0.0
        
        entropy = 0.0
        for count in counts:
            if count > 0:
                p = count / total
                entropy -= p * math.log2(p)
        
        return entropy
    
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
        """Get comprehensive statistics about citations."""
        if not citations:
            return {
                "total": 0,
                "unique_domains": 0,
                "average_authority": 0.0,
                "max_authority": 0.0,
                "min_authority": 0.0,
                "diversity": {
                    "type_entropy": 0.0,
                    "domain_entropy": 0.0,
                    "unique_ratio": 0.0,
                    "overall_diversity": 0.0
                },
                "source_distribution_by_domain": {},
                "source_distribution_by_citation": {}
            }
        
        # Parse domains and calculate scores
        parsed_data = []
        for c in citations:
            if c.domain:
                hostname, registered, _ = self.parse_domain(c.domain)
                score = self.score_domain(c.domain)
                source_type = self._classify_source_type(hostname, registered)
                parsed_data.append({
                    "hostname": hostname,
                    "registered": registered,
                    "score": score,
                    "source_type": source_type
                })
        
        if not parsed_data:
            return self.get_citation_statistics([])  # Return empty stats
        
        # Unique domains
        unique_registered = set(d["registered"] for d in parsed_data)
        
        # Authority scores
        scores = [d["score"] for d in parsed_data]
        
        # Source distribution by unique domain
        source_by_domain = defaultdict(int)
        for registered in unique_registered:
            # Get source type for this domain (use first occurrence)
            for d in parsed_data:
                if d["registered"] == registered:
                    source_by_domain[d["source_type"]] += 1
                    break
        
        # Source distribution by citation count
        source_by_citation = defaultdict(int)
        for d in parsed_data:
            source_by_citation[d["source_type"]] += 1
        
        # Calculate diversity
        diversity = self.calculate_citation_diversity(citations)
        
        return {
            "total": len(citations),
            "unique_domains": len(unique_registered),
            "average_authority": sum(scores) / len(scores),
            "max_authority": max(scores),
            "min_authority": min(scores),
            "diversity": diversity,
            "source_distribution_by_domain": dict(source_by_domain),
            "source_distribution_by_citation": dict(source_by_citation)
        }
    
    def explain_domain(self, url_or_domain: str) -> Dict:
        """Explain how a domain's score was calculated."""
        if not url_or_domain:
            return {
                "input": url_or_domain,
                "error": "Empty input"
            }
        
        hostname, registered, suffix = self.parse_domain(url_or_domain)
        
        # Check for overrides
        has_override = hostname in self.domain_overrides
        has_preset = registered in self.domain_scores
        
        # Get scores
        tld_score = self._get_tld_score(suffix)
        source_type = self._classify_source_type(hostname, registered)
        source_score = self.source_weights.get(source_type, 0.4)
        final_score = self.score_domain(url_or_domain)
        
        return {
            "input": url_or_domain,
            "parsed": {
                "hostname": hostname,
                "registered_domain": registered,
                "suffix": suffix
            },
            "has_override": has_override,
            "has_preset": has_preset,
            "tld_score": tld_score,
            "source_type": source_type,
            "source_score": source_score,
            "final_score": final_score,
            "calculation": "override" if has_override else "preset" if has_preset else "calculated",
            "formula": "N/A" if (has_override or has_preset) else f"0.6 * {tld_score:.2f} + 0.4 * {source_score:.2f}"
        }
    
    def update_domain_score(self, url_or_domain: str, new_score: float, is_override: bool = False):
        """Update or add a domain score with clamping."""
        new_score = max(0.0, min(1.0, new_score))
        
        hostname, registered, _ = self.parse_domain(url_or_domain)
        
        if is_override and hostname != registered:
            # Add as subdomain override
            self.domain_overrides[hostname] = new_score
        else:
            # Add as registered domain score
            self.domain_scores[registered] = new_score
        
        # Clear caches
        self.clear_cache()
    
    def clear_cache(self):
        """Clear all internal caches."""
        self._parse_cache.clear()
        self._score_cache.clear()
    
    def add_to_allowlist(self, domain: str, source_type: str):
        """Add a domain to the source type allowlist."""
        if source_type in self.source_weights:
            hostname, registered, _ = self.parse_domain(domain)
            self.source_type_allowlist[registered] = source_type
            self.clear_cache()
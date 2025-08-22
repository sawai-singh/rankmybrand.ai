"""Extract citations and sources from AI responses with robust parsing."""

import re
from typing import List, Dict, Any, Optional, Tuple, Set
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse, urljoin
from bs4 import BeautifulSoup
import tldextract
import idna
from src.models.schemas import Citation
from src.nlp.authority_scorer import AuthorityScorer


class SourceAliasResolver:
    """Map source names to canonical domains."""
    
    def __init__(self):
        self.aliases = {
            # News sources
            "nytimes": "nytimes.com",
            "ny times": "nytimes.com",
            "new york times": "nytimes.com",
            "the new york times": "nytimes.com",
            "washington post": "washingtonpost.com",
            "wapo": "washingtonpost.com",
            "wsj": "wsj.com",
            "wall street journal": "wsj.com",
            "bbc": "bbc.com",
            "bbc news": "bbc.com",
            "cnn": "cnn.com",
            "reuters": "reuters.com",
            "ap": "apnews.com",
            "ap news": "apnews.com",
            "associated press": "apnews.com",
            "bloomberg": "bloomberg.com",
            "ft": "ft.com",
            "financial times": "ft.com",
            "guardian": "theguardian.com",
            "the guardian": "theguardian.com",
            
            # Academic sources
            "nature": "nature.com",
            "science": "sciencemag.org",
            "arxiv": "arxiv.org",
            "pubmed": "pubmed.gov",
            "jstor": "jstor.org",
            "ieee": "ieee.org",
            "acm": "acm.org",
            "springer": "springer.com",
            
            # Tech sources
            "github": "github.com",
            "stackoverflow": "stackoverflow.com",
            "stack overflow": "stackoverflow.com",
            "hacker news": "news.ycombinator.com",
            "hn": "news.ycombinator.com",
            
            # Reference sources
            "wikipedia": "wikipedia.org",
            "wiki": "wikipedia.org",
            "britannica": "britannica.com",
            "merriam-webster": "merriam-webster.com",
            "dictionary": "dictionary.com",
        }
    
    def resolve(self, source_name: str) -> Optional[str]:
        """Resolve a source name to a domain."""
        normalized = source_name.lower().strip()
        return self.aliases.get(normalized)
    
    def add_alias(self, source_name: str, domain: str):
        """Add a new alias mapping."""
        self.aliases[source_name.lower().strip()] = domain


class CitationExtractor:
    """Extract citations from AI responses with robust URL and domain parsing."""
    
    def __init__(self, authority_scorer: Optional[AuthorityScorer] = None, max_citations: int = 100):
        """
        Initialize the citation extractor.
        
        Args:
            authority_scorer: Optional AuthorityScorer instance (creates one if not provided)
            max_citations: Maximum number of citations to extract (default 100)
        """
        # Dependencies
        self.authority_scorer = authority_scorer or AuthorityScorer()
        self.source_resolver = SourceAliasResolver()
        self.max_citations = max_citations
        
        # Improved URL regex - simpler with post-validation
        self.url_pattern = re.compile(
            r'https?://[^\s<>\]\)"\']+'  # Capture until whitespace or common delimiters
        )
        
        # Separate patterns for different citation types
        self.numeric_ref_pattern = re.compile(r'\[(\d+)\]')
        self.author_year_pattern = re.compile(r'\(([^(),]+),\s*(\d{4})\)')
        self.source_indicator_pattern = re.compile(
            r'(?:According to|Source:|From:|Via:)\s*([^\s,\.][^,\.\n]+)'
        )
        
        # Tracking params to remove
        self.tracking_params = {
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'fbclid', 'gclid', 'ref', 'source', 'share'
        }
        
        # Cache for parsed domains
        self._domain_cache = {}
    
    def extract(self, text: str, provided_citations: Optional[List[Dict[str, Any]]] = None, 
                base_url: Optional[str] = None) -> List[Citation]:
        """
        Extract citations from text and provided citations.
        
        Args:
            text: The text to extract citations from
            provided_citations: Optional list of pre-provided citations
            base_url: Optional base URL for resolving relative links
            
        Returns:
            List of Citation objects
        """
        citations = []
        seen_canonical = set()  # For deduplication
        seen_domains = set()  # Track unique domains
        
        # Process provided citations first
        if provided_citations:
            for cit_data in provided_citations[:self.max_citations]:
                citation = self._parse_provided_citation(cit_data, len(citations))
                if citation and self._should_include_citation(citation, seen_canonical, seen_domains):
                    citations.append(citation)
        
        # Extract URLs from text using finditer for proper positions
        for match in self.url_pattern.finditer(text):
            if len(citations) >= self.max_citations:
                break
                
            url = match.group()
            position = match.start()  # Character offset
            
            # Clean and validate URL
            url = self._clean_url(url)
            if not self._is_valid_url(url):
                continue
            
            # Normalize URL
            normalized_url = self._normalize_url(url, base_url)
            if not normalized_url:
                continue
            
            # Create citation
            citation = self._create_citation_from_url(normalized_url, position)
            if self._should_include_citation(citation, seen_canonical, seen_domains):
                citations.append(citation)
        
        # Extract inline citations
        inline_citations = self._extract_inline_citations(text, seen_canonical, seen_domains)
        citations.extend(inline_citations[:max(0, self.max_citations - len(citations))])
        
        # Sort by position (character offset)
        citations.sort(key=lambda x: x.position)
        
        return citations
    
    def _clean_url(self, url: str) -> str:
        """Clean URL by removing trailing punctuation."""
        # Remove trailing punctuation
        trailing_chars = '.,);:!?\']"\''
        while url and url[-1] in trailing_chars:
            url = url[:-1]
        return url
    
    def _is_valid_url(self, url: str) -> bool:
        """Validate URL scheme and structure."""
        if not url:
            return False
        
        try:
            parsed = urlparse(url)
            # Only accept http(s) schemes
            if parsed.scheme not in ('http', 'https'):
                return False
            # Must have a hostname
            if not parsed.hostname:
                return False
            return True
        except Exception:
            return False
    
    def _normalize_url(self, url: str, base_url: Optional[str] = None) -> Optional[str]:
        """
        Normalize and canonicalize URL.
        
        - Lowercase hostname
        - Remove default ports
        - Remove www prefix
        - Decode IDN
        - Remove fragments
        - Remove tracking parameters
        - Resolve relative URLs if base_url provided
        """
        try:
            # Resolve relative URL if base provided
            if base_url and not url.startswith(('http://', 'https://')):
                url = urljoin(base_url, url)
            
            parsed = urlparse(url.lower())
            
            # Decode IDN hostname
            hostname = parsed.hostname
            if hostname:
                try:
                    hostname = idna.decode(hostname)
                except (idna.IDNAError, UnicodeError):
                    pass  # Keep original if decode fails
                
                # Remove www prefix
                if hostname.startswith('www.'):
                    hostname = hostname[4:]
            
            # Remove default ports
            netloc = hostname or ''
            if parsed.port:
                if not ((parsed.scheme == 'http' and parsed.port == 80) or
                        (parsed.scheme == 'https' and parsed.port == 443)):
                    netloc = f"{hostname}:{parsed.port}"
            
            # Clean query parameters
            if parsed.query:
                params = parse_qs(parsed.query, keep_blank_values=True)
                # Remove tracking parameters
                cleaned_params = {k: v for k, v in params.items() 
                                 if k not in self.tracking_params}
                query = urlencode(cleaned_params, doseq=True)
            else:
                query = ''
            
            # Reconstruct URL without fragment
            normalized = urlunparse((
                parsed.scheme,
                netloc,
                parsed.path,
                parsed.params,
                query,
                ''  # No fragment
            ))
            
            return normalized
            
        except Exception:
            return None
    
    def _parse_domain(self, url_or_domain: str) -> Tuple[str, str, str]:
        """
        Parse URL or domain using tldextract.
        Returns: (hostname, registered_domain, suffix)
        """
        # Check cache
        if url_or_domain in self._domain_cache:
            return self._domain_cache[url_or_domain]
        
        try:
            # Parse URL if needed
            if url_or_domain.startswith(('http://', 'https://')):
                parsed = urlparse(url_or_domain)
                hostname = parsed.hostname or ''
            else:
                hostname = url_or_domain
            
            # Remove port if present
            if ':' in hostname and not hostname.startswith('['):  # Not IPv6
                hostname = hostname.split(':')[0]
            
            # Decode IDN
            try:
                hostname = idna.decode(hostname)
            except (idna.IDNAError, UnicodeError):
                pass
            
            # Extract with tldextract
            ext = tldextract.extract(hostname)
            registered = f"{ext.domain}.{ext.suffix}" if ext.suffix else ext.domain
            
            result = (hostname.lower(), registered.lower(), ext.suffix.lower())
            self._domain_cache[url_or_domain] = result
            return result
            
        except Exception:
            result = ("", "", "")
            self._domain_cache[url_or_domain] = result
            return result
    
    def _parse_provided_citation(self, citation_data: Dict[str, Any], position: int) -> Optional[Citation]:
        """Parse a citation from provided data."""
        try:
            url = citation_data.get("url", "")
            
            # Normalize URL if provided
            if url:
                url = self._normalize_url(url)
                if not url:
                    return None
            
            # Parse domain
            hostname, registered, _ = self._parse_domain(url) if url else ("", "", "")
            
            # Calculate authority only if we have a domain
            authority_score = None
            if registered:
                authority_score = self.authority_scorer.score_domain(registered)
            
            return Citation(
                url=url,
                domain=registered,
                title=citation_data.get("title", ""),
                snippet=citation_data.get("snippet", ""),
                position=position,
                authority_score=authority_score
            )
        except Exception:
            return None
    
    def _create_citation_from_url(self, url: str, position: int) -> Citation:
        """Create citation from normalized URL."""
        hostname, registered, _ = self._parse_domain(url)
        
        return Citation(
            url=url,
            domain=registered,
            position=position,
            authority_score=self.authority_scorer.score_domain(registered) if registered else None
        )
    
    def _extract_inline_citations(self, text: str, seen_canonical: Set[str], 
                                 seen_domains: Set[str]) -> List[Citation]:
        """Extract inline citations from text."""
        citations = []
        
        # Process numeric references [1], [2], etc.
        for match in self.numeric_ref_pattern.finditer(text):
            # These typically refer to a bibliography, skip domain extraction
            continue
        
        # Process author-year citations (Smith, 2021)
        for match in self.author_year_pattern.finditer(text):
            # These are academic citations without domains
            continue
        
        # Process source indicators (According to X, Source: Y)
        for match in self.source_indicator_pattern.finditer(text):
            source_text = match.group(1).strip()
            position = match.start()
            
            # Try to resolve source name to domain
            domain = self.source_resolver.resolve(source_text)
            
            # If not resolved, check if it looks like a domain
            if not domain:
                domain_match = re.search(r'([a-zA-Z0-9-]+\.(?:[a-zA-Z]{2,}|xn--[a-z0-9-]+))', source_text)
                if domain_match:
                    domain = domain_match.group(1).lower()
            
            if domain:
                # Parse to get registered domain
                _, registered, _ = self._parse_domain(domain)
                if registered and registered not in seen_domains:
                    seen_domains.add(registered)
                    citations.append(Citation(
                        url="",
                        domain=registered,
                        position=position,
                        source_name=source_text,  # Keep original source name
                        authority_score=self.authority_scorer.score_domain(registered)
                    ))
        
        return citations
    
    def _should_include_citation(self, citation: Citation, seen_canonical: Set[str], 
                                seen_domains: Set[str]) -> bool:
        """Check if citation should be included (not duplicate)."""
        # Create canonical key
        if citation.url:
            canonical = citation.url
        else:
            canonical = citation.domain
        
        if canonical in seen_canonical:
            return False
        
        seen_canonical.add(canonical)
        if citation.domain:
            seen_domains.add(citation.domain)
        return True
    
    def extract_from_html(self, html: str, base_url: Optional[str] = None) -> List[Citation]:
        """
        Extract citations from HTML content.
        
        Args:
            html: HTML content to parse
            base_url: Optional base URL for resolving relative links
            
        Returns:
            List of Citation objects
        """
        # Try lxml parser, fallback to html.parser
        try:
            soup = BeautifulSoup(html, 'lxml')
        except Exception:
            soup = BeautifulSoup(html, 'html.parser')
        
        citations = []
        seen_canonical = set()
        seen_domains = set()
        
        # First check for canonical URL
        canonical_link = soup.find('link', {'rel': 'canonical'})
        if canonical_link and canonical_link.get('href'):
            base_url = canonical_link['href']
        else:
            # Check Open Graph URL
            og_url = soup.find('meta', {'property': 'og:url'})
            if og_url and og_url.get('content'):
                base_url = og_url['content']
        
        # Find all links
        links = soup.find_all('a', href=True)
        for link in links[:self.max_citations]:
            href = link['href']
            
            # Skip non-http schemes
            if href.startswith(('mailto:', 'tel:', 'javascript:', '#')):
                continue
            
            # Normalize URL
            url = self._normalize_url(href, base_url)
            if not url:
                continue
            
            # Parse domain
            hostname, registered, _ = self._parse_domain(url)
            if not registered:
                continue
            
            # Check for duplicates
            if url in seen_canonical:
                continue
            seen_canonical.add(url)
            seen_domains.add(registered)
            
            citations.append(Citation(
                url=url,
                domain=registered,
                title=link.get_text(strip=True)[:200],  # Limit title length
                position=len(citations),
                authority_score=self.authority_scorer.score_domain(registered)
            ))
        
        # Find citation elements (cite, blockquote)
        cite_elements = soup.find_all(['cite', 'blockquote'])
        for elem in cite_elements[:max(0, self.max_citations - len(citations))]:
            text = elem.get_text(strip=True)
            if not text:
                continue
            
            # Try to extract source
            domain = self.source_resolver.resolve(text)
            if not domain:
                # Look for domain pattern
                domain_match = re.search(r'([a-zA-Z0-9-]+\.(?:[a-zA-Z]{2,}|xn--[a-z0-9-]+))', text)
                if domain_match:
                    domain = domain_match.group(1).lower()
            
            if domain:
                _, registered, _ = self._parse_domain(domain)
                if registered and registered not in seen_domains:
                    seen_domains.add(registered)
                    citations.append(Citation(
                        url="",
                        domain=registered,
                        snippet=text[:200],
                        position=len(citations),
                        authority_score=self.authority_scorer.score_domain(registered)
                    ))
        
        return citations
    
    def get_extraction_summary(self, citations: List[Citation]) -> Dict[str, Any]:
        """
        Get a summary of extracted citations.
        
        Returns:
            Dictionary with extraction statistics and details
        """
        if not citations:
            return {
                "total_citations": 0,
                "unique_domains": 0,
                "by_type": {},
                "by_domain": {},
                "unresolved_sources": [],
                "average_authority": 0.0
            }
        
        # Count by domain
        by_domain = {}
        unique_domains = set()
        
        for c in citations:
            if c.domain:
                unique_domains.add(c.domain)
                by_domain[c.domain] = by_domain.get(c.domain, 0) + 1
        
        # Count by type
        by_type = {
            "with_url": sum(1 for c in citations if c.url),
            "domain_only": sum(1 for c in citations if c.domain and not c.url),
            "unresolved": sum(1 for c in citations if not c.domain)
        }
        
        # Get unresolved sources
        unresolved = [c.source_name for c in citations 
                     if hasattr(c, 'source_name') and c.source_name and not c.domain]
        
        # Calculate average authority
        authority_scores = [c.authority_score for c in citations 
                           if c.authority_score is not None]
        avg_authority = sum(authority_scores) / len(authority_scores) if authority_scores else 0.0
        
        return {
            "total_citations": len(citations),
            "unique_domains": len(unique_domains),
            "by_type": by_type,
            "by_domain": dict(sorted(by_domain.items(), key=lambda x: x[1], reverse=True)[:10]),
            "unresolved_sources": unresolved,
            "average_authority": avg_authority
        }
"""Extract citations and sources from AI responses."""

import re
from typing import List, Dict, Any
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from src.models.schemas import Citation


class CitationExtractor:
    """Extract citations from AI responses."""
    
    def __init__(self):
        # Regex patterns for citation extraction
        self.url_pattern = re.compile(
            r'https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b'
            r'(?:[-a-zA-Z0-9()@:%_\+.~#?&/=]*)'
        )
        self.citation_pattern = re.compile(
            r'\[(\d+)\]|\(([^)]+\d{4}[^)]*)\)|'  # [1] or (Author, 2024)
            r'(?:According to|Source:|From:|Via:)\s*([^,\.\n]+)'  # Source indicators
        )
        self.domain_authority_scores = self._load_domain_scores()
    
    def _load_domain_scores(self) -> Dict[str, float]:
        """Load pre-computed domain authority scores."""
        # In production, load from database or external service
        return {
            "wikipedia.org": 0.95,
            "arxiv.org": 0.90,
            "nature.com": 0.92,
            "sciencedirect.com": 0.88,
            "github.com": 0.85,
            "stackoverflow.com": 0.80,
            "medium.com": 0.60,
            "reddit.com": 0.55,
            "quora.com": 0.50,
        }
    
    def extract(self, text: str, provided_citations: List[Dict[str, Any]] = None) -> List[Citation]:
        """Extract citations from text and provided citations."""
        citations = []
        
        # Process provided citations first
        if provided_citations:
            for idx, cit in enumerate(provided_citations):
                citation = self._parse_provided_citation(cit, idx)
                if citation:
                    citations.append(citation)
        
        # Extract URLs from text
        urls = self.url_pattern.findall(text)
        for idx, url in enumerate(urls):
            if not any(c.url == url for c in citations):
                citation = self._create_citation_from_url(url, len(citations))
                citations.append(citation)
        
        # Extract inline citations
        inline_citations = self._extract_inline_citations(text)
        citations.extend(inline_citations)
        
        # Deduplicate and sort by position
        citations = self._deduplicate_citations(citations)
        citations.sort(key=lambda x: x.position)
        
        return citations
    
    def _parse_provided_citation(self, citation_data: Dict[str, Any], position: int) -> Citation:
        """Parse a citation from provided data."""
        try:
            url = citation_data.get("url", "")
            domain = self._extract_domain(url)
            
            return Citation(
                url=url,
                domain=domain,
                title=citation_data.get("title"),
                snippet=citation_data.get("snippet"),
                position=position,
                authority_score=self._calculate_authority(domain)
            )
        except Exception:
            return None
    
    def _create_citation_from_url(self, url: str, position: int) -> Citation:
        """Create citation from URL."""
        domain = self._extract_domain(url)
        
        return Citation(
            url=url,
            domain=domain,
            position=position,
            authority_score=self._calculate_authority(domain)
        )
    
    def _extract_inline_citations(self, text: str) -> List[Citation]:
        """Extract inline citations from text."""
        citations = []
        matches = self.citation_pattern.finditer(text)
        
        for match in matches:
            citation_text = match.group(0)
            position = match.start()
            
            # Try to extract domain or source name
            domain = self._extract_source_from_text(citation_text)
            
            if domain:
                citations.append(Citation(
                    url="",
                    domain=domain,
                    position=position,
                    authority_score=self._calculate_authority(domain)
                ))
        
        return citations
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL."""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            # Remove www prefix
            if domain.startswith("www."):
                domain = domain[4:]
            return domain
        except Exception:
            return ""
    
    def _extract_source_from_text(self, text: str) -> str:
        """Extract source name from citation text."""
        # Clean up text
        text = text.strip()
        
        # Remove common prefixes
        prefixes = ["According to", "Source:", "From:", "Via:"]
        for prefix in prefixes:
            if text.startswith(prefix):
                text = text[len(prefix):].strip()
                break
        
        # Extract domain-like patterns
        domain_match = re.search(r'([a-zA-Z0-9-]+\.[a-zA-Z]{2,})', text)
        if domain_match:
            return domain_match.group(1).lower()
        
        # Return cleaned text as source name
        return text.split()[0] if text else ""
    
    def _calculate_authority(self, domain: str) -> float:
        """Calculate authority score for a domain."""
        # Check pre-computed scores
        if domain in self.domain_authority_scores:
            return self.domain_authority_scores[domain]
        
        # Default scoring based on TLD
        if domain.endswith(".edu"):
            return 0.85
        elif domain.endswith(".gov"):
            return 0.90
        elif domain.endswith(".org"):
            return 0.70
        elif domain.endswith(".com"):
            return 0.50
        else:
            return 0.40
    
    def _deduplicate_citations(self, citations: List[Citation]) -> List[Citation]:
        """Remove duplicate citations."""
        seen = set()
        unique = []
        
        for citation in citations:
            key = (citation.domain, citation.url)
            if key not in seen:
                seen.add(key)
                unique.append(citation)
        
        return unique
    
    def extract_from_html(self, html: str) -> List[Citation]:
        """Extract citations from HTML content."""
        soup = BeautifulSoup(html, 'lxml')
        citations = []
        
        # Find all links
        links = soup.find_all('a', href=True)
        for idx, link in enumerate(links):
            url = link['href']
            if url.startswith('http'):
                domain = self._extract_domain(url)
                citations.append(Citation(
                    url=url,
                    domain=domain,
                    title=link.get_text(strip=True),
                    position=idx,
                    authority_score=self._calculate_authority(domain)
                ))
        
        # Find citation elements
        cite_elements = soup.find_all(['cite', 'blockquote'])
        for elem in cite_elements:
            text = elem.get_text(strip=True)
            if text:
                domain = self._extract_source_from_text(text)
                if domain:
                    citations.append(Citation(
                        url="",
                        domain=domain,
                        snippet=text[:200],
                        position=len(citations),
                        authority_score=self._calculate_authority(domain)
                    ))
        
        return self._deduplicate_citations(citations)
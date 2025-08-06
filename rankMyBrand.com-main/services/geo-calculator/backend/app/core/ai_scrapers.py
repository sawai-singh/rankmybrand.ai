import asyncio
import aiohttp
from typing import Dict, List, Optional
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime

class AIVisibilityChecker:
    """Check brand visibility across AI platforms."""
    
    def __init__(self):
        self.session = None
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(headers=self.headers)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.session.close()
    
    async def check_perplexity(self, query: str, brand_terms: List[str]) -> Dict:
        """Check Perplexity.ai for brand mentions."""
        try:
            # Using Perplexity's web interface (no official search API)
            url = f"https://www.perplexity.ai/search?q={query.replace(' ', '+')}"
            
            async with self.session.get(url, timeout=10) as response:
                html = await response.text()
                
            soup = BeautifulSoup(html, 'html.parser')
            
            # Look for answer content
            answer_section = soup.find('div', {'class': re.compile('answer|response|result')})
            if not answer_section:
                return {'platform': 'perplexity', 'found': False}
            
            text = answer_section.get_text().lower()
            
            # Check for brand mentions
            mentions = []
            for term in brand_terms:
                if term.lower() in text:
                    # Find context around mention
                    index = text.find(term.lower())
                    start = max(0, index - 100)
                    end = min(len(text), index + 100)
                    context = text[start:end]
                    mentions.append({
                        'term': term,
                        'context': context,
                        'position': index / len(text)  # Relative position
                    })
            
            return {
                'platform': 'perplexity',
                'found': len(mentions) > 0,
                'mentions': mentions,
                'checked_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                'platform': 'perplexity',
                'found': False,
                'error': str(e)
            }
    
    async def check_google_aio(self, query: str, brand_terms: List[str]) -> Dict:
        """Check Google AI Overview."""
        try:
            url = f"https://www.google.com/search?q={query.replace(' ', '+')}"
            
            async with self.session.get(url, timeout=10) as response:
                html = await response.text()
            
            # Look for AI Overview section (class names change frequently)
            ai_patterns = [
                r'class="[^"]*ai[^"]*overview[^"]*"',
                r'class="[^"]*SGE[^"]*"',
                r'data-ai-overview',
            ]
            
            has_aio = any(re.search(pattern, html, re.IGNORECASE) for pattern in ai_patterns)
            
            if not has_aio:
                return {'platform': 'google_aio', 'found': False, 'has_aio': False}
            
            # Extract AI content (simplified - real implementation needs more robust parsing)
            soup = BeautifulSoup(html, 'html.parser')
            
            mentions = []
            text_lower = html.lower()
            
            for term in brand_terms:
                if term.lower() in text_lower:
                    mentions.append({
                        'term': term,
                        'found_in_aio': True
                    })
            
            return {
                'platform': 'google_aio',
                'found': len(mentions) > 0,
                'has_aio': True,
                'mentions': mentions,
                'checked_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                'platform': 'google_aio',
                'found': False,
                'error': str(e)
            }
    
    async def check_all_platforms(self, queries: List[str], brand_terms: List[str]) -> Dict:
        """Check visibility across all platforms."""
        results = {
            'summary': {
                'total_queries': len(queries),
                'platforms_checked': ['perplexity', 'google_aio'],
                'total_mentions': 0,
                'visibility_score': 0
            },
            'details': []
        }
        
        for query in queries[:5]:  # Limit to 5 queries to avoid rate limiting
            query_results = {
                'query': query,
                'platforms': {}
            }
            
            # Check each platform
            perplexity_result = await self.check_perplexity(query, brand_terms)
            query_results['platforms']['perplexity'] = perplexity_result
            
            google_result = await self.check_google_aio(query, brand_terms)
            query_results['platforms']['google_aio'] = google_result
            
            # Add small delay to avoid rate limiting
            await asyncio.sleep(2)
            
            results['details'].append(query_results)
            
            # Update summary
            if perplexity_result.get('found'):
                results['summary']['total_mentions'] += 1
            if google_result.get('found'):
                results['summary']['total_mentions'] += 1
        
        # Calculate visibility score
        total_checks = len(queries) * len(results['summary']['platforms_checked'])
        if total_checks > 0:
            results['summary']['visibility_score'] = (
                results['summary']['total_mentions'] / total_checks * 100
            )
        
        return results

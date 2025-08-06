"""
Batch processing implementation for GEO analysis.
Handles multiple URLs efficiently with progress tracking.
"""

import asyncio
from typing import Dict, List, Optional
from datetime import datetime
import logging

from .job_queue import Job, JobPriority, JobStatus
from .calculator import GEOCalculator
from ..database.db import get_db
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class BatchProcessor:
    """Handles batch GEO analysis with progress tracking and error handling."""
    
    def __init__(self, calculator: GEOCalculator = None):
        self.calculator = calculator or GEOCalculator()
        self._batch_results: Dict[str, Dict] = {}
    
    async def process_batch(self, job: Job) -> Dict:
        """Process a batch analysis job."""
        urls = job.payload.get('urls', [])
        check_ai_visibility = job.payload.get('check_ai_visibility', True)
        batch_id = job.payload.get('batch_id', job.id)
        
        logger.info(f"Starting batch processing for {len(urls)} URLs")
        
        results = {
            'batch_id': batch_id,
            'total_urls': len(urls),
            'processed': 0,
            'successful': 0,
            'failed': 0,
            'results': [],
            'started_at': datetime.utcnow().isoformat(),
            'status': 'processing'
        }
        
        # Process URLs with concurrency control
        semaphore = asyncio.Semaphore(3)  # Limit concurrent analyses
        
        async def process_single_url(url: str, index: int) -> Dict:
            async with semaphore:
                try:
                    logger.info(f"Processing URL {index + 1}/{len(urls)}: {url}")
                    
                    # Fetch content (simplified - in production, use proper content fetching)
                    content = await self._fetch_content(url)
                    
                    if not content:
                        raise ValueError("Failed to fetch content")
                    
                    # Analyze content
                    result = await self.calculator.calculate_geo_score(
                        url=url,
                        content=content,
                        check_ai_visibility=check_ai_visibility,
                        db=None  # Handle DB session properly in production
                    )
                    
                    return {
                        'url': url,
                        'status': 'success',
                        'data': result,
                        'processed_at': datetime.utcnow().isoformat()
                    }
                    
                except Exception as e:
                    logger.error(f"Failed to process {url}: {str(e)}")
                    return {
                        'url': url,
                        'status': 'failed',
                        'error': str(e),
                        'processed_at': datetime.utcnow().isoformat()
                    }
        
        # Process all URLs
        tasks = [process_single_url(url, i) for i, url in enumerate(urls)]
        url_results = await asyncio.gather(*tasks)
        
        # Aggregate results
        for result in url_results:
            results['processed'] += 1
            if result['status'] == 'success':
                results['successful'] += 1
            else:
                results['failed'] += 1
            results['results'].append(result)
        
        results['completed_at'] = datetime.utcnow().isoformat()
        results['status'] = 'completed'
        
        # Store results for retrieval
        self._batch_results[batch_id] = results
        
        logger.info(
            f"Batch {batch_id} completed: "
            f"{results['successful']} successful, {results['failed']} failed"
        )
        
        return results
    
    async def _fetch_content(self, url: str) -> Optional[str]:
        """Fetch content from URL with proper error handling."""
        # Simplified implementation - in production, use aiohttp with retries
        try:
            # This is a placeholder - implement proper content fetching
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=30) as response:
                    if response.status == 200:
                        return await response.text()
                    else:
                        logger.error(f"HTTP {response.status} for {url}")
                        return None
        except Exception as e:
            logger.error(f"Failed to fetch {url}: {e}")
            return None
    
    def get_batch_status(self, batch_id: str) -> Optional[Dict]:
        """Get current status of a batch job."""
        return self._batch_results.get(batch_id)
    
    async def cleanup_old_results(self, hours: int = 24):
        """Clean up old batch results to prevent memory bloat."""
        cutoff = datetime.utcnow().timestamp() - (hours * 3600)
        
        to_remove = []
        for batch_id, result in self._batch_results.items():
            if result.get('completed_at'):
                completed = datetime.fromisoformat(result['completed_at']).timestamp()
                if completed < cutoff:
                    to_remove.append(batch_id)
        
        for batch_id in to_remove:
            del self._batch_results[batch_id]
        
        logger.info(f"Cleaned up {len(to_remove)} old batch results")
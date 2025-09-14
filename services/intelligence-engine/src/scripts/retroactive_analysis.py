#!/usr/bin/env python3
"""
Retroactive Analysis Engine
Processes all existing responses with the new analysis pipeline
Populates GEO, SOV, and recommendations for all historical data
"""

import asyncio
import json
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict, Any
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.core.analysis.response_analyzer import UnifiedResponseAnalyzer, AnalysisMode
from src.core.analysis.recommendation_extractor import IntelligentRecommendationExtractor

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RetroactiveAnalysisEngine:
    """Engine for retroactively analyzing existing responses"""
    
    def __init__(self):
        """Initialize the retroactive analysis engine"""
        self.db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', 5432),
            'database': os.getenv('DB_NAME', 'rankmybrand'),
            'user': os.getenv('DB_USER', 'sawai'),
            'password': os.getenv('DB_PASSWORD', '')
        }
        
        # Initialize analyzers
        openai_key = os.getenv('OPENAI_API_KEY')
        if not openai_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
            
        self.response_analyzer = UnifiedResponseAnalyzer(
            openai_api_key=openai_key,
            mode=AnalysisMode.FULL
        )
        
        self.recommendation_extractor = IntelligentRecommendationExtractor()
        
        self.processed_count = 0
        self.error_count = 0
        self.success_count = 0
    
    def get_db_connection(self):
        """Get database connection"""
        return psycopg2.connect(**self.db_config)
    
    def fetch_existing_responses(self) -> List[Dict[str, Any]]:
        """Fetch all existing responses that need analysis"""
        conn = self.get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Fetch responses that are missing GEO, SOV, or recommendations
                cursor.execute("""
                    SELECT 
                        ar.id,
                        ar.response_text,
                        ar.provider,
                        ar.audit_id,
                        ar.company_id,
                        ar.query_id,
                        aq.query_text,
                        c.name as company_name,
                        c.industry,
                        c.sub_industry,
                        ar.geo_score,
                        ar.sov_score,
                        ar.recommendations,
                        ar.brand_mentioned,
                        ar.sentiment
                    FROM audit_responses ar
                    JOIN ai_queries aq ON aq.id = ar.query_id
                    JOIN companies c ON c.id = ar.company_id
                    WHERE ar.response_text IS NOT NULL
                    AND ar.response_text != ''
                    AND (
                        ar.geo_score IS NULL OR 
                        ar.sov_score IS NULL OR 
                        ar.recommendations IS NULL OR
                        ar.recommendations = '[]'::jsonb
                    )
                    ORDER BY ar.created_at DESC
                """)
                
                responses = cursor.fetchall()
                logger.info(f"Found {len(responses)} responses to process")
                return responses
        finally:
            conn.close()
    
    def fetch_competitors(self, company_id: str) -> List[str]:
        """Fetch competitors for a company"""
        conn = self.get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT competitor_name 
                    FROM company_competitors 
                    WHERE company_id = %s
                """, (company_id,))
                
                return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()
    
    async def analyze_response(self, response_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a single response"""
        try:
            # Get competitors
            competitors = self.fetch_competitors(response_data['company_id'])
            
            # Analyze the response
            analysis = await self.response_analyzer.analyze_response(
                response_text=response_data['response_text'],
                query=response_data['query_text'],
                brand_name=response_data['company_name'],
                competitors=competitors,
                provider=response_data['provider']
            )
            
            # If recommendations are empty, extract them separately
            if not analysis.recommendations:
                try:
                    recommendations = self.recommendation_extractor.extract_recommendations(
                        response_text=response_data['response_text'],
                        brand_name=response_data['company_name'],
                        industry=response_data.get('industry', 'general'),
                        max_recommendations=10
                    )
                    analysis.recommendations = recommendations
                except Exception as e:
                    logger.error(f"Error extracting recommendations: {e}")
                    analysis.recommendations = []
            
            return {
                'success': True,
                'response_id': response_data['id'],
                'geo_score': analysis.geo_score,
                'sov_score': analysis.sov_score,
                'recommendations': analysis.recommendations,
                'brand_mentioned': analysis.brand_analysis.mentioned,
                'sentiment': analysis.brand_analysis.sentiment.value,
                'context_completeness_score': analysis.context_completeness_score,
                'analysis_metadata': {
                    'processing_time_ms': analysis.processing_time_ms,
                    'analysis_id': analysis.analysis_id,
                    'retroactive_analysis': True,
                    'analyzed_at': datetime.now().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error analyzing response {response_data['id']}: {e}")
            return {
                'success': False,
                'response_id': response_data['id'],
                'error': str(e)
            }
    
    def update_response(self, result: Dict[str, Any]):
        """Update response in database with analysis results"""
        if not result['success']:
            self.error_count += 1
            logger.error(f"Skipping update for response {result['response_id']} due to analysis error")
            return
        
        conn = self.get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE audit_responses
                    SET 
                        geo_score = %s,
                        sov_score = %s,
                        recommendations = %s,
                        brand_mentioned = %s,
                        sentiment = %s,
                        context_completeness_score = %s,
                        analysis_metadata = COALESCE(analysis_metadata, '{}'::jsonb) || %s::jsonb,
                        updated_at = NOW()
                    WHERE id = %s
                """, (
                    result['geo_score'],
                    result['sov_score'],
                    json.dumps(result['recommendations']),
                    result.get('brand_mentioned'),
                    result.get('sentiment'),
                    result.get('context_completeness_score'),
                    json.dumps(result['analysis_metadata']),
                    result['response_id']
                ))
                
                # Also update ai_responses if it exists
                cursor.execute("""
                    UPDATE ai_responses
                    SET 
                        geo_score = %s,
                        sov_score = %s,
                        recommendations = %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (
                    result['geo_score'],
                    result['sov_score'],
                    json.dumps(result['recommendations']),
                    result['response_id']
                ))
                
                conn.commit()
                self.success_count += 1
                logger.info(f"Updated response {result['response_id']} - GEO: {result['geo_score']:.1f}, SOV: {result['sov_score']:.1f}, Recommendations: {len(result['recommendations'])}")
                
        except Exception as e:
            logger.error(f"Error updating response {result['response_id']}: {e}")
            self.error_count += 1
            conn.rollback()
        finally:
            conn.close()
    
    async def process_batch(self, responses: List[Dict[str, Any]], batch_size: int = 5):
        """Process responses in batches"""
        total = len(responses)
        
        for i in range(0, total, batch_size):
            batch = responses[i:i+batch_size]
            logger.info(f"Processing batch {i//batch_size + 1}/{(total + batch_size - 1)//batch_size}")
            
            # Analyze batch in parallel
            tasks = [self.analyze_response(resp) for resp in batch]
            results = await asyncio.gather(*tasks)
            
            # Update database with results
            for result in results:
                self.update_response(result)
                self.processed_count += 1
            
            # Log progress
            logger.info(f"Progress: {self.processed_count}/{total} ({self.processed_count*100/total:.1f}%)")
            logger.info(f"Success: {self.success_count}, Errors: {self.error_count}")
            
            # Small delay to avoid overwhelming the API
            await asyncio.sleep(1)
    
    async def run(self):
        """Run the retroactive analysis"""
        logger.info("Starting Retroactive Analysis Engine")
        logger.info("=" * 60)
        
        # Fetch responses to process
        responses = self.fetch_existing_responses()
        
        if not responses:
            logger.info("No responses need processing. All responses have complete metrics!")
            return
        
        logger.info(f"Processing {len(responses)} responses...")
        
        # Process in batches
        await self.process_batch(responses)
        
        # Final summary
        logger.info("=" * 60)
        logger.info("Retroactive Analysis Complete!")
        logger.info(f"Total Processed: {self.processed_count}")
        logger.info(f"Successful: {self.success_count}")
        logger.info(f"Errors: {self.error_count}")
        
        # Generate summary report
        self.generate_summary_report()
    
    def generate_summary_report(self):
        """Generate a summary report of the retroactive analysis"""
        conn = self.get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Get overall statistics
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_responses,
                        COUNT(CASE WHEN geo_score IS NOT NULL THEN 1 END) as with_geo,
                        COUNT(CASE WHEN sov_score IS NOT NULL THEN 1 END) as with_sov,
                        COUNT(CASE WHEN recommendations IS NOT NULL AND recommendations != '[]'::jsonb THEN 1 END) as with_recommendations,
                        AVG(geo_score) as avg_geo,
                        AVG(sov_score) as avg_sov,
                        COUNT(CASE WHEN brand_mentioned = true THEN 1 END) as brand_mentions,
                        COUNT(CASE WHEN sentiment = 'positive' THEN 1 END) as positive_sentiment
                    FROM audit_responses
                    WHERE response_text IS NOT NULL
                """)
                
                stats = cursor.fetchone()
                
                logger.info("\n" + "=" * 60)
                logger.info("RETROACTIVE ANALYSIS REPORT")
                logger.info("=" * 60)
                logger.info(f"Total Responses: {stats['total_responses']}")
                logger.info(f"With GEO Score: {stats['with_geo']} ({stats['with_geo']*100/stats['total_responses']:.1f}%)")
                logger.info(f"With SOV Score: {stats['with_sov']} ({stats['with_sov']*100/stats['total_responses']:.1f}%)")
                logger.info(f"With Recommendations: {stats['with_recommendations']} ({stats['with_recommendations']*100/stats['total_responses']:.1f}%)")
                logger.info(f"Average GEO Score: {stats['avg_geo']:.1f}" if stats['avg_geo'] else "Average GEO Score: N/A")
                logger.info(f"Average SOV Score: {stats['avg_sov']:.1f}" if stats['avg_sov'] else "Average SOV Score: N/A")
                logger.info(f"Brand Mentioned: {stats['brand_mentions']} ({stats['brand_mentions']*100/stats['total_responses']:.1f}%)")
                logger.info(f"Positive Sentiment: {stats['positive_sentiment']} ({stats['positive_sentiment']*100/stats['total_responses']:.1f}%)")
                
                # Save report to file
                report = {
                    'timestamp': datetime.now().isoformat(),
                    'statistics': dict(stats),
                    'processing_summary': {
                        'processed': self.processed_count,
                        'successful': self.success_count,
                        'errors': self.error_count
                    }
                }
                
                with open('retroactive_analysis_report.json', 'w') as f:
                    json.dump(report, f, indent=2)
                
                logger.info("\nDetailed report saved to retroactive_analysis_report.json")
                
        finally:
            conn.close()


async def main():
    """Main entry point"""
    engine = RetroactiveAnalysisEngine()
    await engine.run()


if __name__ == "__main__":
    asyncio.run(main())
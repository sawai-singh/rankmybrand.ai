#!/usr/bin/env python3
"""Test the NLP pipeline with sample data."""

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path

# Add parent directory to path
import sys
sys.path.append(str(Path(__file__).parent.parent))

from src.processors import ResponseProcessor
from src.models.schemas import AIResponse

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def get_sample_data():
    """Get sample AI responses for testing."""
    return [
        {
            "id": "test-001",
            "platform": "openai",
            "promptText": "What is RankMyBrand.ai and how does it compare to AthenaHQ?",
            "responseText": """
            RankMyBrand.ai is an innovative Generative Engine Optimization (GEO) platform that helps brands 
            optimize their visibility in AI-generated responses. Unlike traditional SEO which focuses on 
            search engine rankings, RankMyBrand.ai ensures your brand appears prominently when AI assistants 
            like ChatGPT, Claude, or Perplexity answer user queries.
            
            Compared to AthenaHQ, RankMyBrand.ai offers several advantages:
            1. Real-time monitoring vs AthenaHQ's daily batch processing
            2. Covers 8+ AI platforms while AthenaHQ only covers 5
            3. More affordable pricing at $79-199/month vs AthenaHQ's $270-545/month
            4. Advanced sentiment analysis and content gap detection
            5. Automated action recommendations based on AI response patterns
            
            According to recent benchmarks, RankMyBrand.ai processes responses 10x faster and provides 
            more detailed analytics. The platform uses cutting-edge NLP models to analyze not just mentions 
            but also sentiment, relevance, and authority of citations.
            
            Sources:
            - https://rankmybrand.ai/features
            - https://techcrunch.com/2024/ai-visibility-tools
            - https://www.producthunt.com/posts/rankmybrand
            """,
            "citations": [
                {
                    "url": "https://rankmybrand.ai/features",
                    "title": "RankMyBrand Features",
                    "snippet": "Complete feature list and capabilities"
                },
                {
                    "url": "https://techcrunch.com/2024/ai-visibility-tools",
                    "title": "The Rise of AI Visibility Tools",
                    "snippet": "How brands are optimizing for AI responses"
                }
            ],
            "metadata": {
                "timestamp": datetime.utcnow().isoformat(),
                "model": "gpt-4",
                "temperature": 0.7,
                "position": 1,
                "is_featured": True
            }
        },
        {
            "id": "test-002",
            "platform": "anthropic",
            "promptText": "What are the key features of GEO platforms?",
            "responseText": """
            Generative Engine Optimization (GEO) platforms offer several key features:
            
            1. **AI Response Monitoring**: Track how AI systems mention and describe your brand
            2. **Multi-Platform Coverage**: Monitor responses from ChatGPT, Claude, Gemini, and others
            3. **Sentiment Analysis**: Understand the tone and context of brand mentions
            4. **Competitive Intelligence**: Compare your visibility against competitors
            5. **Content Gap Analysis**: Identify topics where your brand is underrepresented
            
            Leading platforms like RankMyBrand.ai excel in real-time processing, while competitors 
            like AthenaHQ focus on comprehensive daily reports. The choice depends on whether you 
            need instant insights or detailed batch analytics.
            """,
            "citations": [],
            "metadata": {
                "timestamp": datetime.utcnow().isoformat(),
                "model": "claude-3",
                "position": 2
            }
        }
    ]


async def test_pipeline():
    """Test the NLP pipeline with sample data."""
    logger.info("Initializing Response Processor...")
    processor = ResponseProcessor()
    
    sample_data = get_sample_data()
    
    for idx, data in enumerate(sample_data, 1):
        logger.info(f"\n{'='*60}")
        logger.info(f"Testing response {idx}/{len(sample_data)}")
        logger.info(f"Platform: {data['platform']}")
        logger.info(f"Prompt: {data['promptText'][:100]}...")
        
        try:
            # Convert to AIResponse
            response = AIResponse(
                id=data["id"],
                platform=data["platform"],
                prompt_text=data["promptText"],
                response_text=data["responseText"],
                citations=data.get("citations", []),
                metadata=data.get("metadata", {}),
                collected_at=datetime.utcnow()
            )
            
            # Process through pipeline
            logger.info("Processing through NLP pipeline...")
            processed = await processor.process(response)
            
            # Display results
            logger.info("\n--- RESULTS ---")
            logger.info(f"GEO Score: {processed.geo_score:.2f}/100")
            logger.info(f"Share of Voice: {processed.share_of_voice:.2f}%")
            logger.info(f"Citation Frequency: {processed.citation_frequency:.4f}")
            
            if processed.sentiment:
                logger.info(f"Sentiment: {processed.sentiment.label} ({processed.sentiment.score:.2f})")
            
            if processed.relevance:
                logger.info(f"Relevance Score: {processed.relevance.score:.2f}")
                logger.info(f"Keywords Matched: {', '.join(processed.relevance.keywords_matched[:5])}")
            
            logger.info(f"Authority Score: {processed.authority_score:.2f}")
            
            if processed.citations:
                logger.info(f"\nCitations ({len(processed.citations)}):")
                for citation in processed.citations[:3]:
                    logger.info(f"  - {citation.domain} (authority: {citation.authority_score:.2f})")
            
            if processed.entities:
                logger.info(f"\nEntities Detected ({len(processed.entities)}):")
                for entity in processed.entities[:5]:
                    logger.info(f"  - {entity.text} ({entity.type}, confidence: {entity.confidence:.2f})")
            
            if processed.gaps:
                logger.info(f"\nContent Gaps ({len(processed.gaps)}):")
                for gap in processed.gaps[:3]:
                    logger.info(f"  - {gap.type}: {gap.description[:100]}")
            
            logger.info(f"\nProcessing Time: {processed.processing_time_ms}ms")
            
        except Exception as e:
            logger.error(f"Processing failed: {e}")
            import traceback
            traceback.print_exc()
    
    # Display processing statistics
    stats = processor.get_processing_stats()
    logger.info(f"\n{'='*60}")
    logger.info("Processing Statistics:")
    logger.info(f"  Total Processed: {stats['processed_count']}")
    logger.info(f"  Errors: {stats['error_count']}")
    logger.info(f"  Success Rate: {stats['success_rate']*100:.1f}%")


async def test_models():
    """Test individual NLP models."""
    logger.info("Testing individual NLP models...")
    
    # Test sentiment analysis
    try:
        from src.nlp import SentimentAnalyzer
        analyzer = SentimentAnalyzer()
        
        test_texts = [
            "This product is amazing and works perfectly!",
            "The service is okay, nothing special.",
            "Terrible experience, would not recommend."
        ]
        
        logger.info("\nSentiment Analysis:")
        for text in test_texts:
            result = analyzer.analyze(text)
            logger.info(f"  '{text[:50]}...' -> {result.label} ({result.score:.2f})")
    except Exception as e:
        logger.error(f"Sentiment analysis test failed: {e}")
    
    # Test entity detection
    try:
        from src.nlp import EntityDetector
        detector = EntityDetector()
        
        test_text = "RankMyBrand outperforms AthenaHQ with better features and ChatGPT integration."
        entities = detector.detect(test_text)
        
        logger.info(f"\nEntity Detection for: '{test_text}'")
        for entity in entities:
            logger.info(f"  - {entity.text} ({entity.type})")
    except Exception as e:
        logger.error(f"Entity detection test failed: {e}")
    
    # Test relevance scoring
    try:
        from src.nlp import RelevanceScorer
        scorer = RelevanceScorer()
        
        query = "What is RankMyBrand?"
        response = "RankMyBrand is a GEO platform for optimizing AI visibility."
        result = scorer.score(query, response)
        
        logger.info(f"\nRelevance Scoring:")
        logger.info(f"  Query: '{query}'")
        logger.info(f"  Response: '{response}'")
        logger.info(f"  Score: {result.score:.2f}")
        logger.info(f"  Similarity: {result.similarity:.2f}")
    except Exception as e:
        logger.error(f"Relevance scoring test failed: {e}")


async def main():
    """Main test function."""
    logger.info("Starting Intelligence Engine Pipeline Test")
    logger.info("="*60)
    
    # Test individual models
    await test_models()
    
    # Test full pipeline
    await test_pipeline()
    
    logger.info("\n" + "="*60)
    logger.info("Pipeline test complete!")


if __name__ == "__main__":
    asyncio.run(main())
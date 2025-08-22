"""
Test Suite for GEO and SOV Integration
Validates that the enhanced scoring system works correctly
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.analysis.response_analyzer import (
    UnifiedResponseAnalyzer,
    ResponseAnalysis,
    BrandAnalysis,
    CompetitorAnalysis,
    Sentiment,
    ContextQuality,
    RecommendationStrength,
    AnalysisMode
)


class TestGEOCalculation:
    """Test GEO score calculation"""
    
    @pytest.mark.asyncio
    async def test_geo_score_high_quality_response(self):
        """Test GEO score for a high-quality response"""
        
        analyzer = UnifiedResponseAnalyzer(
            openai_api_key="test_key",
            mode=AnalysisMode.FAST
        )
        
        # Create a mock analysis with excellent metrics
        analysis = ResponseAnalysis(
            analysis_id="test_1",
            query="best AI platform",
            response_text="TestBrand is the leading AI platform...",
            provider="openai",
            brand_analysis=BrandAnalysis(
                mentioned=True,
                mention_count=3,  # Multiple mentions
                first_position=10,
                first_position_percentage=5.0,  # Early position
                context_quality=ContextQuality.HIGH,
                sentiment=Sentiment.POSITIVE,
                recommendation_strength=RecommendationStrength.STRONG,
                specific_features_mentioned=["feature1", "feature2"],
                value_props_highlighted=["prop1"]
            ),
            competitors_analysis=[],
            featured_snippet_potential=80.0,
            voice_search_optimized=True,
            content_gaps=[],
            improvement_suggestions=[],
            seo_factors={},
            geo_score=0.0,
            sov_score=0.0,
            context_completeness_score=0.0,
            processing_time_ms=100
        )
        
        # Calculate GEO score
        geo_score = await analyzer._calculate_response_geo_score(
            analysis, "best AI platform", "TestBrand", "openai"
        )
        
        # Should be high score (>70) due to excellent metrics
        assert geo_score > 70
        assert geo_score <= 100
        print(f"High-quality response GEO score: {geo_score}")
    
    @pytest.mark.asyncio
    async def test_geo_score_low_quality_response(self):
        """Test GEO score for a low-quality response"""
        
        analyzer = UnifiedResponseAnalyzer(
            openai_api_key="test_key",
            mode=AnalysisMode.FAST
        )
        
        # Create a mock analysis with poor metrics
        analysis = ResponseAnalysis(
            analysis_id="test_2",
            query="best AI platform",
            response_text="Various platforms exist...",
            provider="unknown",
            brand_analysis=BrandAnalysis(
                mentioned=False,
                mention_count=0,
                first_position=None,
                first_position_percentage=100.0,
                context_quality=ContextQuality.NONE,
                sentiment=Sentiment.NEUTRAL,
                recommendation_strength=RecommendationStrength.NONE,
                specific_features_mentioned=[],
                value_props_highlighted=[]
            ),
            competitors_analysis=[],
            featured_snippet_potential=20.0,
            voice_search_optimized=False,
            content_gaps=["brand not mentioned"],
            improvement_suggestions=[],
            seo_factors={},
            geo_score=0.0,
            sov_score=0.0,
            context_completeness_score=0.0,
            processing_time_ms=100
        )
        
        # Calculate GEO score
        geo_score = await analyzer._calculate_response_geo_score(
            analysis, "best AI platform", "TestBrand", "unknown"
        )
        
        # Should be low score (<30) due to poor metrics
        assert geo_score < 30
        assert geo_score >= 0
        print(f"Low-quality response GEO score: {geo_score}")


class TestSOVCalculation:
    """Test Share of Voice calculation"""
    
    @pytest.mark.asyncio
    async def test_sov_brand_dominance(self):
        """Test SOV when brand dominates the response"""
        
        analyzer = UnifiedResponseAnalyzer(
            openai_api_key="test_key",
            mode=AnalysisMode.FAST
        )
        
        # Brand mentioned 3 times, one competitor mentioned once
        analysis = ResponseAnalysis(
            analysis_id="test_3",
            query="compare AI platforms",
            response_text="TestBrand is superior...",
            provider="openai",
            brand_analysis=BrandAnalysis(
                mentioned=True,
                mention_count=3,
                first_position=10,
                first_position_percentage=5.0,
                context_quality=ContextQuality.HIGH,
                sentiment=Sentiment.POSITIVE,
                recommendation_strength=RecommendationStrength.STRONG,
                specific_features_mentioned=[],
                value_props_highlighted=[]
            ),
            competitors_analysis=[
                CompetitorAnalysis(
                    competitor_name="Competitor1",
                    mentioned=True,
                    mention_count=1,
                    sentiment=Sentiment.NEUTRAL,
                    comparison_context="also mentioned",
                    positioned_better=False
                )
            ],
            featured_snippet_potential=75.0,
            voice_search_optimized=True,
            content_gaps=[],
            improvement_suggestions=[],
            seo_factors={},
            geo_score=0.0,
            sov_score=0.0,
            context_completeness_score=0.0,
            processing_time_ms=100
        )
        
        # Calculate SOV
        sov_score = await analyzer._calculate_response_sov_score(
            analysis, "TestBrand"
        )
        
        # Should be high (>70%) as brand has 3/4 mentions with positive sentiment
        assert sov_score > 70
        assert sov_score <= 100
        print(f"Brand dominance SOV: {sov_score}%")
    
    @pytest.mark.asyncio
    async def test_sov_competitor_dominance(self):
        """Test SOV when competitors dominate"""
        
        analyzer = UnifiedResponseAnalyzer(
            openai_api_key="test_key",
            mode=AnalysisMode.FAST
        )
        
        # Brand mentioned once, competitors mentioned 4 times total
        analysis = ResponseAnalysis(
            analysis_id="test_4",
            query="compare AI platforms",
            response_text="Competitors are better...",
            provider="openai",
            brand_analysis=BrandAnalysis(
                mentioned=True,
                mention_count=1,
                first_position=100,
                first_position_percentage=50.0,
                context_quality=ContextQuality.LOW,
                sentiment=Sentiment.NEGATIVE,
                recommendation_strength=RecommendationStrength.WEAK,
                specific_features_mentioned=[],
                value_props_highlighted=[]
            ),
            competitors_analysis=[
                CompetitorAnalysis(
                    competitor_name="Competitor1",
                    mentioned=True,
                    mention_count=2,
                    sentiment=Sentiment.POSITIVE,
                    comparison_context="better than brand",
                    positioned_better=True
                ),
                CompetitorAnalysis(
                    competitor_name="Competitor2",
                    mentioned=True,
                    mention_count=2,
                    sentiment=Sentiment.POSITIVE,
                    comparison_context="also better",
                    positioned_better=True
                )
            ],
            featured_snippet_potential=30.0,
            voice_search_optimized=False,
            content_gaps=["weak brand presence"],
            improvement_suggestions=[],
            seo_factors={},
            geo_score=0.0,
            sov_score=0.0,
            context_completeness_score=0.0,
            processing_time_ms=100
        )
        
        # Calculate SOV
        sov_score = await analyzer._calculate_response_sov_score(
            analysis, "TestBrand"
        )
        
        # Should be low (<30%) as brand has 1/5 mentions with negative sentiment
        assert sov_score < 30
        assert sov_score >= 0
        print(f"Competitor dominance SOV: {sov_score}%")


class TestAggregateMetrics:
    """Test aggregate metrics calculation"""
    
    @pytest.mark.asyncio
    async def test_overall_score_calculation(self):
        """Test the enhanced overall score formula"""
        
        analyzer = UnifiedResponseAnalyzer(
            openai_api_key="test_key",
            mode=AnalysisMode.FAST
        )
        
        # Create multiple analyses with varying scores
        analyses = []
        
        # High-quality response
        analysis1 = ResponseAnalysis(
            analysis_id="agg_1",
            query="test query 1",
            response_text="Excellent response",
            provider="openai",
            brand_analysis=BrandAnalysis(
                mentioned=True,
                mention_count=2,
                first_position=20,
                first_position_percentage=10.0,
                context_quality=ContextQuality.HIGH,
                sentiment=Sentiment.POSITIVE,
                recommendation_strength=RecommendationStrength.STRONG,
                specific_features_mentioned=["f1"],
                value_props_highlighted=["v1"]
            ),
            competitors_analysis=[],
            featured_snippet_potential=80.0,
            voice_search_optimized=True,
            content_gaps=[],
            improvement_suggestions=[],
            seo_factors={},
            geo_score=75.0,  # Pre-calculated
            sov_score=85.0,  # Pre-calculated
            context_completeness_score=70.0,
            processing_time_ms=100
        )
        analyses.append(analysis1)
        
        # Medium-quality response
        analysis2 = ResponseAnalysis(
            analysis_id="agg_2",
            query="test query 2",
            response_text="Average response",
            provider="anthropic",
            brand_analysis=BrandAnalysis(
                mentioned=True,
                mention_count=1,
                first_position=50,
                first_position_percentage=25.0,
                context_quality=ContextQuality.MEDIUM,
                sentiment=Sentiment.NEUTRAL,
                recommendation_strength=RecommendationStrength.MODERATE,
                specific_features_mentioned=[],
                value_props_highlighted=[]
            ),
            competitors_analysis=[
                CompetitorAnalysis(
                    competitor_name="Comp1",
                    mentioned=True,
                    mention_count=1,
                    sentiment=Sentiment.NEUTRAL,
                    comparison_context=None,
                    positioned_better=False
                )
            ],
            featured_snippet_potential=50.0,
            voice_search_optimized=False,
            content_gaps=[],
            improvement_suggestions=[],
            seo_factors={},
            geo_score=50.0,  # Pre-calculated
            sov_score=50.0,  # Pre-calculated
            context_completeness_score=40.0,
            processing_time_ms=100
        )
        analyses.append(analysis2)
        
        # Calculate aggregate metrics
        metrics = analyzer.calculate_aggregate_metrics(analyses)
        
        # Verify overall score calculation
        # Formula: GEO*0.30 + SOV*0.25 + Rec*0.20 + Sent*0.15 + Vis*0.10
        expected_geo = (75.0 + 50.0) / 2  # 62.5
        expected_sov = (85.0 + 50.0) / 2  # 67.5
        expected_vis = 100.0  # Both mentioned
        expected_sent = (100 + 50) / 2  # 75.0
        expected_rec = (100 + 60) / 2  # 80.0
        
        expected_overall = (
            expected_geo * 0.30 +
            expected_sov * 0.25 +
            expected_rec * 0.20 +
            expected_sent * 0.15 +
            expected_vis * 0.10
        )
        
        assert 'overall_score' in metrics
        assert abs(metrics['overall_score'] - expected_overall) < 5  # Allow small variance
        
        # Verify component scores
        assert 'geo_score' in metrics
        assert 'sov_score' in metrics
        assert 'visibility' in metrics
        assert 'sentiment' in metrics
        assert 'recommendation' in metrics
        
        # Verify provider metrics
        assert 'provider_metrics' in metrics
        assert 'openai' in metrics['provider_metrics']
        assert 'anthropic' in metrics['provider_metrics']
        
        print(f"Overall score: {metrics['overall_score']}")
        print(f"GEO: {metrics['geo_score']}")
        print(f"SOV: {metrics['sov_score']}")
        print(f"Visibility: {metrics['visibility']}")
        print(f"Sentiment: {metrics['sentiment']}")
        print(f"Recommendation: {metrics['recommendation']}")


class TestBusinessLogic:
    """Test business logic and edge cases"""
    
    @pytest.mark.asyncio
    async def test_no_competitors_mentioned(self):
        """Test SOV when no competitors are mentioned"""
        
        analyzer = UnifiedResponseAnalyzer(
            openai_api_key="test_key",
            mode=AnalysisMode.FAST
        )
        
        # Only brand mentioned, no competitors
        analysis = ResponseAnalysis(
            analysis_id="test_5",
            query="AI platform features",
            response_text="TestBrand offers...",
            provider="openai",
            brand_analysis=BrandAnalysis(
                mentioned=True,
                mention_count=2,
                first_position=5,
                first_position_percentage=2.0,
                context_quality=ContextQuality.HIGH,
                sentiment=Sentiment.POSITIVE,
                recommendation_strength=RecommendationStrength.STRONG,
                specific_features_mentioned=["f1", "f2"],
                value_props_highlighted=["v1"]
            ),
            competitors_analysis=[],  # No competitors
            featured_snippet_potential=90.0,
            voice_search_optimized=True,
            content_gaps=[],
            improvement_suggestions=[],
            seo_factors={},
            geo_score=0.0,
            sov_score=0.0,
            context_completeness_score=0.0,
            processing_time_ms=100
        )
        
        sov_score = await analyzer._calculate_response_sov_score(
            analysis, "TestBrand"
        )
        
        # Should be 100% as only brand is mentioned
        assert sov_score == 100.0
        print(f"SOV with no competitors: {sov_score}%")
    
    @pytest.mark.asyncio
    async def test_brand_not_mentioned(self):
        """Test scores when brand is not mentioned at all"""
        
        analyzer = UnifiedResponseAnalyzer(
            openai_api_key="test_key",
            mode=AnalysisMode.FAST
        )
        
        analysis = ResponseAnalysis(
            analysis_id="test_6",
            query="AI platforms",
            response_text="Other platforms...",
            provider="openai",
            brand_analysis=BrandAnalysis(
                mentioned=False,
                mention_count=0,
                first_position=None,
                first_position_percentage=100.0,
                context_quality=ContextQuality.NONE,
                sentiment=Sentiment.NEUTRAL,
                recommendation_strength=RecommendationStrength.NONE,
                specific_features_mentioned=[],
                value_props_highlighted=[]
            ),
            competitors_analysis=[
                CompetitorAnalysis(
                    competitor_name="Competitor1",
                    mentioned=True,
                    mention_count=3,
                    sentiment=Sentiment.POSITIVE,
                    comparison_context=None,
                    positioned_better=False
                )
            ],
            featured_snippet_potential=50.0,
            voice_search_optimized=False,
            content_gaps=["brand not mentioned"],
            improvement_suggestions=["increase brand presence"],
            seo_factors={},
            geo_score=0.0,
            sov_score=0.0,
            context_completeness_score=0.0,
            processing_time_ms=100
        )
        
        # Calculate both scores
        geo_score = await analyzer._calculate_response_geo_score(
            analysis, "AI platforms", "TestBrand", "openai"
        )
        sov_score = await analyzer._calculate_response_sov_score(
            analysis, "TestBrand"
        )
        
        # Both should be 0 or very low
        assert geo_score < 20  # Only provider authority contributes
        assert sov_score == 0.0
        print(f"Brand not mentioned - GEO: {geo_score}, SOV: {sov_score}")


def run_tests():
    """Run all tests"""
    print("Running GEO and SOV Integration Tests...")
    print("=" * 50)
    
    # Run tests
    pytest.main([__file__, "-v", "-s"])


if __name__ == "__main__":
    run_tests()
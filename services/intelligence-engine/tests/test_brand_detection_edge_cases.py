"""
Unit Tests for Brand Detection Edge Cases

Tests the architectural fix for brand name variation extraction
that handles parenthetical brands, multi-word brands, and legal suffixes.

CRITICAL FIXES TESTED:
- boAt bug: "Imagine Marketing Limited (boAt)" -> should detect "boAt"
- Jio bug: "Reliance Jio Infocomm Limited" -> should detect "Jio"
- Traditional names: "Bikaji Foods" -> should detect "Bikaji"
"""

import pytest
import asyncio
from typing import List
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.core.analysis.response_analyzer import UnifiedResponseAnalyzer

# Test configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'test-key')


class TestBrandVariationExtraction:
    """Test the _extract_brand_variations method"""

    @pytest.fixture
    def analyzer(self):
        """Create analyzer instance"""
        return UnifiedResponseAnalyzer(
            openai_api_key=OPENAI_API_KEY,
            model="gpt-5-nano"
        )

    def test_parenthetical_brand_boat(self, analyzer):
        """REGRESSION TEST: boAt bug - extract parenthetical brand name"""
        brand_name = "Imagine Marketing Limited (boAt)"
        variations = analyzer._extract_brand_variations(brand_name)

        # CRITICAL: "boat" must be FIRST (highest priority)
        assert variations[0] == "boat", f"Expected 'boat' as first variation, got {variations[0]}"
        assert "boat" in variations
        assert len(variations) >= 2
        print(f"✅ boAt test passed: {variations}")

    def test_parenthetical_brand_facebook(self, analyzer):
        """Test parenthetical brand extraction for Meta/Facebook"""
        brand_name = "Meta Platforms (Facebook)"
        variations = analyzer._extract_brand_variations(brand_name)

        assert variations[0] == "facebook"
        assert "meta platforms" in variations
        print(f"✅ Facebook test passed: {variations}")

    def test_jio_brand_detection(self, analyzer):
        """REGRESSION TEST: Jio bug - extract brand from legal name"""
        brand_name = "Reliance Jio Infocomm Limited"
        variations = analyzer._extract_brand_variations(brand_name)

        # Should extract "jio" somewhere in variations
        assert any("jio" in v for v in variations), f"'jio' not found in {variations}"
        print(f"✅ Jio test passed: {variations}")

    def test_simple_brand_nike(self, analyzer):
        """Test simple single-word brand"""
        brand_name = "Nike"
        variations = analyzer._extract_brand_variations(brand_name)

        assert "nike" in variations
        assert len(variations) >= 1
        print(f"✅ Nike test passed: {variations}")

    def test_two_word_brand_bikaji(self, analyzer):
        """Test two-word brand name"""
        brand_name = "Bikaji Foods International Ltd."
        variations = analyzer._extract_brand_variations(brand_name)

        assert "bikaji" in variations
        assert "bikaji foods" in variations
        print(f"✅ Bikaji test passed: {variations}")

    def test_legal_suffix_removal(self, analyzer):
        """Test removal of legal suffixes"""
        brand_name = "Tech Company Limited"
        variations = analyzer._extract_brand_variations(brand_name)

        # Should have version without "limited"
        assert any("tech company" in v and "limited" not in v for v in variations), \
            f"Legal suffix not removed from {variations}"
        print(f"✅ Legal suffix test passed: {variations}")

    def test_empty_brand_name(self, analyzer):
        """Test handling of empty brand name"""
        variations = analyzer._extract_brand_variations("")
        assert variations == []
        print("✅ Empty brand name test passed")

    def test_whitespace_only(self, analyzer):
        """Test handling of whitespace-only brand name"""
        variations = analyzer._extract_brand_variations("   ")
        assert variations == []
        print("✅ Whitespace-only test passed")


class TestBrandDetectionInResponses:
    """Test brand detection in actual LLM responses"""

    @pytest.fixture
    def analyzer(self):
        """Create analyzer instance"""
        return UnifiedResponseAnalyzer(
            openai_api_key=OPENAI_API_KEY,
            model="gpt-5-nano"
        )

    @pytest.mark.asyncio
    async def test_boat_detection_in_response(self, analyzer):
        """CRITICAL REGRESSION TEST: boAt mentioned in response"""
        brand_name = "Imagine Marketing Limited (boAt)"
        response_text = """
        Here are options to buy the boAt Rockerz headphones online:
        1. Amazon India has the boAt Rockerz series available
        2. Flipkart also sells boAt products
        """

        analysis = await analyzer._fast_analysis(
            response_text=response_text,
            query="buy boAt Rockerz online",
            brand_name=brand_name,
            competitors=None,
            provider="test"
        )

        # CRITICAL ASSERTIONS
        assert analysis.brand_analysis.mentioned == True, \
            f"boAt should be detected in response but got mentioned={analysis.brand_analysis.mentioned}"
        assert analysis.brand_analysis.mention_count > 0, \
            f"boAt mention count should be > 0, got {analysis.brand_analysis.mention_count}"
        print(f"✅ boAt response detection passed: {analysis.brand_analysis.mention_count} mentions")

    @pytest.mark.asyncio
    async def test_jio_detection_in_response(self, analyzer):
        """CRITICAL REGRESSION TEST: Jio mentioned in response"""
        brand_name = "Reliance Jio Infocomm Limited"
        response_text = """
        Jio offers several prepaid plans with unlimited calling.
        You can recharge your Jio number online through the MyJio app.
        Jio's 5G network is now available in major cities.
        """

        analysis = await analyzer._fast_analysis(
            response_text=response_text,
            query="Jio recharge plans",
            brand_name=brand_name,
            competitors=None,
            provider="test"
        )

        # CRITICAL ASSERTIONS
        assert analysis.brand_analysis.mentioned == True, \
            f"Jio should be detected but got mentioned={analysis.brand_analysis.mentioned}"
        assert analysis.brand_analysis.mention_count >= 3, \
            f"Jio mentioned 3 times, got count={analysis.brand_analysis.mention_count}"
        print(f"✅ Jio response detection passed: {analysis.brand_analysis.mention_count} mentions")

    @pytest.mark.asyncio
    async def test_brand_not_mentioned(self, analyzer):
        """Test response with no brand mention"""
        brand_name = "Imagine Marketing Limited (boAt)"
        response_text = """
        Sony and JBL are popular headphone brands.
        Many people prefer Bose for noise cancellation.
        """

        analysis = await analyzer._fast_analysis(
            response_text=response_text,
            query="best headphones",
            brand_name=brand_name,
            competitors=None,
            provider="test"
        )

        # Should correctly identify NO mention
        assert analysis.brand_analysis.mentioned == False
        assert analysis.brand_analysis.mention_count == 0
        print("✅ No mention test passed")

    @pytest.mark.asyncio
    async def test_brand_position_tracking(self, analyzer):
        """Test first position tracking"""
        brand_name = "Imagine Marketing Limited (boAt)"
        response_text = """
        Sony headphones are great, but boAt offers better value.
        The boAt Rockerz series is very popular.
        """

        analysis = await analyzer._fast_analysis(
            response_text=response_text,
            query="headphone comparison",
            brand_name=brand_name,
            competitors=None,
            provider="test"
        )

        assert analysis.brand_analysis.mentioned == True
        assert analysis.brand_analysis.first_position is not None
        assert analysis.brand_analysis.first_position > 0  # Not at very beginning
        print(f"✅ Position tracking test passed: first_position={analysis.brand_analysis.first_position}")


class TestRegressionSuite:
    """Regression tests for previously failed audits"""

    @pytest.fixture
    def analyzer(self):
        return UnifiedResponseAnalyzer(
            openai_api_key=OPENAI_API_KEY,
            model="gpt-5-nano"
        )

    @pytest.mark.asyncio
    async def test_boat_audit_sample_responses(self, analyzer):
        """Test with actual sample responses from failed boAt audit"""
        brand_name = "Imagine Marketing Limited (boAt)"

        test_responses = [
            ("buy boAt Rockerz online", "Here are options to buy the boAt Rockerz headphones online: 1. Amazon India"),
            ("boAt Wave Smartwatch review", "The boAt Wave smartwatch offers great value with fitness tracking features"),
            ("boAt Airdopes comparison", "boAt Airdopes 141 vs 131: The Airdopes 141 has better battery life"),
        ]

        for query, response in test_responses:
            analysis = await analyzer._fast_analysis(
                response_text=response,
                query=query,
                brand_name=brand_name,
                competitors=None,
                provider="test"
            )

            assert analysis.brand_analysis.mentioned == True, \
                f"Failed for query '{query}': brand not detected in '{response[:100]}...'"
            print(f"✅ Sample response passed: '{query}'")

    @pytest.mark.asyncio
    async def test_batch_analysis_quality(self, analyzer):
        """Test that batch of responses has reasonable detection rate"""
        brand_name = "Imagine Marketing Limited (boAt)"

        # 10 responses, 8 mention boAt, 2 don't
        responses = [
            {"response_text": f"boAt headphones are great for audio quality", "query": "test"},
            {"response_text": f"The boAt Rockerz series is popular", "query": "test"},
            {"response_text": f"I recommend boAt Airdopes for wireless audio", "query": "test"},
            {"response_text": f"boAt offers good value for money", "query": "test"},
            {"response_text": f"Sony and JBL are premium brands", "query": "test"},  # No mention
            {"response_text": f"boAt Wave is a budget smartwatch", "query": "test"},
            {"response_text": f"For sports, boAt products are durable", "query": "test"},
            {"response_text": f"Bose headphones have better noise cancellation", "query": "test"},  # No mention
            {"response_text": f"boAt Stone speakers are waterproof", "query": "test"},
            {"response_text": f"The latest boAt collection has great designs", "query": "test"},
        ]

        analyses = await analyzer.analyze_batch(
            responses=responses,
            brand_name=brand_name,
            parallel=False  # Sequential for test reliability
        )

        mentioned_count = sum(1 for a in analyses if a.brand_analysis.mentioned)
        mention_rate = (mentioned_count / len(analyses)) * 100

        # Should detect 8 out of 10 = 80%
        assert mention_rate >= 75, \
            f"Expected ~80% mention rate, got {mention_rate:.1f}%"
        print(f"✅ Batch quality test passed: {mention_rate:.1f}% detection rate")


class TestComparisonWithOldLogic:
    """Compare old vs new brand detection logic"""

    @pytest.fixture
    def analyzer(self):
        return UnifiedResponseAnalyzer(
            openai_api_key=OPENAI_API_KEY,
            model="gpt-5-nano"
        )

    def test_old_logic_fails_boat(self, analyzer):
        """Demonstrate old logic would fail for boAt"""
        brand_name = "Imagine Marketing Limited (boAt)"

        # OLD LOGIC (what was failing)
        brand_lower = brand_name.lower()
        main_brand_old = brand_lower.split()[0]  # Gets "imagine"
        response_lower = "the boat rockerz headphones are great".lower()

        old_would_detect = (brand_lower in response_lower) or (main_brand_old in response_lower)
        # Result: "imagine marketing limited (boat)" not in response, "imagine" not in response
        # old_would_detect = False ❌

        # NEW LOGIC (what we fixed)
        variations = analyzer._extract_brand_variations(brand_name)
        new_would_detect = any(v in response_lower for v in variations)
        # Result: variations = ["boat", ...], "boat" in response
        # new_would_detect = True ✅

        print(f"Old logic variations: ['{main_brand_old}', full name]")
        print(f"Old logic would detect: {old_would_detect} ❌")
        print(f"New logic variations: {variations}")
        print(f"New logic would detect: {new_would_detect} ✅")

        assert old_would_detect == False, "Old logic should fail (this proves the bug existed)"
        assert new_would_detect == True, "New logic should succeed (this proves the fix works)"
        print("✅ Comparison test passed: New logic fixes old bug")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

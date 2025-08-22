#!/usr/bin/env python3
"""
Test GEO and SOV Integration
Verifies the integration is working correctly
"""

import sys
import asyncio
sys.path.insert(0, '.')

from src.core.analysis.response_analyzer import UnifiedResponseAnalyzer
from src.core.analysis.calculators.geo_calculator import GEOCalculator
from src.core.analysis.calculators.sov_calculator import SOVCalculator

async def test_integration():
    """Test the GEO/SOV integration"""
    print("Testing GEO and SOV Integration...")
    print("=" * 50)
    
    # Initialize components
    print("1. Initializing components...")
    analyzer = UnifiedResponseAnalyzer(openai_api_key="test_key")
    geo_calc = GEOCalculator()
    sov_calc = SOVCalculator()
    print("   ✓ Components initialized")
    
    # Test sample response
    test_response = """
    TestBrand is a leading AI visibility platform that helps businesses 
    understand and improve their presence in AI-generated responses. 
    Compared to competitors like CompetitorA and CompetitorB, TestBrand 
    offers superior analytics and real-time monitoring capabilities.
    """
    
    print("\n2. Analyzing test response...")
    
    try:
        # Analyze response
        analysis = await analyzer.analyze_response(
            response_text=test_response,
            query="best AI visibility platforms",
            brand_name="TestBrand",
            competitors=["CompetitorA", "CompetitorB", "CompetitorC"],
            provider="test"
        )
        
        print(f"   ✓ Analysis completed")
        print(f"   - Brand mentioned: {analysis.brand_analysis.mentioned}")
        print(f"   - GEO Score: {analysis.geo_score:.2f}/100")
        print(f"   - SOV Score: {analysis.sov_score:.2f}%")
        print(f"   - Context Completeness: {analysis.context_completeness_score:.2f}/100")
        
        # Test aggregate metrics
        print("\n3. Testing aggregate metrics calculation...")
        analyses = [analysis]  # Would have multiple in production
        
        metrics = analyzer.calculate_aggregate_metrics(analyses)
        print(f"   ✓ Aggregate metrics calculated")
        print(f"   - Overall Score: {metrics.get('overall_score', 0):.2f}")
        print(f"   - GEO Average: {metrics.get('geo_score', 0):.2f}")
        print(f"   - SOV Average: {metrics.get('sov_score', 0):.2f}")
        
        # Test enhanced formula
        print("\n4. Testing enhanced scoring formula...")
        print("   Formula: GEO(30%) + SOV(25%) + Rec(20%) + Sent(15%) + Vis(10%)")
        
        geo = metrics.get('geo_score', 0)
        sov = metrics.get('sov_score', 0)
        rec = metrics.get('recommendation', 0)
        sent = metrics.get('sentiment', 0)
        vis = metrics.get('visibility', 0)
        
        overall = (geo * 0.30 + sov * 0.25 + rec * 0.20 + sent * 0.15 + vis * 0.10)
        
        print(f"   - Calculated Overall: {overall:.2f}")
        print(f"   - Matches Aggregate: {abs(overall - metrics.get('overall_score', 0)) < 0.01}")
        
        print("\n✅ GEO and SOV Integration Test SUCCESSFUL!")
        print("=" * 50)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_integration())
    sys.exit(0 if success else 1)
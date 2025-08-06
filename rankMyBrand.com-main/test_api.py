#!/usr/bin/env python3
"""
Test script for RankMyBrand GEO Calculator API
"""

import requests
import json

# API endpoint
API_URL = "http://localhost:8000/api/v1/geo/analyze"

# Test data
test_data = {
    "url": "https://www.example.com/blog/ai-search-optimization",
    "content": """
    The Ultimate Guide to AI Search Optimization in 2025

    According to recent studies by MIT researchers, 85% of online searches now involve AI-powered engines. 
    This represents a staggering 150% increase from just two years ago. The shift has fundamentally changed 
    how content creators need to approach SEO.

    Dr. Sarah Johnson, a leading AI researcher at Stanford University, states: "Traditional SEO tactics are 
    becoming obsolete. The new paradigm requires understanding how AI models parse and prioritize information."

    Key Statistics:
    - 73% of Fortune 500 companies have adopted AI-first content strategies
    - Content optimized for AI sees 3.2x higher engagement rates
    - The global AI search market is projected to reach $45 billion by 2026

    Professor Michael Chen from Harvard Business School explains: "Companies that fail to adapt to this new 
    reality risk losing 60% of their organic traffic within the next 18 months."

    Best Practices for AI Optimization:
    1. Focus on comprehensive, authoritative content
    2. Include relevant statistics and data points
    3. Cite credible sources and expert opinions
    4. Structure content for easy AI parsing
    5. Maintain high readability scores

    This guide will help you navigate the evolving landscape of AI-powered search and ensure your content 
    remains visible and relevant in this new era.
    """,
    "brand_terms": ["example", "AI optimization"],
    "target_queries": [
        "AI search optimization",
        "how to optimize for AI search",
        "AI SEO best practices"
    ],
    "check_ai_visibility": False  # Set to True to check actual AI platforms
}

print("Testing RankMyBrand GEO Calculator API...")
print(f"URL: {API_URL}")
print("-" * 50)

try:
    # Make the request
    response = requests.post(API_URL, json=test_data)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Success! GEO Score: {result['geo_score']}/100")
        print("\nMetrics Breakdown:")
        for metric, score in result['metrics'].items():
            print(f"  - {metric.capitalize()}: {score:.1f}")
        
        print("\nTop Recommendations:")
        for i, rec in enumerate(result['recommendations'][:3], 1):
            print(f"  {i}. [{rec['priority'].upper()}] {rec['metric']}: {rec['action']}")
            print(f"     Impact: {rec['impact']}")
            
    else:
        print(f"❌ Error {response.status_code}: {response.text}")
        
except requests.exceptions.ConnectionError:
    print("❌ Error: Cannot connect to API. Make sure the backend is running on port 8000.")
except Exception as e:
    print(f"❌ Unexpected error: {e}")

print("\n" + "-" * 50)
print("Test complete!")
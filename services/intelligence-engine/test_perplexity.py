#!/usr/bin/env python3
"""
Test Perplexity API integration
"""

import asyncio
import aiohttp
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def test_perplexity():
    """Test Perplexity API with the new key"""
    
    api_key = os.getenv('PERPLEXITY_API_KEY')
    if not api_key:
        print("❌ PERPLEXITY_API_KEY not found in environment")
        return False
    
    print(f"✅ API Key found: {api_key[:20]}...")
    
    # Test API call
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "sonar",
        "messages": [{"role": "user", "content": "What is Bikaji Foods known for?"}],
        "temperature": 0.7,
        "max_tokens": 500
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.perplexity.ai/chat/completions",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    print("✅ Perplexity API is working!")
                    print("\nResponse:")
                    print("-" * 50)
                    print(data["choices"][0]["message"]["content"][:500])
                    print("-" * 50)
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ API Error: {response.status}")
                    print(f"Error details: {error_text}")
                    return False
                    
    except Exception as e:
        print(f"❌ Exception occurred: {e}")
        return False

if __name__ == "__main__":
    print("Testing Perplexity API Integration")
    print("=" * 50)
    
    result = asyncio.run(test_perplexity())
    
    if result:
        print("\n✅ SUCCESS: Perplexity is ready to use!")
    else:
        print("\n❌ FAILED: Please check the API key and configuration")
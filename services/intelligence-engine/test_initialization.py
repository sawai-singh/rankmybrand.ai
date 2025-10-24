#!/usr/bin/env python3
"""Test script to debug processor initialization"""

import asyncio
import os
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.config import settings
from src.core.services.job_processor import AuditJobProcessor
from src.core.analysis.query_generator import IntelligentQueryGenerator

async def main():
    print("=" * 80)
    print("INITIALIZATION TEST")
    print("=" * 80)

    # Step 1: Check settings
    print("\n1. Checking Settings object:")
    print(f"   openai_api_key: {settings.openai_api_key[:30]}..." if settings.openai_api_key else "   openai_api_key: NOT SET")
    print(f"   openai_model: {settings.openai_model}")
    print(f"   postgres_host: {settings.postgres_host}")
    print(f"   postgres_db: {settings.postgres_db}")

    # Step 2: Create processor (without initializing)
    print("\n2. Creating AuditJobProcessor:")
    processor = AuditJobProcessor(settings)
    print(f"   ✓ Processor created")
    print(f"   config.openai_api_key: {processor.config.openai_api_key[:30]}..." if processor.config.openai_api_key else "   config.openai_api_key: NOT SET")

    # Step 3: Test creating QueryGenerator directly
    print("\n3. Creating IntelligentQueryGenerator directly:")
    try:
        query_gen = IntelligentQueryGenerator(
            settings.openai_api_key,
            model=settings.openai_model
        )
        print(f"   ✓ Query generator created")
        print(f"   Model: {query_gen.model}")
        print(f"   Client: {query_gen.client}")
        print(f"   API key in client: {hasattr(query_gen.client, 'api_key')}")

        # Try a simple API call
        print("\n4. Testing OpenAI API call:")
        try:
            response = await query_gen.client.chat.completions.create(
                model="gpt-5-nano",
                messages=[{"role": "user", "content": "Say hello in 3 words"}],
                max_completion_tokens=20
            )
            print(f"   ✓ API call succeeded!")
            print(f"   Response: {response.choices[0].message.content}")
        except Exception as e:
            print(f"   ✗ API call failed: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

    except Exception as e:
        print(f"   ✗ Failed to create query generator: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    # Step 4: Try initializing processor (skip WebSocket to avoid port conflict)
    print("\n5. Testing processor initialization (skip WebSocket):")
    try:
        # Temporarily skip WebSocket initialization
        print("   Initializing database pool...")
        import psycopg2
        from psycopg2 import pool as psycopg2_pool
        from psycopg2.extras import RealDictCursor

        processor.db_pool = psycopg2_pool.ThreadedConnectionPool(
            1, 10,
            host=processor.config.postgres_host,
            port=processor.config.postgres_port,
            database=processor.config.postgres_db,
            user=processor.config.postgres_user,
            password=processor.config.postgres_password,
            cursor_factory=RealDictCursor
        )
        print("   ✓ Database pool created")

        # Initialize query generator
        print("   Initializing query generator...")
        processor.query_generator = IntelligentQueryGenerator(
            processor.config.openai_api_key,
            model=settings.openai_model
        )
        print("   ✓ Query generator initialized")

        # Test it
        print("\n6. Testing query generation through processor:")
        from src.core.analysis.query_generator import QueryContext
        test_context = QueryContext(
            company_name='Cal.com',
            industry='Scheduling Software',
            sub_industry='SaaS',
            description='Cal.com is a scheduling platform',
            unique_value_propositions=['Open source', 'Self-hosted options'],
            target_audiences=[],
            competitors=['Calendly', 'Acuity Scheduling'],
            products_services=['Calendar scheduling'],
            pain_points_solved=['Meeting coordination'],
            geographic_markets=['Global'],
            technology_stack=None,
            pricing_model=None,
            company_size=None,
            founding_year=None,
            key_features=['Booking', 'Calendar integration'],
            use_cases=['Meeting scheduling'],
            integrations=None,
            certifications=None
        )

        try:
            queries = await processor.query_generator.generate_queries(
                test_context,
                target_count=2,
                diversity_threshold=0.7
            )
            print(f"   ✓ Query generation succeeded!")
            print(f"   Generated {len(queries)} queries")
            if queries:
                print(f"   Sample query: {queries[0].query_text}")
        except Exception as e:
            print(f"   ✗ Query generation failed: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

    except Exception as e:
        print(f"   ✗ Initialization failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(main())

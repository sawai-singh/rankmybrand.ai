#!/usr/bin/env python3
"""
Script to read and display data from audit_responses table
Shows the structure and analysis data
"""

import asyncio
import asyncpg
import json
from datetime import datetime
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings

async def get_connection():
    """Create database connection."""
    return await asyncpg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password or None
    )

async def show_table_structure(conn):
    """Show the structure of both tables."""
    print("\n" + "="*80)
    print("TABLE STRUCTURES")
    print("="*80)
    
    # Get audit_responses structure
    audit_cols = await conn.fetch("""
        SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_name = 'audit_responses'
        ORDER BY ordinal_position
    """)
    
    print("\n📊 AUDIT_RESPONSES TABLE:")
    print("-" * 60)
    if audit_cols:
        for col in audit_cols:
            print(f"  {col['column_name']:<30} {col['data_type']:<15} "
                  f"Nullable: {col['is_nullable']:<5} "
                  f"Default: {str(col['column_default'])[:30] if col['column_default'] else 'None'}")
    else:
        print("Table not found or empty")

async def show_data_summary(conn):
    """Show summary of data in audit_responses table."""
    print("\n" + "="*80)
    print("DATA SUMMARY")
    print("="*80)

    # Count records in audit_responses
    audit_count = await conn.fetchval("SELECT COUNT(*) FROM audit_responses")
    print(f"\n📈 audit_responses: {audit_count} records")

    # Count analyzed responses
    analyzed_count = await conn.fetchval("SELECT COUNT(*) FROM audit_responses WHERE geo_score IS NOT NULL")
    print(f"📈 analyzed responses: {analyzed_count} records ({analyzed_count*100//audit_count if audit_count > 0 else 0}%)")

    # Show breakdown by provider
    print("\n🔍 Records by Provider:")
    provider_stats = await conn.fetch("""
        SELECT
            provider,
            COUNT(*) as count,
            COUNT(CASE WHEN geo_score IS NOT NULL THEN 1 END) as analyzed
        FROM audit_responses
        GROUP BY provider
        ORDER BY provider
    """)

    if provider_stats:
        print("\n  {:<20} {:>10} {:>10}".format("Provider", "Total", "Analyzed"))
        print("  " + "-" * 42)
        for stat in provider_stats:
            print("  {:<20} {:>10} {:>10}".format(
                stat['provider'] or 'None',
                stat['count'],
                stat['analyzed']
            ))

async def show_sample_data(conn):
    """Show sample records from audit_responses."""
    print("\n" + "="*80)
    print("SAMPLE DATA")
    print("="*80)

    # Sample from audit_responses
    print("\n📋 Sample from audit_responses (latest 3):")
    audit_samples = await conn.fetch("""
        SELECT
            id,
            query_id,
            audit_id,
            provider,
            model_version,
            response_time_ms,
            tokens_used,
            cache_hit,
            brand_mentioned,
            sentiment,
            sentiment_score,
            geo_score,
            sov_score,
            recommendations,
            created_at,
            LEFT(response_text, 100) as response_preview
        FROM audit_responses
        ORDER BY created_at DESC
        LIMIT 3
    """)

    for i, sample in enumerate(audit_samples, 1):
        print(f"\n  Record {i}:")
        print(f"    ID: {sample['id']}")
        print(f"    Query ID: {sample['query_id']}")
        print(f"    Audit ID: {sample['audit_id']}")
        print(f"    Provider: {sample['provider']}")
        print(f"    Model: {sample['model_version']}")
        print(f"    Response Time: {sample['response_time_ms']}ms")
        print(f"    Tokens: {sample['tokens_used']}")
        print(f"    Cache Hit: {sample['cache_hit']}")
        print(f"    Brand Mentioned: {sample['brand_mentioned']}")
        print(f"    Sentiment: {sample['sentiment']} (score: {sample['sentiment_score']})")
        print(f"    GEO Score: {sample['geo_score']}")
        print(f"    SOV Score: {sample['sov_score']}")
        print(f"    Has Recommendations: {'Yes' if sample['recommendations'] else 'No'}")
        print(f"    Created: {sample['created_at']}")
        print(f"    Response: {sample['response_preview']}...")

async def show_audit_stats(conn):
    """Show statistics about audits."""
    print("\n" + "="*80)
    print("AUDIT STATISTICS")
    print("="*80)

    # Show a sample audit with its responses
    sample_audit = await conn.fetchrow("""
        SELECT DISTINCT audit_id
        FROM audit_responses
        WHERE audit_id IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
    """)

    if sample_audit:
        audit_id = sample_audit['audit_id']
        print(f"\n📁 Most Recent Audit ID: {audit_id}")

        # Count responses for this audit
        resp_count = await conn.fetchval("""
            SELECT COUNT(*) FROM audit_responses WHERE audit_id = $1
        """, audit_id)

        analyzed_count = await conn.fetchval("""
            SELECT COUNT(*) FROM audit_responses WHERE audit_id = $1 AND geo_score IS NOT NULL
        """, audit_id)

        print(f"   - Total responses: {resp_count}")
        print(f"   - Analyzed responses: {analyzed_count} ({analyzed_count*100//resp_count if resp_count > 0 else 0}%)")

        # Show the analysis fields in audit_responses
        print("\n✨ Analysis fields in audit_responses:")
        print("   - geo_score: Geographic visibility score")
        print("   - sov_score: Share of Voice score")
        print("   - sentiment & sentiment_score: Sentiment analysis")
        print("   - recommendations: Extracted recommendations (JSON)")
        print("   - competitor_mentions: Competitor analysis")
        print("   - brand_mentioned: Brand presence detection")
    else:
        print("\nNo audits found.")

async def main():
    """Main execution."""
    conn = None
    try:
        print("\n🚀 Connecting to database...")
        conn = await get_connection()
        print("✅ Connected successfully!")
        
        # Show table structures
        await show_table_structure(conn)
        
        # Show data summary
        await show_data_summary(conn)
        
        # Show sample data
        await show_sample_data(conn)

        # Show audit statistics
        await show_audit_stats(conn)
        
        print("\n" + "="*80)
        print("✅ Analysis Complete!")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        if conn:
            await conn.close()
            print("\n👋 Connection closed.")

if __name__ == "__main__":
    asyncio.run(main())
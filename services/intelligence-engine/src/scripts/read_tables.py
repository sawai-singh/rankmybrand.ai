#!/usr/bin/env python3
"""
Script to read and display data from audit_responses and ai_responses tables
Shows the structure and relationship between the two tables
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
    
    # Get ai_responses structure
    ai_cols = await conn.fetch("""
        SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_name = 'ai_responses'
        ORDER BY ordinal_position
    """)
    
    print("\n📊 AI_RESPONSES TABLE:")
    print("-" * 60)
    if ai_cols:
        for col in ai_cols:
            print(f"  {col['column_name']:<30} {col['data_type']:<15} "
                  f"Nullable: {col['is_nullable']:<5} "
                  f"Default: {str(col['column_default'])[:30] if col['column_default'] else 'None'}")
    else:
        print("Table not found or empty")

async def show_data_summary(conn):
    """Show summary of data in both tables."""
    print("\n" + "="*80)
    print("DATA SUMMARY")
    print("="*80)
    
    # Count records in audit_responses
    audit_count = await conn.fetchval("SELECT COUNT(*) FROM audit_responses")
    print(f"\n📈 audit_responses: {audit_count} records")
    
    # Count records in ai_responses
    ai_count = await conn.fetchval("SELECT COUNT(*) FROM ai_responses")
    print(f"📈 ai_responses: {ai_count} records")
    
    # Show breakdown by provider
    print("\n🔍 Records by Provider:")
    provider_stats = await conn.fetch("""
        SELECT 
            'audit_responses' as table_name,
            provider,
            COUNT(*) as count
        FROM audit_responses
        GROUP BY provider
        UNION ALL
        SELECT 
            'ai_responses' as table_name,
            provider,
            COUNT(*) as count
        FROM ai_responses
        GROUP BY provider
        ORDER BY table_name, provider
    """)
    
    if provider_stats:
        print("\n  {:<20} {:<20} {:>10}".format("Table", "Provider", "Count"))
        print("  " + "-" * 52)
        for stat in provider_stats:
            print("  {:<20} {:<20} {:>10}".format(
                stat['table_name'], 
                stat['provider'] or 'None', 
                stat['count']
            ))

async def show_sample_data(conn):
    """Show sample records from both tables."""
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
        print(f"    Created: {sample['created_at']}")
        print(f"    Response: {sample['response_preview']}...")
    
    # Sample from ai_responses
    print("\n📋 Sample from ai_responses (latest 3):")
    ai_samples = await conn.fetch("""
        SELECT 
            id,
            query_id,
            audit_id,
            provider,
            model_version,
            brand_mentioned,
            sentiment,
            sentiment_score,
            geo_score,
            sov_score,
            recommendations,
            created_at,
            LEFT(response_text, 100) as response_preview
        FROM ai_responses
        ORDER BY created_at DESC
        LIMIT 3
    """)
    
    for i, sample in enumerate(ai_samples, 1):
        print(f"\n  Record {i}:")
        print(f"    ID: {sample['id']}")
        print(f"    Query ID: {sample['query_id']}")
        print(f"    Audit ID: {sample['audit_id']}")
        print(f"    Provider: {sample['provider']}")
        print(f"    Model: {sample['model_version']}")
        print(f"    Brand Mentioned: {sample['brand_mentioned']}")
        print(f"    Sentiment: {sample['sentiment']} (score: {sample['sentiment_score']})")
        print(f"    GEO Score: {sample['geo_score']}")
        print(f"    SOV Score: {sample['sov_score']}")
        print(f"    Has Recommendations: {'Yes' if sample['recommendations'] else 'No'}")
        print(f"    Created: {sample['created_at']}")
        print(f"    Response: {sample['response_preview']}...")

async def show_relationship(conn):
    """Show the relationship between the two tables."""
    print("\n" + "="*80)
    print("TABLE RELATIONSHIP")
    print("="*80)
    
    print("\n🔗 Relationship: audit_responses -> ai_responses")
    print("   Migration happens after analysis is complete")
    print("   Key linking fields: audit_id, query_id")
    
    # Check for records in audit_responses not in ai_responses
    unprocessed = await conn.fetchval("""
        SELECT COUNT(*)
        FROM audit_responses ar
        LEFT JOIN ai_responses ai ON ar.id = ai.id
        WHERE ai.id IS NULL
    """)
    
    print(f"\n   📊 Unprocessed records (in audit_responses but not ai_responses): {unprocessed}")
    
    # Show a sample audit with its processed responses
    sample_audit = await conn.fetchrow("""
        SELECT DISTINCT audit_id
        FROM ai_responses
        WHERE audit_id IS NOT NULL
        LIMIT 1
    """)
    
    if sample_audit:
        audit_id = sample_audit['audit_id']
        print(f"\n   📁 Sample Audit ID: {audit_id}")
        
        # Count responses for this audit
        audit_resp_count = await conn.fetchval("""
            SELECT COUNT(*) FROM audit_responses WHERE audit_id = $1
        """, audit_id)
        
        ai_resp_count = await conn.fetchval("""
            SELECT COUNT(*) FROM ai_responses WHERE audit_id = $1
        """, audit_id)
        
        print(f"      - Records in audit_responses: {audit_resp_count}")
        print(f"      - Records in ai_responses: {ai_resp_count}")
        
        # Show the analysis added in ai_responses
        print("\n   ✨ Analysis fields added in ai_responses:")
        print("      - geo_score: Geographic visibility score")
        print("      - sov_score: Share of Voice score")
        print("      - sentiment & sentiment_score: Sentiment analysis")
        print("      - recommendations: Extracted recommendations (JSON)")
        print("      - competitor_mentions: Competitor analysis")
        print("      - brand_mentioned: Brand presence detection")

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
        
        # Show relationship
        await show_relationship(conn)
        
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
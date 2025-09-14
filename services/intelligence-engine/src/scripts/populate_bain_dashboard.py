#!/usr/bin/env python3
"""
Script to populate dashboard_data for Bain & Company's completed audit
This will aggregate recommendations and create the dashboard view
"""

import asyncio
import sys
import os
import logging

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.services.dashboard_data_populator import DashboardDataPopulator
from config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def populate_bain_dashboard():
    """
    Populate dashboard data for Bain & Company's audit
    """
    
    # Known values from our check
    audit_id = 'c157e1b8-ac73-4ee4-b093-2e8d69e52b88'
    company_id = 110  # Bain & Company
    user_id = 1  # We'll need to get this
    
    logger.info(f"Starting dashboard population for Bain & Company (audit: {audit_id})")
    
    # Get a user_id for Bain (we'll use the first user associated with the company)
    import psycopg2
    conn = psycopg2.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password
    )
    
    cursor = conn.cursor()
    # Try to get a user for this company, otherwise use user_id = 1
    cursor.execute("""
        SELECT id FROM users WHERE company_id = %s LIMIT 1
    """, (company_id,))
    
    result = cursor.fetchone()
    if result:
        user_id = result[0]
    else:
        user_id = 1  # Default user
        logger.info(f"No user found for company {company_id}, using default user_id=1")
    
    cursor.close()
    conn.close()
    
    # Create the populator
    db_config = {
        'host': settings.postgres_host,
        'port': settings.postgres_port,
        'database': settings.postgres_db,
        'user': settings.postgres_user,
        'password': settings.postgres_password
    }
    
    populator = DashboardDataPopulator(
        db_config=db_config,
        openai_api_key=settings.openai_api_key
    )
    
    # Run the population
    logger.info("Starting aggregation and population process...")
    
    try:
        success = await populator.populate_dashboard_data(
            audit_id=audit_id,
            company_id=company_id,
            user_id=user_id
        )
        
        if success:
            logger.info("✅ Dashboard data successfully populated!")
            
            # Now let's fetch and display a summary
            conn = psycopg2.connect(**db_config)
            cursor = conn.cursor()
            
            # Get the populated data
            cursor.execute("""
                SELECT 
                    company_name,
                    overall_score,
                    geo_score,
                    sov_score,
                    brand_mention_rate,
                    brand_sentiment,
                    executive_summary
                FROM dashboard_data 
                WHERE audit_id = %s
            """, (audit_id,))
            
            data = cursor.fetchone()
            if data:
                print("\n" + "="*80)
                print("DASHBOARD DATA POPULATED FOR BAIN & COMPANY")
                print("="*80)
                print(f"\n📊 SCORES:")
                print(f"   Overall Score: {data[1]:.2f}")
                print(f"   GEO Score: {data[2]:.2f}")
                print(f"   SOV Score: {data[3]:.2f}")
                print(f"   Brand Mention Rate: {data[4]:.2f}%")
                print(f"   Sentiment: {data[5]}")
                print(f"\n📝 EXECUTIVE SUMMARY:")
                print(f"   {data[6]}")
                print("\n" + "="*80)
                
                # Get top recommendations
                cursor.execute("""
                    SELECT top_recommendations, quick_wins
                    FROM dashboard_data 
                    WHERE audit_id = %s
                """, (audit_id,))
                
                rec_data = cursor.fetchone()
                if rec_data and rec_data[0]:
                    import json
                    recs = json.loads(rec_data[0]) if isinstance(rec_data[0], str) else rec_data[0]
                    quick_wins = json.loads(rec_data[1]) if isinstance(rec_data[1], str) else rec_data[1]
                    
                    print("\n🎯 TOP 3 RECOMMENDATIONS:")
                    for i, rec in enumerate(recs[:3], 1):
                        print(f"\n{i}. {rec.get('headline', 'No headline')}")
                        print(f"   Priority: {rec.get('priority_score', 0):.1f}")
                        print(f"   {rec.get('executive_pitch', '')}")
                    
                    print("\n⚡ QUICK WINS (This Week):")
                    for win in quick_wins[:3]:
                        print(f"   • {win}")
            
            cursor.close()
            conn.close()
            
        else:
            logger.error("❌ Failed to populate dashboard data")
            
    except Exception as e:
        logger.error(f"Error during population: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(populate_bain_dashboard())
#!/usr/bin/env python3
"""
Generic script to populate dashboard_data for ANY completed audit
No hardcoded values - works with actual data from database
"""

import asyncio
import sys
import os
import logging

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.services.dashboard_data_populator import DashboardDataPopulator
from config import settings
import psycopg2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def populate_dashboard_for_any_audit(audit_id: str = None):
    """
    Populate dashboard data for any audit
    If no audit_id provided, will use the most recent completed audit
    """
    
    # Database config
    db_config = {
        'host': settings.postgres_host,
        'port': settings.postgres_port,
        'database': settings.postgres_db,
        'user': settings.postgres_user,
        'password': settings.postgres_password
    }
    
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()
    
    try:
        # If no audit_id provided, get the most recent completed one
        if not audit_id:
            cursor.execute("""
                SELECT a.id, a.company_id, c.name 
                FROM ai_visibility_audits a
                JOIN companies c ON a.company_id = c.id
                WHERE a.status = 'completed'
                ORDER BY a.created_at DESC
                LIMIT 1
            """)
            
            result = cursor.fetchone()
            if not result:
                logger.error("No completed audits found")
                return
            
            audit_id, company_id, company_name = result
            logger.info(f"Using most recent audit: {audit_id} for {company_name}")
        else:
            # Get company info for provided audit
            cursor.execute("""
                SELECT a.company_id, c.name 
                FROM ai_visibility_audits a
                JOIN companies c ON a.company_id = c.id
                WHERE a.id = %s
            """, (audit_id,))
            
            result = cursor.fetchone()
            if not result:
                logger.error(f"Audit {audit_id} not found")
                return
            
            company_id, company_name = result
        
        # Get user_id (any user from this company)
        cursor.execute("""
            SELECT id FROM users WHERE company_id = %s LIMIT 1
        """, (company_id,))
        
        user_result = cursor.fetchone()
        user_id = user_result[0] if user_result else 1
        
    finally:
        cursor.close()
        conn.close()
    
    logger.info(f"Processing audit {audit_id} for company {company_name} (ID: {company_id})")
    
    # Create the populator
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
            
            # Display summary
            conn = psycopg2.connect(**db_config)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    company_name,
                    overall_score,
                    geo_score,
                    sov_score,
                    brand_mention_rate,
                    audit_status
                FROM dashboard_data 
                WHERE audit_id = %s
            """, (audit_id,))
            
            data = cursor.fetchone()
            if data:
                print("\n" + "="*80)
                print(f"DASHBOARD DATA READY FOR {data[0]}")
                print("="*80)
                print(f"\n📊 SCORES:")
                print(f"   Overall Score: {data[1] or 'N/A'}")
                print(f"   GEO Score: {data[2] or 'N/A'}")
                print(f"   SOV Score: {data[3] or 'N/A'}")
                print(f"   Brand Mention Rate: {data[4] or 'N/A'}%")
                print(f"\n🔗 Dashboard URL:")
                print(f"   http://localhost:3000/dashboard/{audit_id}")
                print("\n" + "="*80)
            
            cursor.close()
            conn.close()
            
        else:
            logger.error("❌ Failed to populate dashboard data")
            
    except Exception as e:
        logger.error(f"Error during population: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    # Can pass audit_id as argument or let it find the most recent
    audit_id = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(populate_dashboard_for_any_audit(audit_id))
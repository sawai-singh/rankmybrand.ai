#!/usr/bin/env python3
"""
Script to manually populate dashboard data for Himalaya audit
"""
import asyncio
import os
import sys

# Add src to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.core.services.dashboard_data_populator import DashboardDataPopulator
from src.config import settings

async def main():
    """Populate dashboard data for Himalaya audit"""
    audit_id = "07a3ef05-68a8-4d35-801a-c41227f2bb36"
    company_id = 176  # Himalaya Wellness company ID (corrected)
    user_id = None  # Will be looked up from database

    print(f"Populating dashboard data for audit {audit_id}...")

    db_config = {
        'host': settings.postgres_host,
        'port': settings.postgres_port,
        'database': settings.postgres_db,
        'user': settings.postgres_user,
        'password': settings.postgres_password or ''
    }

    populator = DashboardDataPopulator(
        db_config=db_config,
        openai_api_key=os.getenv('OPENAI_API_KEY')
    )

    success = await populator.populate_dashboard_data(
        audit_id=audit_id,
        company_id=company_id,
        user_id=user_id
    )

    if success:
        print("✅ Dashboard data populated successfully!")
    else:
        print("❌ Failed to populate dashboard data")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

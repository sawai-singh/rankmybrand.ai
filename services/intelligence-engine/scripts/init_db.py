#!/usr/bin/env python3
"""Initialize database schema for Intelligence Engine."""

import asyncio
import logging
import os
from pathlib import Path

# Add parent directory to path
import sys
sys.path.append(str(Path(__file__).parent.parent))

from src.config import settings
from src.storage import PostgresClient

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def init_database():
    """Initialize database schema and tables."""
    logger.info("Initializing database...")
    logger.info(f"Database: {settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}")
    
    # Create PostgreSQL client
    postgres = PostgresClient()
    
    try:
        # Initialize connection pool
        await postgres.initialize()
        logger.info("✓ Connected to PostgreSQL")
        
        # Schema is created in the initialize method
        logger.info("✓ Database schema created")
        
        # Verify tables
        async with postgres.acquire() as conn:
            # Check tables exist
            tables = await conn.fetch("""
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'intelligence'
            """)
            
            logger.info(f"Created {len(tables)} tables:")
            for table in tables:
                logger.info(f"  - {table['tablename']}")
        
        return True
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        return False
        
    finally:
        await postgres.close()


async def seed_data():
    """Optionally seed database with initial data."""
    postgres = PostgresClient()
    
    try:
        await postgres.initialize()
        
        async with postgres.acquire() as conn:
            # Add some default citation sources with authority scores
            await conn.execute("""
                INSERT INTO intelligence.citation_sources 
                (domain, authority_score, is_competitor, is_owned)
                VALUES 
                    ('rankmybrand.ai', 1.0, false, true),
                    ('athena.ai', 0.7, true, false),
                    ('wikipedia.org', 0.8, false, false),
                    ('github.com', 0.85, false, false)
                ON CONFLICT (domain) DO NOTHING
            """)
            
            logger.info("✓ Seeded default citation sources")
        
    except Exception as e:
        logger.error(f"Data seeding failed: {e}")
        
    finally:
        await postgres.close()


async def main():
    """Main initialization function."""
    # Initialize database
    success = await init_database()
    
    if success:
        # Optionally seed data
        await seed_data()
        logger.info("Database initialization complete!")
        return 0
    else:
        logger.error("Database initialization failed!")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
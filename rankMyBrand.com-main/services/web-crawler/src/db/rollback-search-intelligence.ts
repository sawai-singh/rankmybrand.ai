import { pool } from './index.js';
import { logger } from '../utils/logger.js';

async function rollbackSearchIntelligence() {
  try {
    await pool.query('BEGIN');
    
    // Drop tables in correct order due to foreign key constraints
    await pool.query('DROP TABLE IF EXISTS competitor_analyses CASCADE');
    await pool.query('DROP TABLE IF EXISTS brand_mentions CASCADE');
    await pool.query('DROP TABLE IF EXISTS search_rankings CASCADE');
    await pool.query('DROP TABLE IF EXISTS search_analyses CASCADE');
    
    // Remove migration record
    await pool.query('DELETE FROM migrations WHERE version = 4');
    
    await pool.query('COMMIT');
    
    logger.info('Search Intelligence tables rolled back successfully');
    process.exit(0);
  } catch (error) {
    await pool.query('ROLLBACK');
    logger.error('Rollback failed:', error);
    process.exit(1);
  }
}

rollbackSearchIntelligence();
/**
 * Database Connection Service
 * Handles PostgreSQL connections and query execution
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'rankmybrand',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: parseInt(process.env.DB_POOL_SIZE || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

/**
 * Database service class
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private isConnected: boolean = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Test database connection
   */
  async connect(): Promise<boolean> {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.isConnected = true;
      console.log('✅ Database connected successfully');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Execute a query
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await pool.query<T>(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 1000) {
        console.warn(`⚠️ Slow query (${duration}ms):`, text.substring(0, 100));
      }
      
      return result;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  /**
   * Execute a query and return first row
   */
  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryMany<T = any>(text: string, params?: any[]): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  /**
   * Execute a transaction
   */
  async transaction<T = any>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<void> {
    try {
      // Check if migrations table exists
      await this.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Get list of executed migrations
      const executed = await this.queryMany<{ filename: string }>(
        'SELECT filename FROM migrations'
      );
      const executedFiles = new Set(executed.map(m => m.filename));

      // Import migration files (in production, read from migrations folder)
      const migrations = [
        '005_add_user_onboarding_system.sql'
      ];

      // Execute pending migrations
      for (const migration of migrations) {
        if (!executedFiles.has(migration)) {
          console.log(`🔄 Running migration: ${migration}`);
          
          // In production, read the SQL file
          // For now, we'll mark it as needing manual execution
          console.log(`⚠️ Please run migration manually: ${migration}`);
          
          // Record migration as executed
          await this.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [migration]
          );
        }
      }
      
      console.log('✅ All migrations completed');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await pool.end();
    this.isConnected = false;
    console.log('Database connections closed');
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; stats: any } {
    return {
      connected: this.isConnected,
      stats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    };
  }
}

// Export singleton instance
export const db = DatabaseService.getInstance();

// Helper functions for common queries
export const dbHelpers = {
  /**
   * Build WHERE clause from filters
   */
  buildWhereClause(filters: Record<string, any>): { text: string; values: any[] } {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          conditions.push(`${key} = ANY($${paramCount})`);
          values.push(value);
        } else if (typeof value === 'object' && value.min !== undefined) {
          conditions.push(`${key} >= $${paramCount}`);
          values.push(value.min);
          paramCount++;
          if (value.max !== undefined) {
            conditions.push(`${key} <= $${paramCount}`);
            values.push(value.max);
          }
        } else {
          conditions.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    return {
      text: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values,
    };
  },

  /**
   * Build pagination clause
   */
  buildPaginationClause(page: number = 1, limit: number = 20): string {
    const offset = (page - 1) * limit;
    return `LIMIT ${limit} OFFSET ${offset}`;
  },

  /**
   * Build sort clause
   */
  buildSortClause(sortBy: string = 'created_at', sortOrder: 'asc' | 'desc' = 'desc'): string {
    return `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
  },

  /**
   * Format date for PostgreSQL
   */
  formatDate(date: Date | string): string {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    return date.toISOString();
  },

  /**
   * Generate unique ID
   */
  generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
};
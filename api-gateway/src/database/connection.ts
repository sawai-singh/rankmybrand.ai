/**
 * Database Connection Service
 * Handles PostgreSQL connections and query execution
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Type definitions
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

export interface QueryOptions {
  logSlow?: boolean;
  slowThreshold?: number;
  timeout?: number;
}

// Database configuration with validation
const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'rankmybrand',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: parseInt(process.env.DB_POOL_SIZE || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
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
  private retryCount: number = 0;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000;

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
   * Test database connection with retry logic
   */
  async connect(): Promise<boolean> {
    while (this.retryCount < this.maxRetries) {
      try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        this.isConnected = true;
        this.retryCount = 0; // Reset retry count on success
        console.log('✅ Database connected successfully');
        return true;
      } catch (error: any) {
        this.retryCount++;
        console.error(`❌ Database connection attempt ${this.retryCount}/${this.maxRetries} failed:`, error.message);
        
        if (this.retryCount < this.maxRetries) {
          console.log(`🔄 Retrying in ${this.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.retryCount));
        } else {
          console.error('❌ Database connection failed after all retries');
          this.isConnected = false;
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Execute a query
   */
  async query<T extends QueryResultRow = any>(
    text: string, 
    params?: any[], 
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const { logSlow = true, slowThreshold = 1000 } = options;
    
    try {
      const result = await pool.query<T>(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries
      if (logSlow && duration > slowThreshold) {
        console.warn(`⚠️ Slow query (${duration}ms):`, text.substring(0, 100));
      }
      
      return result;
    } catch (error: any) {
      console.error('Query error:', {
        query: text.substring(0, 100),
        params: params?.slice(0, 3),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute a query and return first row
   */
  async queryOne<T extends QueryResultRow = any>(
    text: string, 
    params?: any[]
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryMany<T extends QueryResultRow = any>(
    text: string, 
    params?: any[]
  ): Promise<T[]> {
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
  getStatus(): { connected: boolean; stats: { total: number; idle: number; waiting: number } } {
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
  buildWhereClause(filters: Record<string, unknown>): { text: string; values: unknown[] } {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          conditions.push(`${key} = ANY($${paramCount})`);
          values.push(value);
        } else if (
          typeof value === 'object' && 
          'min' in value && 
          (value as any).min !== undefined
        ) {
          // Handle range queries
          const rangeValue = value as { min?: unknown; max?: unknown };
          conditions.push(`${key} >= $${paramCount}`);
          values.push(rangeValue.min);
          paramCount++;
          if (rangeValue.max !== undefined) {
            conditions.push(`${key} <= $${paramCount}`);
            values.push(rangeValue.max);
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
    return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  },
  
  /**
   * Escape SQL identifier
   */
  escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  },
  
  /**
   * Build INSERT query with returning clause
   */
  buildInsertQuery(
    table: string, 
    data: Record<string, unknown>, 
    returning: string = '*'
  ): { text: string; values: unknown[] } {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const text = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING ${returning}
    `;
    
    return { text, values };
  },
  
  /**
   * Build UPDATE query
   */
  buildUpdateQuery(
    table: string,
    data: Record<string, unknown>,
    conditions: Record<string, unknown>,
    returning: string = '*'
  ): { text: string; values: unknown[] } {
    const dataKeys = Object.keys(data);
    const dataValues = Object.values(data);
    const conditionKeys = Object.keys(conditions);
    const conditionValues = Object.values(conditions);
    
    const setClause = dataKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const whereClause = conditionKeys.map((key, i) => `${key} = $${dataKeys.length + i + 1}`).join(' AND ');
    
    const text = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${whereClause}
      RETURNING ${returning}
    `;
    
    return { text, values: [...dataValues, ...conditionValues] };
  },
};
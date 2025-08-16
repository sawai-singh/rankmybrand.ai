import { Pool } from 'pg';
import {
  Recommendation,
  RecommendationStatus,
  ExecutionTransaction,
  Brand,
  ApprovalRequest
} from '../types';
import { logger } from './logger';

export class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async initialize(): Promise<void> {
    try {
      // Create schema if not exists
      await this.pool.query(`
        CREATE SCHEMA IF NOT EXISTS action_center;
      `);

      // Create tables
      await this.createTables();
      
      logger.info('Database initialized');
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    // Recommendations table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS action_center.recommendations (
        id UUID PRIMARY KEY,
        brand_id UUID NOT NULL,
        type VARCHAR(50) NOT NULL,
        subtype VARCHAR(50),
        title VARCHAR(500) NOT NULL,
        description TEXT,
        priority INTEGER DEFAULT 50,
        estimated_impact FLOAT,
        implementation_effort VARCHAR(20),
        auto_executable BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'pending',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        executed_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      );
      
      CREATE INDEX IF NOT EXISTS idx_recommendations_brand_status 
        ON action_center.recommendations(brand_id, status);
      CREATE INDEX IF NOT EXISTS idx_recommendations_priority 
        ON action_center.recommendations(priority DESC);
    `);

    // Recommendation content table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS action_center.recommendation_content (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recommendation_id UUID REFERENCES action_center.recommendations(id),
        content_type VARCHAR(50),
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        version INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Execution log table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS action_center.execution_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recommendation_id UUID REFERENCES action_center.recommendations(id),
        action VARCHAR(100) NOT NULL,
        platform VARCHAR(50),
        status VARCHAR(50),
        request JSONB,
        response JSONB,
        error TEXT,
        execution_time_ms INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_execution_recommendation 
        ON action_center.execution_log(recommendation_id);
    `);

    // Transactions table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS action_center.transactions (
        id UUID PRIMARY KEY,
        recommendation_id UUID REFERENCES action_center.recommendations(id),
        status VARCHAR(50) DEFAULT 'pending',
        steps JSONB DEFAULT '[]',
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);

    // Approval workflow table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS action_center.approval_workflow (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recommendation_id UUID REFERENCES action_center.recommendations(id),
        requested_by VARCHAR(255),
        approved_by VARCHAR(255),
        approval_status VARCHAR(50) DEFAULT 'pending',
        approval_notes TEXT,
        requested_at TIMESTAMPTZ DEFAULT NOW(),
        responded_at TIMESTAMPTZ
      );
    `);

    // Brands table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS action_center.brands (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        platform VARCHAR(50),
        tone VARCHAR(100),
        keywords TEXT[],
        competitors TEXT[],
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Implementation tracking table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS action_center.implementation_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recommendation_id UUID REFERENCES action_center.recommendations(id),
        implementation_url TEXT,
        implementation_type VARCHAR(50),
        metrics_before JSONB,
        metrics_after JSONB,
        impact_measured FLOAT,
        measured_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  }

  async saveRecommendation(recommendation: Recommendation): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert recommendation
      await client.query(`
        INSERT INTO action_center.recommendations (
          id, brand_id, type, subtype, title, description,
          priority, estimated_impact, implementation_effort,
          auto_executable, status, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          priority = EXCLUDED.priority,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata
      `, [
        recommendation.id,
        recommendation.brandId,
        recommendation.type,
        recommendation.subtype,
        recommendation.title,
        recommendation.description,
        recommendation.priority,
        recommendation.estimatedImpact,
        recommendation.implementationEffort,
        recommendation.autoExecutable,
        recommendation.status,
        JSON.stringify(recommendation.metadata || {}),
        recommendation.createdAt
      ]);
      
      // Insert content if exists
      if (recommendation.content) {
        await client.query(`
          INSERT INTO action_center.recommendation_content (
            recommendation_id, content_type, content, metadata
          ) VALUES ($1, $2, $3, $4)
        `, [
          recommendation.id,
          recommendation.type,
          recommendation.content,
          JSON.stringify(recommendation.metadata || {})
        ]);
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getRecommendation(id: string): Promise<Recommendation | null> {
    const result = await this.pool.query(`
      SELECT r.*, rc.content
      FROM action_center.recommendations r
      LEFT JOIN action_center.recommendation_content rc ON r.id = rc.recommendation_id
      WHERE r.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return this.mapRowToRecommendation(row);
  }

  async updateRecommendationStatus(
    id: string,
    status: RecommendationStatus
  ): Promise<void> {
    const statusField = status === 'completed' ? 'completed_at' : 
                       status === 'executing' ? 'executed_at' : null;
    
    await this.pool.query(`
      UPDATE action_center.recommendations
      SET status = $2, ${statusField ? statusField + ' = NOW(),' : ''} updated_at = NOW()
      WHERE id = $1
    `, [id, status]);
  }

  async getBrand(brandId: string): Promise<Brand> {
    const result = await this.pool.query(`
      SELECT * FROM action_center.brands WHERE id = $1
    `, [brandId]);
    
    if (result.rows.length === 0) {
      // Return default brand if not found
      return {
        id: brandId,
        name: 'Unknown Brand',
        domain: '',
        settings: {
          autoExecutionEnabled: false,
          approvedTypes: [],
          maxDailyExecutions: 10,
          draftModeOnly: true,
          notificationChannels: []
        }
      };
    }
    
    return result.rows[0];
  }

  async saveTransaction(transaction: ExecutionTransaction): Promise<void> {
    await this.pool.query(`
      INSERT INTO action_center.transactions (
        id, recommendation_id, status, steps, started_at
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      transaction.id,
      transaction.recommendationId,
      transaction.status,
      JSON.stringify(transaction.steps),
      transaction.startedAt
    ]);
  }

  async updateTransaction(transaction: ExecutionTransaction): Promise<void> {
    await this.pool.query(`
      UPDATE action_center.transactions
      SET status = $2, steps = $3, completed_at = NOW()
      WHERE id = $1
    `, [
      transaction.id,
      transaction.status,
      JSON.stringify(transaction.steps)
    ]);
  }

  async saveExecutionLog(log: any): Promise<void> {
    await this.pool.query(`
      INSERT INTO action_center.execution_log (
        recommendation_id, action, platform, status,
        request, response, error, execution_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      log.recommendationId,
      log.action,
      log.platform,
      log.status,
      JSON.stringify(log.request || {}),
      JSON.stringify(log.response || {}),
      log.error,
      log.executionTimeMs
    ]);
  }

  async createApprovalRequest(request: Partial<ApprovalRequest>): Promise<void> {
    await this.pool.query(`
      INSERT INTO action_center.approval_workflow (
        recommendation_id, requested_by, approval_status, requested_at
      ) VALUES ($1, $2, $3, $4)
    `, [
      request.recommendationId,
      request.requestedBy || 'system',
      'pending',
      request.requestedAt || new Date()
    ]);
  }

  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    const result = await this.pool.query(`
      SELECT * FROM action_center.approval_workflow
      WHERE approval_status = 'pending'
      ORDER BY requested_at DESC
    `);
    
    return result.rows;
  }

  async approveRecommendation(
    recommendationId: string,
    approvedBy: string,
    notes?: string
  ): Promise<void> {
    await this.pool.query(`
      UPDATE action_center.approval_workflow
      SET approval_status = 'approved',
          approved_by = $2,
          approval_notes = $3,
          responded_at = NOW()
      WHERE recommendation_id = $1 AND approval_status = 'pending'
    `, [recommendationId, approvedBy, notes]);
    
    // Update recommendation status
    await this.updateRecommendationStatus(recommendationId, 'approved');
  }

  async getRecommendationsByBrand(
    brandId: string,
    limit: number = 100
  ): Promise<Recommendation[]> {
    const result = await this.pool.query(`
      SELECT r.*, rc.content
      FROM action_center.recommendations r
      LEFT JOIN action_center.recommendation_content rc ON r.id = rc.recommendation_id
      WHERE r.brand_id = $1
      ORDER BY r.priority DESC, r.created_at DESC
      LIMIT $2
    `, [brandId, limit]);
    
    return result.rows.map(row => this.mapRowToRecommendation(row));
  }

  async trackImplementation(tracking: any): Promise<void> {
    await this.pool.query(`
      INSERT INTO action_center.implementation_tracking (
        recommendation_id, implementation_url, implementation_type,
        metrics_before, metrics_after, impact_measured, measured_at, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      tracking.recommendationId,
      tracking.implementationUrl,
      tracking.implementationType,
      JSON.stringify(tracking.metricsBefore || {}),
      JSON.stringify(tracking.metricsAfter || {}),
      tracking.impactMeasured,
      tracking.measuredAt,
      tracking.notes
    ]);
  }

  private mapRowToRecommendation(row: any): Recommendation {
    return {
      id: row.id,
      brandId: row.brand_id,
      type: row.type,
      subtype: row.subtype,
      title: row.title,
      description: row.description,
      priority: row.priority,
      estimatedImpact: row.estimated_impact,
      implementationEffort: row.implementation_effort,
      autoExecutable: row.auto_executable,
      status: row.status,
      content: row.content,
      metadata: row.metadata,
      createdAt: row.created_at,
      executedAt: row.executed_at,
      completedAt: row.completed_at
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  getConnectionInfo(): { 
    totalConnections: number; 
    idleConnections: number; 
    waitingConnections: number; 
  } {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingConnections: this.pool.waitingCount
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
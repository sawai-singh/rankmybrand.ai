/**
 * Webhook Service
 * Handles webhook notifications for GEO/SOV updates and audit completions
 */

import axios from 'axios';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import Redis from 'ioredis';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
  metadata?: any;
}

interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  events: string[];
  active: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export class WebhookService {
  private redis: Redis;
  private webhookConfigs: Map<string, WebhookConfig> = new Map();

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      password: process.env.REDIS_PASSWORD
    });
    this.loadWebhookConfigs();
  }

  /**
   * Load webhook configurations from database
   */
  private async loadWebhookConfigs(): Promise<void> {
    try {
      // Check if webhooks table exists
      const tableExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'webhook_configs'
        );
      `);

      if (!tableExists.rows[0]?.exists) {
        // Create webhook configs table if it doesn't exist
        await this.createWebhookTable();
      }

      // Load active webhook configurations
      const result = await db.query(`
        SELECT * FROM webhook_configs WHERE active = true
      `);

      for (const config of result.rows) {
        this.webhookConfigs.set(config.id, {
          url: config.url,
          headers: config.headers,
          events: config.events,
          active: config.active,
          retryAttempts: config.retry_attempts || 3,
          retryDelay: config.retry_delay || 1000
        });
      }

      logger.info(`Loaded ${this.webhookConfigs.size} active webhook configurations`);
    } catch (error) {
      logger.error('Error loading webhook configs:', error);
    }
  }

  /**
   * Create webhook configurations table
   */
  private async createWebhookTable(): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS webhook_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        headers JSONB DEFAULT '{}',
        events TEXT[] NOT NULL,
        active BOOLEAN DEFAULT true,
        retry_attempts INTEGER DEFAULT 3,
        retry_delay INTEGER DEFAULT 1000,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS webhook_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_id UUID REFERENCES webhook_configs(id) ON DELETE CASCADE,
        event VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        status_code INTEGER,
        response_body TEXT,
        error_message TEXT,
        attempts INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON webhook_logs(event);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
    `);

    // Insert default webhook if WEBHOOK_URL is configured
    if (process.env.WEBHOOK_URL) {
      await db.query(`
        INSERT INTO webhook_configs (name, url, headers, events)
        VALUES ('Default Webhook', $1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [
        process.env.WEBHOOK_URL,
        process.env.WEBHOOK_HEADERS ? JSON.parse(process.env.WEBHOOK_HEADERS) : {},
        ['audit.completed', 'scores.updated', 'scores.significant_change']
      ]);
    }
  }

  /**
   * Send webhook for audit completion with GEO/SOV scores
   */
  async sendAuditCompletedWebhook(auditData: {
    auditId: string;
    companyId: number;
    companyName: string;
    domain: string;
    geoScore: number;
    sovScore: number;
    overallScore: number;
    scoreBreakdown?: any;
    providerMetrics?: any;
    completedAt: Date;
  }): Promise<void> {
    const payload: WebhookPayload = {
      event: 'audit.completed',
      timestamp: new Date().toISOString(),
      data: {
        auditId: auditData.auditId,
        company: {
          id: auditData.companyId,
          name: auditData.companyName,
          domain: auditData.domain
        },
        scores: {
          geo: auditData.geoScore,
          sov: auditData.sovScore,
          overall: auditData.overallScore,
          breakdown: auditData.scoreBreakdown
        },
        providerMetrics: auditData.providerMetrics,
        completedAt: auditData.completedAt
      },
      metadata: {
        version: '2.0', // Version 2.0 includes GEO/SOV
        timestamp: Date.now()
      }
    };

    await this.sendWebhooks('audit.completed', payload);

    // Log audit completion event
    await this.logAuditEvent(auditData.auditId, 'completed', payload);
  }

  /**
   * Send webhook for significant score changes
   */
  async sendScoreChangeWebhook(changeData: {
    companyId: number;
    companyName: string;
    previousScores: {
      geo: number;
      sov: number;
      overall: number;
    };
    newScores: {
      geo: number;
      sov: number;
      overall: number;
    };
    changePercentages: {
      geo: number;
      sov: number;
      overall: number;
    };
    threshold: number;
  }): Promise<void> {
    // Only send if change exceeds threshold
    const significantChange = 
      Math.abs(changeData.changePercentages.geo) > changeData.threshold ||
      Math.abs(changeData.changePercentages.sov) > changeData.threshold ||
      Math.abs(changeData.changePercentages.overall) > changeData.threshold;

    if (!significantChange) {
      return;
    }

    const payload: WebhookPayload = {
      event: 'scores.significant_change',
      timestamp: new Date().toISOString(),
      data: {
        company: {
          id: changeData.companyId,
          name: changeData.companyName
        },
        previousScores: changeData.previousScores,
        newScores: changeData.newScores,
        changes: {
          geo: {
            absolute: changeData.newScores.geo - changeData.previousScores.geo,
            percentage: changeData.changePercentages.geo
          },
          sov: {
            absolute: changeData.newScores.sov - changeData.previousScores.sov,
            percentage: changeData.changePercentages.sov
          },
          overall: {
            absolute: changeData.newScores.overall - changeData.previousScores.overall,
            percentage: changeData.changePercentages.overall
          }
        },
        threshold: changeData.threshold
      },
      metadata: {
        triggered: new Date().toISOString(),
        reason: this.getChangeReason(changeData.changePercentages)
      }
    };

    await this.sendWebhooks('scores.significant_change', payload);
  }

  /**
   * Send webhook for score updates
   */
  async sendScoreUpdateWebhook(updateData: {
    companyId: number;
    companyName: string;
    reportId: string;
    scores: {
      geo: number;
      sov: number;
      overall: number;
      contextCompleteness?: number;
    };
    providerScores?: Record<string, number>;
    timestamp: Date;
  }): Promise<void> {
    const payload: WebhookPayload = {
      event: 'scores.updated',
      timestamp: new Date().toISOString(),
      data: {
        company: {
          id: updateData.companyId,
          name: updateData.companyName
        },
        reportId: updateData.reportId,
        scores: updateData.scores,
        providerScores: updateData.providerScores,
        updatedAt: updateData.timestamp
      },
      metadata: {
        source: 'ai-visibility-analysis',
        version: '2.0'
      }
    };

    await this.sendWebhooks('scores.updated', payload);
  }

  /**
   * Send webhooks to all configured endpoints for an event
   */
  private async sendWebhooks(event: string, payload: WebhookPayload): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [id, config] of this.webhookConfigs) {
      if (config.active && config.events.includes(event)) {
        promises.push(this.sendWebhook(id, config, payload));
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send a webhook with retry logic
   */
  private async sendWebhook(
    webhookId: string,
    config: WebhookConfig,
    payload: WebhookPayload,
    attempt: number = 1
  ): Promise<void> {
    try {
      const response = await axios.post(config.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': payload.event,
          'X-Webhook-Timestamp': payload.timestamp,
          ...config.headers
        },
        timeout: 10000 // 10 second timeout
      });

      // Log successful webhook
      await this.logWebhook(webhookId, payload.event, payload, response.status, response.data);
      
      logger.info(`Webhook sent successfully: ${payload.event} to ${config.url}`);
    } catch (error: any) {
      const errorMessage = error.response?.data || error.message;
      
      // Log failed attempt
      await this.logWebhook(
        webhookId,
        payload.event,
        payload,
        error.response?.status || 0,
        null,
        errorMessage,
        attempt
      );

      // Retry if attempts remaining
      if (attempt < (config.retryAttempts || 3)) {
        const delay = (config.retryDelay || 1000) * attempt;
        logger.warn(`Webhook failed, retrying in ${delay}ms (attempt ${attempt + 1})`);
        
        setTimeout(() => {
          this.sendWebhook(webhookId, config, payload, attempt + 1);
        }, delay);
      } else {
        logger.error(`Webhook failed after ${attempt} attempts: ${errorMessage}`);
      }
    }
  }

  /**
   * Log webhook execution
   */
  private async logWebhook(
    webhookId: string,
    event: string,
    payload: any,
    statusCode: number,
    responseBody: any = null,
    errorMessage: string = '',
    attempts: number = 1
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO webhook_logs (
          webhook_id, event, payload, status_code, 
          response_body, error_message, attempts
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        webhookId,
        event,
        JSON.stringify(payload),
        statusCode,
        responseBody ? JSON.stringify(responseBody) : null,
        errorMessage,
        attempts
      ]);
    } catch (error) {
      logger.error('Error logging webhook:', error);
    }
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(auditId: string, event: string, data: any): Promise<void> {
    try {
      // Store in Redis for quick access
      const key = `audit:events:${auditId}`;
      await this.redis.rpush(key, JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data
      }));
      await this.redis.expire(key, 86400); // Expire after 24 hours
    } catch (error) {
      logger.error('Error logging audit event:', error);
    }
  }

  /**
   * Get reason for score change
   */
  private getChangeReason(changePercentages: {
    geo: number;
    sov: number;
    overall: number;
  }): string {
    const reasons: string[] = [];

    if (Math.abs(changePercentages.geo) > 10) {
      reasons.push(`GEO score ${changePercentages.geo > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePercentages.geo).toFixed(1)}%`);
    }

    if (Math.abs(changePercentages.sov) > 10) {
      reasons.push(`SOV score ${changePercentages.sov > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePercentages.sov).toFixed(1)}%`);
    }

    if (Math.abs(changePercentages.overall) > 10) {
      reasons.push(`Overall score ${changePercentages.overall > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePercentages.overall).toFixed(1)}%`);
    }

    return reasons.join(', ') || 'Score change detected';
  }

  /**
   * Register a new webhook configuration
   */
  async registerWebhook(config: {
    name: string;
    url: string;
    headers?: Record<string, string>;
    events: string[];
  }): Promise<string> {
    const result = await db.query(`
      INSERT INTO webhook_configs (name, url, headers, events)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [config.name, config.url, config.headers || {}, config.events]);

    const webhookId = result.rows[0].id;
    
    // Add to active configs
    this.webhookConfigs.set(webhookId, {
      url: config.url,
      headers: config.headers,
      events: config.events,
      active: true
    });

    logger.info(`Registered new webhook: ${config.name}`);
    return webhookId;
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(): Promise<any> {
    const stats = await db.query(`
      SELECT 
        wc.name,
        wc.url,
        COUNT(wl.id) as total_calls,
        COUNT(CASE WHEN wl.status_code BETWEEN 200 AND 299 THEN 1 END) as successful_calls,
        COUNT(CASE WHEN wl.status_code >= 400 OR wl.status_code = 0 THEN 1 END) as failed_calls,
        AVG(CASE WHEN wl.status_code BETWEEN 200 AND 299 THEN wl.attempts END) as avg_attempts,
        MAX(wl.created_at) as last_called
      FROM webhook_configs wc
      LEFT JOIN webhook_logs wl ON wc.id = wl.webhook_id
      WHERE wc.active = true
      GROUP BY wc.id, wc.name, wc.url
      ORDER BY total_calls DESC
    `);

    return stats.rows;
  }
}

// Export singleton instance
export const webhookService = new WebhookService();
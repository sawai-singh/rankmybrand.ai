import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../database/connection';
import { authenticate } from '../middleware/auth';
// import { rateLimiter } from '../middleware/rate-limiter'; // Temporarily disabled due to Redis compatibility issue
import { validateRequest } from '../middleware/validate-request';
import { asyncHandler } from '../utils/async-handler';
import { ApiError } from '../utils/api-error';
import { logger } from '../utils/logger';
import { webhookService } from '../services/webhook.service';
import Bull from 'bull';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const router = Router();

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  reconnectOnError: (err) => {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    if (targetErrors.some(e => err.message.includes(e))) {
      return true;
    }
    return false;
  },
});

// Initialize Bull queue for background processing
const auditQueue = new Bull('ai-visibility-audit', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// =====================================================
// Zod Schemas for Request Validation
// =====================================================

const StartAuditSchema = z.object({
  body: z.object({
    companyId: z.number().int().positive().optional(),
    queryCount: z.number().int().min(10).max(100).default(50),
    providers: z.array(z.enum(['openai', 'anthropic', 'google', 'perplexity']))
      .min(1)
      .default(['openai', 'anthropic', 'google', 'perplexity']),
    config: z.object({
      includeCompetitors: z.boolean().default(true),
      deepAnalysis: z.boolean().default(true),
      generateInsights: z.boolean().default(true),
      prewarmCache: z.boolean().default(false),
    }).optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

const GetAuditSchema = z.object({
  params: z.object({
    auditId: z.string().uuid(),
  }),
  query: z.object({
    includeDetails: z.enum(['full', 'summary', 'minimal']).default('summary'),
  }),
});

const QueryAnalysisSchema = z.object({
  body: z.object({
    query: z.string().min(3).max(500),
    providers: z.array(z.enum(['openai', 'anthropic', 'google', 'perplexity'])).optional(),
    useCache: z.boolean().default(true),
  }),
});

const CompareAuditsSchema = z.object({
  body: z.object({
    baselineAuditId: z.string().uuid(),
    comparisonAuditId: z.string().uuid(),
  }),
});

const ExportAuditSchema = z.object({
  params: z.object({
    auditId: z.string().uuid(),
  }),
  query: z.object({
    format: z.enum(['pdf', 'csv', 'json']).default('pdf'),
    includeCharts: z.boolean().default(true),
    emailTo: z.string().email().optional(),
  }),
});

// =====================================================
// Idempotency Middleware
// =====================================================

const idempotencyMiddleware = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  if (!idempotencyKey) {
    return next();
  }

  const cacheKey = `idempotency:${idempotencyKey}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    const result = JSON.parse(cached);
    logger.info(`Idempotent request served from cache: ${idempotencyKey}`);
    return res.status(result.status).json(result.body);
  }

  // Store original send function
  const originalSend = res.json.bind(res);
  
  // Override json method to cache response
  res.json = function(body: any) {
    const status = res.statusCode;
    
    // Cache successful responses only
    if (status >= 200 && status < 300) {
      redis.setex(
        cacheKey,
        3600, // 1 hour TTL
        JSON.stringify({ status, body })
      ).catch(err => {
        logger.error('Failed to cache idempotent response:', err);
      });
    }
    
    return originalSend(body);
  };

  next();
});

// =====================================================
// Error Handler Wrapper
// =====================================================

class AuditError extends ApiError {
  constructor(message: string, statusCode: number = 500, details?: any) {
    super(message, statusCode);
    this.details = details;
  }
  
  details?: any;
}

const handleAuditError = (error: any, req: Request, res: Response) => {
  logger.error('Audit API Error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    user: (req as any).user?.id,
  });

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.errors,
    });
  }

  if (error instanceof AuditError) {
    return res.status(error.statusCode).json({
      error: error.message,
      details: error.details,
    });
  }

  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Unable to connect to required services',
    });
  }

  if (error.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      error: 'Conflict',
      message: 'Resource already exists',
    });
  }

  return res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : error.message,
  });
};

// =====================================================
// API Endpoints
// =====================================================

/**
 * Start a new AI Visibility Audit
 */
router.post(
  '/audit/start',
  authenticate,
  // rateLimiter({ windowMs: 60000, max: 10 }), // Temporarily disabled
  idempotencyMiddleware,
  validateRequest(StartAuditSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId, queryCount, providers, config, metadata } = req.body;
    const userId = (req as any).user.id;

    // Validate company ownership
    if (companyId) {
      const company = await db.query(
        'SELECT id FROM companies WHERE id = $1 AND user_id = $2',
        [companyId, userId]
      );
      
      if (!company.rows[0]) {
        throw new AuditError('Company not found or unauthorized', 404);
      }
    }

    // Check for running audits
    const runningAudit = await db.query(
      `SELECT id FROM ai_visibility_audits 
       WHERE company_id = $1 AND status IN ('pending', 'processing')
       ORDER BY created_at DESC LIMIT 1`,
      [companyId]
    );

    if (runningAudit.rows[0]) {
      throw new AuditError('An audit is already in progress', 409, {
        auditId: runningAudit.rows[0].id,
      });
    }

    // Create audit record
    const auditId = uuidv4();
    const audit = await db.query(
      `INSERT INTO ai_visibility_audits 
       (id, company_id, user_id, status, query_count, providers, config, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        auditId,
        companyId,
        userId,
        'pending',
        queryCount,
        providers,
        JSON.stringify(config || {}),
        JSON.stringify(metadata || {}),
      ]
    );

    // Queue audit for processing
    const job = await auditQueue.add('process-audit', {
      auditId,
      companyId,
      userId,
      queryCount,
      providers,
      config,
    }, {
      jobId: auditId,
      priority: config?.priority || 0,
    });

    // Notify via WebSocket
    redis.publish('audit-events', JSON.stringify({
      event: 'audit.started',
      auditId,
      userId,
      timestamp: new Date().toISOString(),
    }));

    res.status(202).json({
      message: 'Audit queued for processing',
      auditId: audit.rows[0].id,
      status: 'pending',
      estimatedTime: queryCount * providers.length * 2, // seconds
      jobId: job.id,
    });
  })
);

/**
 * Get audit status and results
 */
router.get(
  '/audit/:auditId',
  authenticate,
  // rateLimiter({ windowMs: 60000, max: 100 }), // Temporarily disabled
  validateRequest(GetAuditSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { auditId } = req.params;
    const { includeDetails } = req.query;
    const userId = (req as any).user.id;

    // Check cache first
    const cacheKey = `audit:${auditId}:${includeDetails}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Fetch audit with access control
    const auditQuery = `
      SELECT 
        a.*,
        c.name as company_name,
        COUNT(DISTINCT q.id) as total_queries,
        COUNT(DISTINCT r.id) as total_responses,
        AVG(r.response_time_ms) as avg_response_time,
        json_agg(DISTINCT s.*) as scores
      FROM ai_visibility_audits a
      LEFT JOIN companies c ON c.id = a.company_id
      LEFT JOIN audit_queries q ON q.audit_id = a.id
      LEFT JOIN audit_responses r ON r.query_id = q.id
      LEFT JOIN audit_scores s ON s.audit_id = a.id
      WHERE a.id = $1 AND a.user_id = $2
      GROUP BY a.id, c.name
    `;

    const audit = await db.query(auditQuery, [auditId, userId]);

    if (!audit.rows[0]) {
      throw new AuditError('Audit not found', 404);
    }

    let response = audit.rows[0];

    // Add details based on level
    if (includeDetails === 'full') {
      const queries = await db.query(
        `SELECT q.*, 
          json_agg(
            json_build_object(
              'provider', r.provider,
              'brand_mentioned', r.brand_mentioned,
              'sentiment', r.sentiment,
              'response_time_ms', r.response_time_ms
            )
          ) as responses
         FROM audit_queries q
         LEFT JOIN audit_responses r ON r.query_id = q.id
         WHERE q.audit_id = $1
         GROUP BY q.id
         ORDER BY q.priority_score DESC
         LIMIT 100`,
        [auditId]
      );
      
      response.queries = queries.rows;
    }

    // Cache successful responses
    if (response.status === 'completed') {
      await redis.setex(cacheKey, 300, JSON.stringify(response)); // 5 min cache
    }

    res.json(response);
  })
);

/**
 * Get current audit for company
 */
router.get(
  '/audit/current/:companyId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const userId = (req as any).user.id;

    const audit = await db.query(
      `SELECT a.*, 
        json_build_object(
          'visibility', COALESCE(MAX(s.score) FILTER (WHERE s.metric_name = 'brand_visibility'), 0),
          'sentiment', COALESCE(MAX(s.score) FILTER (WHERE s.metric_name = 'sentiment_score'), 0),
          'recommendation', COALESCE(MAX(s.score) FILTER (WHERE s.metric_name = 'recommendation_score'), 0),
          'seo', COALESCE(MAX(s.score) FILTER (WHERE s.metric_name = 'seo_optimization'), 0)
        ) as scores
       FROM ai_visibility_audits a
       LEFT JOIN audit_scores s ON s.audit_id = a.id
       WHERE a.company_id = $1 AND a.user_id = $2 AND a.status = 'completed'
       GROUP BY a.id
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [companyId, userId]
    );

    if (!audit.rows[0]) {
      return res.status(404).json({ message: 'No completed audits found' });
    }

    res.json(audit.rows[0]);
  })
);

/**
 * Test a single query across providers
 */
router.post(
  '/audit/query/test',
  authenticate,
  // rateLimiter({ windowMs: 60000, max: 30 }), // Temporarily disabled
  validateRequest(QueryAnalysisSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { query, providers, useCache } = req.body;
    
    // Generate request hash for caching
    const queryHash = crypto
      .createHash('sha256')
      .update(query + JSON.stringify(providers))
      .digest('hex');
    
    if (useCache) {
      const cached = await redis.get(`query:test:${queryHash}`);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    // Queue for processing
    const job = await auditQueue.add('test-query', {
      query,
      providers: providers || ['openai'],
      userId: (req as any).user.id,
    }, {
      priority: 10, // High priority for test queries
    });

    const result = await job.finished();

    // Cache result
    if (useCache) {
      await redis.setex(`query:test:${queryHash}`, 3600, JSON.stringify(result));
    }

    res.json(result);
  })
);

/**
 * Compare two audits
 */
router.post(
  '/audit/compare',
  authenticate,
  validateRequest(CompareAuditsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { baselineAuditId, comparisonAuditId } = req.body;
    const userId = (req as any).user.id;

    // Verify ownership of both audits
    const audits = await db.query(
      'SELECT id, overall_score, brand_mention_rate FROM ai_visibility_audits WHERE id = ANY($1) AND user_id = $2',
      [[baselineAuditId, comparisonAuditId], userId]
    );

    if (audits.rows.length !== 2) {
      throw new AuditError('One or both audits not found', 404);
    }

    const baseline = audits.rows.find(a => a.id === baselineAuditId);
    const comparison = audits.rows.find(a => a.id === comparisonAuditId);

    // Calculate changes
    const changes = {
      scoreChange: comparison.overall_score - baseline.overall_score,
      mentionRateChange: comparison.brand_mention_rate - baseline.brand_mention_rate,
      improvements: [],
      regressions: [],
    };

    // Store comparison
    await db.query(
      `INSERT INTO audit_comparisons 
       (company_id, baseline_audit_id, comparison_audit_id, score_change, mention_rate_change)
       VALUES ((SELECT company_id FROM ai_visibility_audits WHERE id = $1), $1, $2, $3, $4)
       ON CONFLICT (baseline_audit_id, comparison_audit_id) 
       DO UPDATE SET score_change = $3, mention_rate_change = $4`,
      [baselineAuditId, comparisonAuditId, changes.scoreChange, changes.mentionRateChange]
    );

    res.json({
      baseline,
      comparison,
      changes,
    });
  })
);

/**
 * Export audit report
 */
router.get(
  '/audit/:auditId/export',
  authenticate,
  validateRequest(ExportAuditSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { auditId } = req.params;
    const { format, includeCharts, emailTo } = req.query;
    const userId = (req as any).user.id;

    // Verify ownership
    const audit = await db.query(
      'SELECT * FROM ai_visibility_audits WHERE id = $1 AND user_id = $2',
      [auditId, userId]
    );

    if (!audit.rows[0]) {
      throw new AuditError('Audit not found', 404);
    }

    // Queue export job
    const job = await auditQueue.add('export-audit', {
      auditId,
      format,
      includeCharts,
      emailTo,
      userId,
    });

    if (emailTo) {
      res.json({
        message: 'Export queued. Report will be emailed when ready.',
        jobId: job.id,
      });
    } else {
      // Wait for export to complete for direct download
      const result = await job.finished();
      
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="audit-${auditId}.${format}"`);
      res.send(result.data);
    }
  })
);

/**
 * Get audit insights
 */
router.get(
  '/audit/:auditId/insights',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { auditId } = req.params;
    const userId = (req as any).user.id;

    const insights = await db.query(
      `WITH response_analysis AS (
        SELECT 
          COUNT(*) FILTER (WHERE r.brand_mentioned = true) as mentions,
          COUNT(*) as total,
          AVG(CASE 
            WHEN r.sentiment = 'strongly_positive' THEN 5
            WHEN r.sentiment = 'positive' THEN 4
            WHEN r.sentiment = 'neutral' THEN 3
            WHEN r.sentiment = 'negative' THEN 2
            WHEN r.sentiment = 'strongly_negative' THEN 1
          END) as avg_sentiment,
          json_agg(DISTINCT r.competitors_mentioned) as all_competitors
        FROM audit_queries q
        JOIN audit_responses r ON r.query_id = q.id
        WHERE q.audit_id = $1
      )
      SELECT 
        json_build_object(
          'topInsights', ARRAY[
            CASE WHEN mentions < total * 0.3 
              THEN 'Low brand visibility - appearing in less than 30% of responses'
              ELSE NULL 
            END,
            CASE WHEN avg_sentiment < 3 
              THEN 'Negative sentiment detected across AI responses'
              ELSE NULL 
            END
          ],
          'opportunities', ARRAY[
            'Increase content marketing to improve AI training data',
            'Optimize for featured snippets and structured data'
          ],
          'threats', all_competitors
        ) as insights
      FROM response_analysis`,
      [auditId]
    );

    res.json(insights.rows[0]?.insights || {});
  })
);

/**
 * Get provider health status
 */
router.get(
  '/providers/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await redis.get('provider:health:status');
    
    if (!health) {
      // Fetch from database
      const status = await db.query(
        `SELECT 
          provider,
          AVG(response_time_ms) as avg_response_time,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as recent_requests,
          COUNT(*) FILTER (WHERE response_time_ms > 5000) as slow_requests
        FROM audit_responses
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY provider`
      );
      
      await redis.setex('provider:health:status', 60, JSON.stringify(status.rows));
      return res.json(status.rows);
    }

    res.json(JSON.parse(health));
  })
);

// =====================================================
// Error Handler
// =====================================================

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  handleAuditError(error, req, res);
});

export default router;
/**
 * System Control Routes - Comprehensive Admin Control Center
 * Real-time monitoring, management, and emergency controls
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate, routeSchemas } from '../middleware/validation.middleware.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const execAsync = promisify(exec);

// ========================================
// LLM CONFIG HELPER FUNCTIONS
// ========================================

/**
 * Get LLM configuration from database with Redis caching and fallback to .env
 */
async function getLLMConfigWithFallback(
  db: any,
  redis: any,
  useCase: string,
  fallbackEnv?: Record<string, string>
): Promise<any> {
  const cacheKey = `llm_config:${useCase}`;
  const CACHE_TTL = 300; // 5 minutes

  try {
    // Try Redis cache first
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Try database
    const result = await db.query(
      `SELECT * FROM llm_configurations
       WHERE use_case = $1 AND enabled = true
       ORDER BY priority
       LIMIT 1`,
      [useCase]
    );

    if (result.rows && result.rows.length > 0) {
      const config = result.rows[0];

      // Cache in Redis
      if (redis) {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(config));
      }

      return config;
    }

    // Fallback to environment variables
    console.warn(`[LLM Config] No database config for ${useCase}, falling back to .env`);
    const fallback = getFallbackConfig(useCase, fallbackEnv);
    return fallback;

  } catch (error) {
    console.error(`[LLM Config] Database error for ${useCase}:`, error);

    // Try cache even if DB failed
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.warn(`[LLM Config] Using stale cache for ${useCase}`);
          return JSON.parse(cached);
        }
      } catch (cacheError) {
        console.error('[LLM Config] Redis cache error:', cacheError);
      }
    }

    // Final fallback to .env
    console.warn(`[LLM Config] All sources failed for ${useCase}, using .env fallback`);
    return getFallbackConfig(useCase, fallbackEnv);
  }
}

/**
 * Get fallback configuration from environment variables
 */
function getFallbackConfig(useCase: string, envOverrides?: Record<string, string>): any {
  const env = { ...process.env, ...envOverrides };

  return {
    id: -1, // Indicates fallback config
    use_case: useCase,
    provider: env.LLM_PROVIDER || 'openai',
    model: env.OPENAI_MODEL || env.LLM_MODEL || 'gpt-4o',
    priority: 1,
    weight: 1.0,
    enabled: true,
    temperature: parseFloat(env.LLM_TEMPERATURE || '0.7'),
    max_tokens: parseInt(env.LLM_MAX_TOKENS || '4000', 10),
    timeout_ms: parseInt(env.LLM_TIMEOUT_MS || '30000', 10),
    source: 'env_fallback'
  };
}

/**
 * Invalidate Redis cache for LLM configs
 */
async function invalidateLLMConfigCache(redis: any, useCase?: string) {
  if (!redis) return;

  try {
    if (useCase) {
      await redis.del(`llm_config:${useCase}`);
    } else {
      // Invalidate all LLM config caches
      const keys = await redis.keys('llm_config:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch (error) {
    console.error('[LLM Config] Cache invalidation error:', error);
  }
}

// ========================================
// SYSTEM HEALTH MONITORING
// ========================================

/**
 * Get comprehensive system health status
 */
router.get('/health/detailed', asyncHandler(async (req: Request, res: Response) => {
  const { db, redis } = req.app.locals;
  const config = req.app.locals.config;

  const health: any = {
    timestamp: new Date().toISOString(),
    services: {},
    metrics: {}
  };

  // Database health with connection pool stats
  try {
    const dbStart = Date.now();
    await db.query('SELECT NOW()');
    const dbLatency = Date.now() - dbStart;

    const poolStats = await db.query(`
      SELECT
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);

    health.services.database = {
      status: 'healthy',
      latency_ms: dbLatency,
      connections: poolStats.rows[0]
    };
  } catch (error) {
    health.services.database = {
      status: 'unhealthy',
      error: (error as Error).message
    };
  }

  // Redis health with memory stats
  try {
    const redisStart = Date.now();
    await redis.ping();
    const redisLatency = Date.now() - redisStart;

    const info = await redis.info('memory');
    const usedMemory = info.match(/used_memory_human:(.+)/)?.[1]?.trim();

    health.services.redis = {
      status: 'healthy',
      latency_ms: redisLatency,
      memory_used: usedMemory
    };
  } catch (error) {
    health.services.redis = {
      status: 'unhealthy',
      error: (error as Error).message
    };
  }

  // Intelligence Engine health
  try {
    const response = await fetch(`${config.services.intelligence}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    health.services.intelligence_engine = {
      status: response.ok ? 'healthy' : 'unhealthy',
      url: config.services.intelligence
    };
  } catch (error) {
    health.services.intelligence_engine = {
      status: 'down',
      error: 'Connection failed'
    };
  }

  // API Gateway metrics (self)
  try {
    // SECURITY FIX: Use config port, not hardcoded
    const port = config.server?.port || 4000;
    const { stdout } = await execAsync(`lsof -ti:${port}`);
    const pidStr = stdout.trim();

    // SECURITY FIX: Validate PID before using in shell command
    const pid = parseInt(pidStr);
    if (isNaN(pid) || pid <= 0 || pid > 999999) {
      throw new Error('Invalid PID');
    }

    if (pid) {
      const { stdout: psOutput } = await execAsync(`ps -o rss,vsz -p ${pid}`);
      const parts = psOutput.trim().split(/\s+/);

      // Validate ps output
      if (parts.length >= 3) {
        const rss = parseInt(parts[1]);
        const vsz = parseInt(parts[2]);

        health.services.api_gateway = {
          status: 'healthy',
          pid: pid,
          memory_rss_mb: isNaN(rss) ? 0 : Math.round(rss / 1024),
          memory_vsz_mb: isNaN(vsz) ? 0 : Math.round(vsz / 1024)
        };
      } else {
        health.services.api_gateway = { status: 'healthy', pid: pid };
      }
    }
  } catch (error) {
    // If we're here returning a response, the API Gateway IS running
    // The error just means we couldn't detect the PID properly
    health.services.api_gateway = {
      status: 'healthy',
      note: 'Running (self-check)'
    };
  }

  res.json(health);
}));

// ========================================
// QUEUE MANAGEMENT
// ========================================

/**
 * Get queue statistics
 */
router.get('/queue/stats', asyncHandler(async (req: Request, res: Response) => {
  const { redis } = req.app.locals;

  try {
    const queueName = 'bull:ai-visibility-audit';

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      redis.llen(`${queueName}:wait`),
      redis.llen(`${queueName}:active`),
      redis.zcard(`${queueName}:completed`),
      redis.zcard(`${queueName}:failed`),
      redis.zcard(`${queueName}:delayed`)
    ]);

    res.json({
      success: true,
      queue: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get failed jobs
 */
router.get('/queue/failed', asyncHandler(async (req: Request, res: Response) => {
  const { redis } = req.app.locals;

  try {
    const queueName = 'bull:ai-visibility-audit';
    const failedJobIds = await redis.zrange(`${queueName}:failed`, 0, 99);

    const jobs = await Promise.all(
      failedJobIds.map(async (jobId: string) => {
        const jobData = await redis.hgetall(`${queueName}:${jobId}`);
        return {
          id: jobId,
          ...jobData,
          data: jobData.data ? JSON.parse(jobData.data) : null
        };
      })
    );

    res.json({
      success: true,
      failed_jobs: jobs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Retry all failed jobs
 */
router.post('/queue/retry-failed', asyncHandler(async (req: Request, res: Response) => {
  const { redis } = req.app.locals;

  try {
    const queueName = 'bull:ai-visibility-audit';
    const failedJobIds = await redis.zrange(`${queueName}:failed`, 0, -1);

    // Move failed jobs back to wait queue
    for (const jobId of failedJobIds) {
      await redis.zrem(`${queueName}:failed`, jobId);
      await redis.rpush(`${queueName}:wait`, jobId);
    }

    res.json({
      success: true,
      message: `Retried ${failedJobIds.length} failed jobs`,
      retried_count: failedJobIds.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Clear dead/stuck jobs
 */
router.post('/queue/clear-dead', asyncHandler(async (req: Request, res: Response) => {
  const { redis } = req.app.locals;

  try {
    const queueName = 'bull:ai-visibility-audit';

    // Clear completed jobs older than 1 hour
    const oneHourAgo = Date.now() - 3600000;
    const removed = await redis.zremrangebyscore(`${queueName}:completed`, 0, oneHourAgo);

    res.json({
      success: true,
      message: `Cleared ${removed} old completed jobs`,
      cleared_count: removed
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ========================================
// CACHE MANAGEMENT
// ========================================

/**
 * Get cache statistics
 */
router.get('/cache/stats', asyncHandler(async (req: Request, res: Response) => {
  const { redis } = req.app.locals;

  try {
    const info = await redis.info('stats');
    const memory = await redis.info('memory');

    const totalConnections = info.match(/total_connections_received:(\d+)/)?.[1];
    const totalCommands = info.match(/total_commands_processed:(\d+)/)?.[1];
    const usedMemory = memory.match(/used_memory_human:(.+)/)?.[1]?.trim();
    const maxMemory = memory.match(/maxmemory_human:(.+)/)?.[1]?.trim();

    res.json({
      success: true,
      stats: {
        total_connections: parseInt(totalConnections || '0'),
        total_commands: parseInt(totalCommands || '0'),
        memory_used: usedMemory,
        memory_max: maxMemory
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Clear all cache
 */
router.post('/cache/clear-all', asyncHandler(async (req: Request, res: Response) => {
  const { redis } = req.app.locals;

  try {
    await redis.flushdb();

    res.json({
      success: true,
      message: 'All cache cleared successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Clear cache by pattern
 */
router.post('/cache/clear-pattern', asyncHandler(async (req: Request, res: Response) => {
  const { redis } = req.app.locals;
  const { pattern } = req.body;

  if (!pattern) {
    return res.status(400).json({
      success: false,
      error: 'Pattern is required'
    });
  }

  // SECURITY: Prevent accidental entire cache deletion
  if (pattern === '*' || pattern === '') {
    return res.status(400).json({
      success: false,
      error: 'Use /cache/clear-all endpoint to clear entire cache. Wildcard (*) not allowed here.'
    });
  }

  try {
    // PERFORMANCE FIX: Use SCAN instead of KEYS (non-blocking)
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, foundKeys] = await redis.scan(
        cursor,
        'MATCH', pattern,
        'COUNT', 100
      );
      keys.push(...foundKeys);
      cursor = nextCursor;

      // SAFETY: Limit total keys to prevent abuse
      if (keys.length > 50000) {
        return res.status(400).json({
          success: false,
          error: `Pattern too broad (>50,000 keys). Please use a more specific pattern. Found ${keys.length} keys so far.`
        });
      }
    } while (cursor !== '0');

    // Delete in batches of 1000 to avoid blocking Redis
    let deleted = 0;
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      if (batch.length > 0) {
        await redis.del(...batch);
        deleted += batch.length;
      }
    }

    res.json({
      success: true,
      message: `Cleared ${deleted} cache keys matching pattern: ${pattern}`,
      cleared_count: deleted
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ========================================
// LOG VIEWER
// ========================================

/**
 * Get recent logs
 */
router.get('/logs/recent', asyncHandler(async (req: Request, res: Response) => {
  const { lines = 100, service = 'intelligence-engine', level } = req.query;

  try {
    // PRODUCTION FIX: Use environment variables for log paths with fallbacks
    const logFile = service === 'intelligence-engine'
      ? process.env.INTELLIGENCE_ENGINE_LOG_PATH || '/tmp/intelligence-engine.log'
      : process.env.API_GATEWAY_LOG_PATH || '/tmp/api-gateway.log';

    if (!fs.existsSync(logFile)) {
      // FALLBACK: Try to get logs from Docker/systemd if file doesn't exist
      try {
        let dockerCmd = '';
        if (service === 'intelligence-engine') {
          dockerCmd = 'docker logs rankmybrand-intelligence-engine --tail=' + lines;
        } else {
          dockerCmd = 'docker logs rankmybrand-api-gateway --tail=' + lines;
        }

        const { stdout } = await execAsync(dockerCmd);
        let logLines = stdout.split('\n').filter(line => line.trim());

        // Filter by log level if specified
        if (level) {
          const levelUpper = (level as string).toUpperCase();
          logLines = logLines.filter(line => line.includes(levelUpper));
        }

        return res.json({
          success: true,
          logs: logLines,
          total: logLines.length,
          source: 'docker'
        });
      } catch (dockerError) {
        // Docker not available, return empty logs
        return res.json({
          success: true,
          logs: [],
          message: `Log file not found: ${logFile}. Docker logs also unavailable.`,
          source: 'none'
        });
      }
    }

    const { stdout } = await execAsync(`tail -${lines} ${logFile}`);
    let logLines = stdout.split('\n').filter(line => line.trim());

    // Filter by log level if specified
    if (level) {
      const levelUpper = (level as string).toUpperCase();
      logLines = logLines.filter(line => line.includes(levelUpper));
    }

    res.json({
      success: true,
      logs: logLines,
      total: logLines.length,
      source: 'file'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ========================================
// ACTIVE AUDITS MONITORING
// ========================================

/**
 * Get active running audits
 */
router.get('/audits/active', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;

  try {
    const result = await db.query(`
      SELECT
        id,
        company_name,
        status,
        current_phase,
        phase_progress,
        phase_started_at,
        started_at,
        created_at,
        (SELECT COUNT(*) FROM audit_responses WHERE audit_id = av.id) as responses_collected,
        response_count_limit
      FROM ai_visibility_audits av
      WHERE status = 'processing'
      ORDER BY started_at DESC
    `);

    const activeAudits = result.rows.map((audit: any) => ({
      ...audit,
      running_time_seconds: audit.started_at
        ? Math.floor((Date.now() - new Date(audit.started_at).getTime()) / 1000)
        : 0,
      phase_running_time: audit.phase_started_at
        ? Math.floor((Date.now() - new Date(audit.phase_started_at).getTime()) / 1000)
        : 0
    }));

    res.json({
      success: true,
      active_audits: activeAudits,
      count: activeAudits.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Kill a specific audit (emergency stop)
 */
router.post('/audits/:auditId/kill', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;
  const { auditId } = req.params;

  try {
    await db.query(`
      UPDATE ai_visibility_audits
      SET status = 'cancelled',
          error_message = 'Killed by admin via control center',
          completed_at = NOW()
      WHERE id = $1
    `, [auditId]);

    res.json({
      success: true,
      message: `Audit ${auditId} killed successfully`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ========================================
// MAINTENANCE MODE
// ========================================

/**
 * Get maintenance mode status
 */
router.get('/maintenance/status', asyncHandler(async (req: Request, res: Response) => {
  const { redis } = req.app.locals;

  try {
    const [enabled, message] = await Promise.all([
      redis.get('system:maintenance:enabled'),
      redis.get('system:maintenance:message')
    ]);

    res.json({
      success: true,
      maintenance_mode: enabled === '1' || enabled === 'true',
      message: message || 'System is currently under maintenance. Please try again later.'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Toggle maintenance mode
 */
router.post('/maintenance/toggle', asyncHandler(async (req: Request, res: Response) => {
  const { redis } = req.app.locals;
  const { enabled, message } = req.body;

  try {
    // PERSISTENCE FIX: Store in Redis instead of memory
    await redis.set('system:maintenance:enabled', enabled ? '1' : '0');
    if (message) {
      await redis.set('system:maintenance:message', message);
    }

    // Broadcast to all services via Redis pub/sub
    await redis.publish('system:maintenance', JSON.stringify({
      enabled,
      message: message || 'System is currently under maintenance. Please try again later.',
      timestamp: new Date().toISOString()
    }));

    res.json({
      success: true,
      maintenance_mode: enabled,
      message: message || 'System is currently under maintenance. Please try again later.'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ========================================
// PERFORMANCE METRICS
// ========================================

/**
 * Get performance metrics
 */
router.get('/metrics/performance', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;

  try {
    // Average audit completion time
    const avgTime = await db.query(`
      SELECT
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds,
        COUNT(*) as completed_count
      FROM ai_visibility_audits
      WHERE status = 'completed'
        AND started_at IS NOT NULL
        AND completed_at > NOW() - INTERVAL '24 hours'
    `);

    // Queue processing rate
    const queueRate = await db.query(`
      SELECT
        COUNT(*) as audits_last_hour
      FROM ai_visibility_audits
      WHERE completed_at > NOW() - INTERVAL '1 hour'
    `);

    res.json({
      success: true,
      metrics: {
        avg_completion_time_seconds: Math.round(avgTime.rows[0]?.avg_seconds || 0),
        completed_last_24h: avgTime.rows[0]?.completed_count || 0,
        processing_rate_per_hour: queueRate.rows[0]?.audits_last_hour || 0
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ========================================
// EMERGENCY CONTROLS
// ========================================

/**
 * Kill all running audits (EMERGENCY)
 */
router.post('/emergency/kill-all-audits', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;

  try {
    const result = await db.query(`
      UPDATE ai_visibility_audits
      SET status = 'cancelled',
          error_message = 'Emergency kill - all audits stopped by admin',
          completed_at = NOW()
      WHERE status = 'processing'
      RETURNING id
    `);

    res.json({
      success: true,
      message: `Killed ${result.rows.length} running audits`,
      killed_count: result.rows.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ========================================
// INFINITE LOOP DETECTION & AUDIT REPROCESS MONITORING
// ========================================

/**
 * Get audit reprocess history (for loop detection)
 */
router.get('/audits/reprocess-history', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;
  const { audit_id, hours = 24 } = req.query;

  try {
    let query = `
      SELECT
        r.*,
        a.company_name,
        a.status as current_status,
        a.current_phase as current_phase
      FROM audit_reprocess_log r
      LEFT JOIN ai_visibility_audits a ON r.audit_id = a.id
      WHERE r.created_at > NOW() - INTERVAL '${hours} hours'
    `;

    const params: any[] = [];
    if (audit_id) {
      query += ' AND r.audit_id = $1';
      params.push(audit_id);
    }

    query += ' ORDER BY r.created_at DESC LIMIT 100';

    const result = await db.query(query, params);

    res.json({
      success: true,
      reprocess_history: result.rows,
      total: result.rows.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Detect potential infinite loops (audits reprocessed >3 times in last hour)
 */
router.get('/audits/infinite-loop-detection', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;

  try {
    const result = await db.query(`
      SELECT
        r.audit_id,
        a.company_name,
        a.status,
        a.current_phase,
        COUNT(*) as reprocess_count,
        MAX(r.created_at) as last_reprocess_at,
        MIN(r.created_at) as first_reprocess_at,
        EXTRACT(EPOCH FROM (MAX(r.created_at) - MIN(r.created_at))) / 60 as duration_minutes
      FROM audit_reprocess_log r
      JOIN ai_visibility_audits a ON r.audit_id = a.id
      WHERE r.created_at > NOW() - INTERVAL '1 hour'
      GROUP BY r.audit_id, a.company_name, a.status, a.current_phase
      HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) DESC
    `);

    const loops = result.rows.map((row: any) => ({
      ...row,
      severity: row.reprocess_count >= 5 ? 'critical' : 'warning',
      is_infinite_loop: row.reprocess_count >= 5,
      avg_reprocess_interval_minutes: row.duration_minutes / row.reprocess_count
    }));

    res.json({
      success: true,
      potential_loops: loops,
      count: loops.length,
      critical_count: loops.filter((l: any) => l.severity === 'critical').length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get stuck audits that match monitor query (for admin review)
 */
router.get('/audits/stuck-candidates', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;

  try {
    const result = await db.query(`
      SELECT
        a.id as audit_id,
        a.company_name,
        a.status,
        a.current_phase,
        a.started_at,
        a.last_heartbeat,
        a.phase_details->>'reprocess_count' as reprocess_count,
        (SELECT COUNT(*) FROM audit_responses WHERE audit_id = a.id) as responses_collected,
        (SELECT COUNT(*) FROM dashboard_data WHERE audit_id = a.id) as dashboard_exists,
        EXTRACT(EPOCH FROM (NOW() - a.started_at)) / 60 as running_minutes
      FROM ai_visibility_audits a
      WHERE a.status IN ('pending', 'processing')
        AND a.current_phase = 'pending'
        AND a.started_at < NOW() - INTERVAL '10 minutes'
        AND (a.last_heartbeat IS NULL OR a.last_heartbeat < NOW() - INTERVAL '10 minutes')
        AND (SELECT COUNT(*) FROM audit_responses WHERE audit_id = a.id) > 0
        AND a.completed_at IS NULL
      ORDER BY a.started_at ASC
    `);

    const stuck = result.rows.map((row: any) => ({
      ...row,
      reprocess_count: parseInt(row.reprocess_count || '0'),
      dashboard_exists: parseInt(row.dashboard_exists) > 0,
      should_auto_fix: parseInt(row.dashboard_exists) > 0,
      risk_level: parseInt(row.reprocess_count || '0') >= 2 ? 'high' : 'medium'
    }));

    res.json({
      success: true,
      stuck_audits: stuck,
      count: stuck.length,
      high_risk_count: stuck.filter((s: any) => s.risk_level === 'high').length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Manual intervention: Fix stuck audit (mark as completed if dashboard exists)
 */
router.post('/audits/:auditId/fix-stuck', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;
  const { auditId } = req.params;
  const { admin_user, notes } = req.body;

  try {
    // Check if dashboard exists
    const dashboardCheck = await db.query(
      'SELECT COUNT(*) as count FROM dashboard_data WHERE audit_id = $1',
      [auditId]
    );

    if (dashboardCheck.rows[0].count === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot auto-fix: Dashboard data does not exist. Audit may need full reprocessing.'
      });
    }

    // Get current status
    const currentStatus = await db.query(
      'SELECT status, current_phase FROM ai_visibility_audits WHERE id = $1',
      [auditId]
    );

    // Fix audit status
    await db.query(`
      UPDATE ai_visibility_audits
      SET
        status = 'completed',
        current_phase = 'completed',
        completed_at = COALESCE(completed_at, NOW())
      WHERE id = $1
    `, [auditId]);

    // Log to reprocess table
    await db.query(`
      INSERT INTO audit_reprocess_log (
        audit_id, reprocess_attempt, reason, triggered_by,
        status_before, phase_before, status_after, phase_after,
        admin_user, notes
      ) VALUES ($1, 0, 'Manual admin fix via control center', 'admin', $2, $3, 'completed', 'completed', $4, $5)
    `, [
      auditId,
      currentStatus.rows[0]?.status || 'unknown',
      currentStatus.rows[0]?.current_phase || 'unknown',
      admin_user || 'unknown',
      notes || 'Fixed via admin dashboard control center'
    ]);

    res.json({
      success: true,
      message: `Audit ${auditId} fixed successfully`,
      status_before: currentStatus.rows[0],
      status_after: { status: 'completed', current_phase: 'completed' }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ========================================
// LLM CONFIGURATION MANAGEMENT
// ========================================

/**
 * Get all LLM configurations
 * @auth Required - Admin only
 */
router.get('/llm-config',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { db } = req.app.locals;

    try {
      const result = await db.query(`
        SELECT
          id,
          use_case,
          use_case_description,
          provider,
          model,
          priority,
          weight,
          enabled,
          temperature,
          max_tokens,
          timeout_ms,
          cost_per_1k_tokens,
          updated_at,
          updated_by,
          notes
        FROM llm_configurations
        ORDER BY use_case, priority
      `);

      res.json({
        success: true,
        configurations: result.rows,
        total: result.rows.length
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);

/**
 * Get LLM configuration for a specific use case (with caching and fallback)
 * @auth Not required - Used by services for config lookup
 */
router.get('/llm-config/:use_case', asyncHandler(async (req: Request, res: Response) => {
  const { db, redis } = req.app.locals;
  const { use_case } = req.params;

  try {
    // Use caching and fallback helper
    const config = await getLLMConfigWithFallback(db, redis, use_case);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: `No configuration found for use case: ${use_case}`
      });
    }

    res.json({
      success: true,
      use_case,
      configuration: config,
      source: config.source || 'database'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Update LLM configuration
 * @auth Required - Admin only
 * @validation Validates provider-model combinations and ranges
 */
router.patch('/llm-config/:id',
  authenticate,
  requireAdmin,
  validate(routeSchemas.llmConfig.update, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { db, redis } = req.app.locals;
  const { id } = req.params;
  const {
    model,
    provider,
    priority,
    weight,
    enabled,
    temperature,
    max_tokens,
    timeout_ms,
    cost_per_1k_tokens,
    notes,
    updated_by
  } = req.body;

  try {
    // Get current config for audit log
    const currentResult = await db.query(
      'SELECT * FROM llm_configurations WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    const currentConfig = currentResult.rows[0];

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (model !== undefined) {
      updates.push(`model = $${paramCount++}`);
      values.push(model);
    }
    if (provider !== undefined) {
      updates.push(`provider = $${paramCount++}`);
      values.push(provider);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }
    if (weight !== undefined) {
      updates.push(`weight = $${paramCount++}`);
      values.push(weight);
    }
    if (enabled !== undefined) {
      updates.push(`enabled = $${paramCount++}`);
      values.push(enabled);
    }
    if (temperature !== undefined) {
      updates.push(`temperature = $${paramCount++}`);
      values.push(temperature);
    }
    if (max_tokens !== undefined) {
      updates.push(`max_tokens = $${paramCount++}`);
      values.push(max_tokens);
    }
    if (timeout_ms !== undefined) {
      updates.push(`timeout_ms = $${paramCount++}`);
      values.push(timeout_ms);
    }
    if (cost_per_1k_tokens !== undefined) {
      updates.push(`cost_per_1k_tokens = $${paramCount++}`);
      values.push(cost_per_1k_tokens);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes);
    }
    if (updated_by !== undefined) {
      updates.push(`updated_by = $${paramCount++}`);
      values.push(updated_by);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    // Add ID as last parameter
    values.push(id);

    // Update configuration
    const updateQuery = `
      UPDATE llm_configurations
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);

    // Log to audit table
    await db.query(`
      INSERT INTO llm_config_audit_log (
        config_id, action, changed_by, old_values, new_values
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      id,
      'updated',
      updated_by || 'system',
      JSON.stringify(currentConfig),
      JSON.stringify(result.rows[0])
    ]);

    // Invalidate cache for this use case
    await invalidateLLMConfigCache(redis, currentConfig.use_case);

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      configuration: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Create new LLM configuration
 * @auth Required - Admin only
 * @validation Validates all fields and provider-model combination
 */
router.post('/llm-config',
  authenticate,
  requireAdmin,
  validate(routeSchemas.llmConfig.create, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { db, redis } = req.app.locals;
  const {
    use_case,
    use_case_description,
    provider,
    model,
    priority = 1,
    weight = 1.0,
    enabled = true,
    temperature = 0.7,
    max_tokens = 4000,
    timeout_ms = 30000,
    cost_per_1k_tokens,
    notes,
    updated_by = 'system'
  } = req.body;

  // Validate required fields
  if (!use_case || !provider || !model) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: use_case, provider, model'
    });
  }

  try {
    const result = await db.query(`
      INSERT INTO llm_configurations (
        use_case, use_case_description, provider, model,
        priority, weight, enabled, temperature, max_tokens,
        timeout_ms, cost_per_1k_tokens, notes, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      use_case, use_case_description, provider, model,
      priority, weight, enabled, temperature, max_tokens,
      timeout_ms, cost_per_1k_tokens, notes, updated_by
    ]);

    // Log to audit table
    await db.query(`
      INSERT INTO llm_config_audit_log (
        config_id, action, changed_by, new_values
      ) VALUES ($1, $2, $3, $4)
    `, [
      result.rows[0].id,
      'created',
      updated_by,
      JSON.stringify(result.rows[0])
    ]);

    // Invalidate cache for this use case
    await invalidateLLMConfigCache(redis, use_case);

    res.status(201).json({
      success: true,
      message: 'Configuration created successfully',
      configuration: result.rows[0]
    });
  } catch (error: any) {
    // Check for unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: `Configuration for use_case '${use_case}' with provider '${provider}' already exists`
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Delete LLM configuration
 * @auth Required - Admin only
 */
router.delete('/llm-config/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { db, redis } = req.app.locals;
  const { id } = req.params;
  const { updated_by = 'system' } = req.body;

  try {
    // Get config before deletion for audit
    const currentResult = await db.query(
      'SELECT * FROM llm_configurations WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    const config = currentResult.rows[0];

    // Log to audit table before deletion
    await db.query(`
      INSERT INTO llm_config_audit_log (
        config_id, action, changed_by, old_values
      ) VALUES ($1, $2, $3, $4)
    `, [
      id,
      'deleted',
      updated_by,
      JSON.stringify(config)
    ]);

    // Delete configuration
    await db.query('DELETE FROM llm_configurations WHERE id = $1', [id]);

    // Invalidate cache for this use case
    await invalidateLLMConfigCache(redis, config.use_case);

    res.json({
      success: true,
      message: 'Configuration deleted successfully',
      deleted_configuration: config
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get LLM configuration summary (grouped by use case)
 * @auth Required - Admin only
 */
router.get('/llm-config-summary',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;

  try {
    const result = await db.query(`
      SELECT * FROM llm_config_summary
      ORDER BY use_case
    `);

    res.json({
      success: true,
      summary: result.rows
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Get LLM configuration audit log
 * @auth Required - Admin only
 */
router.get('/llm-config-audit-log',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;
  const { limit = 50, config_id } = req.query;

  try {
    let query = `
      SELECT
        l.*,
        c.use_case,
        c.provider,
        c.model
      FROM llm_config_audit_log l
      LEFT JOIN llm_configurations c ON l.config_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];
    if (config_id) {
      params.push(config_id);
      query += ` AND l.config_id = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY l.changed_at DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      audit_log: result.rows,
      total: result.rows.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * Toggle LLM configuration enabled/disabled
 * @auth Required - Admin only
 * @validation Validates updated_by field
 */
router.post('/llm-config/:id/toggle',
  authenticate,
  requireAdmin,
  validate(routeSchemas.llmConfig.toggle, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { db, redis } = req.app.locals;
  const { id } = req.params;
  const { updated_by = 'system' } = req.body;

  try {
    // Get current state
    const currentResult = await db.query(
      'SELECT * FROM llm_configurations WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    const currentConfig = currentResult.rows[0];
    const newEnabledState = !currentConfig.enabled;

    // Update
    const result = await db.query(`
      UPDATE llm_configurations
      SET enabled = $1, updated_at = NOW(), updated_by = $2
      WHERE id = $3
      RETURNING *
    `, [newEnabledState, updated_by, id]);

    // Log to audit
    await db.query(`
      INSERT INTO llm_config_audit_log (
        config_id, action, changed_by, old_values, new_values
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      id,
      newEnabledState ? 'enabled' : 'disabled',
      updated_by,
      JSON.stringify({ enabled: currentConfig.enabled }),
      JSON.stringify({ enabled: newEnabledState })
    ]);

    // Invalidate cache for this use case
    await invalidateLLMConfigCache(redis, currentConfig.use_case);

    res.json({
      success: true,
      message: `Configuration ${newEnabledState ? 'enabled' : 'disabled'} successfully`,
      configuration: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

export default router;

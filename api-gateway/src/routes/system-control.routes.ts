/**
 * System Control Routes - Comprehensive Admin Control Center
 * Real-time monitoring, management, and emergency controls
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const execAsync = promisify(exec);

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

export default router;

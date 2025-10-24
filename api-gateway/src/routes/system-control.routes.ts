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

export default router;

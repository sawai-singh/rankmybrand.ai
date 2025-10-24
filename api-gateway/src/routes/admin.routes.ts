/**
 * Admin Routes - Full Control Over System
 * Audit management, monitoring, and control
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import { auditQueue } from './onboarding.routes.js';

const router = Router();

// ========================================
// AUDIT MONITORING
// ========================================

/**
 * Get all audits with pipeline status
 */
router.get('/audits', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;

  const result = await db.query(`
    SELECT
      av.id as audit_id,
      av.company_name,
      av.company_id,
      av.status,
      av.current_phase,
      av.phase_progress,
      av.phase_started_at,
      av.phase_details,
      av.response_count_limit,
      av.query_count,
      av.created_at,
      av.started_at,
      av.completed_at,
      av.error_message,
      (SELECT COUNT(*) FROM audit_queries WHERE audit_id = av.id) as queries_generated,
      (SELECT COUNT(*) FROM audit_responses WHERE audit_id = av.id) as responses_collected,
      (SELECT COUNT(*) FROM audit_responses WHERE audit_id = av.id AND geo_score IS NOT NULL) as responses_analyzed,
      (SELECT COUNT(*) FROM dashboard_data WHERE audit_id = av.id) as dashboard_populated,
      c.domain,
      c.industry
    FROM ai_visibility_audits av
    LEFT JOIN companies c ON c.id = av.company_id
    ORDER BY av.created_at DESC
  `);

  // Use accurate phase tracking instead of calculated stages
  const audits = result.rows.map((audit: any) => {
    // Use current_phase if available, otherwise fallback to old logic
    let pipeline_stage = audit.current_phase || 'pending';
    let pipeline_progress = audit.phase_progress || 0;

    // Fallback for old audits without phase tracking
    if (!audit.current_phase) {
      if (audit.queries_generated > 0) {
        pipeline_stage = 'generating_queries';
        pipeline_progress = 15;
      }
      if (audit.responses_collected > 0) {
        pipeline_stage = 'analyzing_responses';
        pipeline_progress = 70;
      }
      if (audit.dashboard_populated > 0) {
        pipeline_stage = 'completed';
        pipeline_progress = 100;
      }
    }

    // Detect stuck audits - phase hasn't changed in 30 minutes
    const phaseStartTime = audit.phase_started_at ? new Date(audit.phase_started_at).getTime() : new Date(audit.created_at).getTime();
    const isStuck = audit.status === 'processing' &&
      pipeline_stage !== 'completed' &&
      (new Date().getTime() - phaseStartTime) > 30 * 60 * 1000; // 30 min

    return {
      ...audit,
      pipeline_stage,
      pipeline_progress,
      is_stuck: isStuck,
      // Add response count display (X/192)
      response_display: `${audit.responses_collected}/${audit.response_count_limit || 192}`,
    };
  });

  // Prevent browser caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.json({
    success: true,
    total: audits.length,
    audits,
  });
}));

/**
 * Get single audit details
 */
router.get('/audits/:auditId', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;
  const { auditId } = req.params;

  const audit = await db.query(`
    SELECT av.*,
      c.name as company_name,
      c.domain,
      c.industry
    FROM ai_visibility_audits av
    LEFT JOIN companies c ON c.id = av.company_id
    WHERE av.id = $1
  `, [auditId]);

  if (audit.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Audit not found' });
  }

  // Get pipeline details
  const queries = await db.query('SELECT * FROM audit_queries WHERE audit_id = $1', [auditId]);
  const responses = await db.query('SELECT * FROM audit_responses WHERE audit_id = $1', [auditId]);
  const analyzed = await db.query('SELECT * FROM audit_responses WHERE audit_id = $1 AND geo_score IS NOT NULL', [auditId]);
  const dashboard = await db.query('SELECT * FROM dashboard_data WHERE audit_id = $1', [auditId]);

  res.json({
    success: true,
    audit: audit.rows[0],
    pipeline: {
      queries: queries.rows,
      responses: responses.rows,
      analyzed: analyzed.rows,
      dashboard: dashboard.rows[0] || null,
    },
  });
}));

/**
 * Get audit workflow status
 */
router.get('/audits/:auditId/workflow', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;
  const { auditId } = req.params;

  // Get audit and pipeline counts
  const audit = await db.query('SELECT * FROM ai_visibility_audits WHERE id = $1', [auditId]);
  if (audit.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Audit not found' });
  }

  const auditData = audit.rows[0];
  const queries = await db.query('SELECT COUNT(*) as count FROM audit_queries WHERE audit_id = $1', [auditId]);
  const responses = await db.query('SELECT COUNT(*) as count, provider FROM audit_responses WHERE audit_id = $1 GROUP BY provider', [auditId]);
  const analyzed = await db.query('SELECT COUNT(*) as count FROM audit_responses WHERE audit_id = $1 AND geo_score IS NOT NULL', [auditId]);
  const dashboard = await db.query('SELECT * FROM dashboard_data WHERE audit_id = $1', [auditId]);

  const queryCount = queries.rows[0]?.count || 0;
  const responseCount = responses.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);
  const analyzedCount = analyzed.rows[0]?.count || 0;
  const dashboardExists = dashboard.rows.length > 0;

  // Build workflow steps
  const steps = [
    {
      name: 'Query Generation',
      status: queryCount > 0 ? 'completed' : auditData.status === 'failed' ? 'failed' : 'pending',
      file: 'ai_visibility_real.py',
      function: 'generate_queries',
      details: queryCount > 0 ? `Generated ${queryCount} queries using GPT-5-chat-latest` : 'Waiting to generate queries',
      error: queryCount === 0 && auditData.error_message ? auditData.error_message : undefined,
      startTime: auditData.created_at,
      endTime: queryCount > 0 ? auditData.created_at : undefined,
    },
    {
      name: 'Database Storage (audit_queries)',
      status: queryCount > 0 ? 'completed' : 'pending',
      file: 'ai_visibility_real.py',
      function: 'save_queries_to_db',
      details: queryCount > 0 ? `Saved ${queryCount} queries to audit_queries table` : 'Waiting for query generation',
      startTime: queryCount > 0 ? auditData.created_at : undefined,
      endTime: queryCount > 0 ? auditData.created_at : undefined,
    },
    {
      name: 'Job Processor Trigger',
      status: auditData.started_at ? 'completed' : queryCount > 0 ? 'running' : 'pending',
      file: 'ai_visibility_real.py',
      function: 'trigger_job_processor',
      details: auditData.started_at ? 'Job processor triggered successfully' : queryCount > 0 ? 'Attempting to trigger job processor' : 'Waiting for queries',
      error: queryCount > 0 && !auditData.started_at && auditData.error_message ? auditData.error_message : undefined,
      startTime: queryCount > 0 ? auditData.created_at : undefined,
      endTime: auditData.started_at,
    },
    {
      name: 'LLM Query Execution',
      status: responseCount > 0 ? 'completed' : auditData.started_at ? 'running' : 'pending',
      file: 'job_processor.py',
      function: '_execute_queries',
      details: responseCount > 0 ? `Executed queries across ${responses.rows.length} providers` : auditData.started_at ? 'Executing queries across AI platforms' : 'Waiting for job processor',
      startTime: auditData.started_at,
      endTime: responseCount > 0 ? undefined : undefined,
    },
  ];

  // Add provider-specific steps
  const providers = ['openai_gpt5', 'anthropic_claude', 'google_gemini', 'perplexity'];
  providers.forEach(provider => {
    const providerResponses = responses.rows.find((r: any) => r.provider === provider);
    const count = providerResponses ? parseInt(providerResponses.count) : 0;

    steps.push({
      name: `Response Collection (${provider})`,
      status: count > 0 ? 'completed' : auditData.started_at ? 'running' : 'pending',
      file: 'llm_orchestrator.py',
      function: `query_${provider}`,
      details: count > 0 ? `Collected ${count} responses from ${provider}` : auditData.started_at ? `Querying ${provider}` : 'Waiting to start',
      startTime: auditData.started_at,
      endTime: count > 0 ? undefined : undefined,
    });
  });

  steps.push(
    {
      name: 'Response Analysis',
      status: analyzedCount > 0 ? 'completed' : responseCount > 0 ? 'running' : 'pending',
      file: 'response_analyzer.py',
      function: 'analyze_responses',
      details: analyzedCount > 0 ? `Analyzed ${analyzedCount} responses` : responseCount > 0 ? 'Analyzing LLM responses' : 'Waiting for responses',
      startTime: responseCount > 0 ? undefined : undefined,
      endTime: analyzedCount > 0 ? undefined : undefined,
    },
    {
      name: 'Score Calculation',
      status: dashboardExists ? 'completed' : analyzedCount > 0 ? 'running' : 'pending',
      file: 'dashboard_data_populator.py',
      function: 'calculate_scores',
      details: dashboardExists ? 'Calculated overall, geo, and SOV scores' : analyzedCount > 0 ? 'Calculating metrics and scores' : 'Waiting for analysis',
      startTime: analyzedCount > 0 ? undefined : undefined,
      endTime: dashboardExists ? auditData.completed_at : undefined,
    },
    {
      name: 'Dashboard Population',
      status: dashboardExists ? 'completed' : 'pending',
      file: 'dashboard_data_populator.py',
      function: 'populate_dashboard_data',
      details: dashboardExists ? 'Dashboard data populated successfully' : 'Waiting for score calculation',
      startTime: dashboardExists ? auditData.completed_at : undefined,
      endTime: dashboardExists ? auditData.completed_at : undefined,
    }
  );

  res.json({
    success: true,
    audit_id: auditId,
    steps,
  });
}));

/**
 * Get audit execution logs
 */
router.get('/audits/:auditId/logs', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;
  const { auditId } = req.params;

  // Check if audit exists
  const audit = await db.query('SELECT * FROM ai_visibility_audits WHERE id = $1', [auditId]);
  if (audit.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Audit not found' });
  }

  // Read from actual log file
  let logs: any[] = [];

  try {
    const fs = require('fs');
    const logFilePath = '/tmp/intelligence-engine.log';

    if (fs.existsSync(logFilePath)) {
      const logContent = fs.readFileSync(logFilePath, 'utf-8');
      const logLines: string[] = logContent.split('\n');

      // Filter logs related to this audit ID
      const auditLogs: string[] = logLines
        .filter((line) => line.includes(auditId) || line.includes(audit.rows[0].company_name))
        .reverse() // Most recent first
        .slice(0, 100); // Limit to 100 logs

      logs = auditLogs.map((line, index) => {
        // Parse log level
        let level = 'INFO';
        if (line.includes('ERROR') || line.includes('Error')) level = 'ERROR';
        else if (line.includes('WARN') || line.includes('Warning')) level = 'WARN';
        else if (line.includes('DEBUG')) level = 'DEBUG';

        // Parse service
        let service = 'intelligence-engine';
        if (line.includes('job_processor')) service = 'job-processor';
        else if (line.includes('llm_orchestrator')) service = 'llm-orchestrator';
        else if (line.includes('query_generator')) service = 'query-generator';
        else if (line.includes('response_analyzer')) service = 'response-analyzer';
        else if (line.includes('dashboard_data_populator')) service = 'dashboard-populator';

        // Try to parse timestamp from log line (format: "2025-10-02 11:19:43")
        let timestamp = new Date();
        const timeMatch = line.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
        if (timeMatch) {
          timestamp = new Date(`${timeMatch[1]}T${timeMatch[2]}`);
        }

        return {
          timestamp,
          level,
          service,
          message: line.trim(),
          metadata: {}
        };
      });
    }
  } catch (error) {
    console.error('Error reading log file:', error);
  }

  // If no logs from file, create synthetic logs from audit data
  if (logs.length === 0) {
    const auditData = audit.rows[0];
    const queries = await db.query('SELECT COUNT(*) as count FROM audit_queries WHERE audit_id = $1', [auditId]);
    const responses = await db.query('SELECT COUNT(*) as count FROM audit_responses WHERE audit_id = $1', [auditId]);

    logs = [
      {
        timestamp: auditData.created_at,
        level: 'INFO',
        service: 'api-gateway',
        message: `Audit ${auditId} created for ${auditData.company_name}`,
        metadata: { company_id: auditData.company_id },
      },
    ];

    if (queries.rows[0]?.count > 0) {
      logs.push({
        timestamp: auditData.created_at,
        level: 'INFO',
        service: 'intelligence-engine',
        message: `Generated ${queries.rows[0].count} queries using GPT-5`,
        metadata: { query_count: queries.rows[0].count },
      });
    }

    if (auditData.started_at) {
      logs.push({
        timestamp: auditData.started_at,
        level: 'INFO',
        service: 'job-processor',
        message: 'Job processor started executing audit',
        metadata: { audit_id: auditId },
      });
    }

    if (responses.rows[0]?.count > 0) {
      logs.push({
        timestamp: new Date(),
        level: 'INFO',
        service: 'llm-orchestrator',
        message: `Collected ${responses.rows[0].count} responses from AI platforms`,
        metadata: { response_count: responses.rows[0].count },
      });
    }

    if (auditData.error_message) {
      logs.push({
        timestamp: auditData.completed_at || new Date(),
        level: 'ERROR',
        service: 'job-processor',
        message: auditData.error_message,
        metadata: { status: auditData.status },
      });
    }

    if (auditData.completed_at && auditData.status === 'completed') {
      logs.push({
        timestamp: auditData.completed_at,
        level: 'INFO',
        service: 'dashboard-populator',
        message: 'Audit completed successfully, dashboard populated',
        metadata: { audit_id: auditId },
      });
    }
  }

  res.json({
    success: true,
    audit_id: auditId,
    logs: logs.map(log => ({
      timestamp: log.timestamp,
      level: log.level,
      service: log.service,
      message: log.message,
      metadata: log.metadata,
    })),
  });
}));

// ========================================
// AUDIT CONTROL ACTIONS
// ========================================

/**
 * Stop a running audit
 */
router.post('/audits/:auditId/stop', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;
  const { auditId } = req.params;

  await db.query(`
    UPDATE ai_visibility_audits
    SET status = 'stopped',
        error_message = 'Stopped by admin',
        completed_at = NOW()
    WHERE id = $1
  `, [auditId]);

  res.json({
    success: true,
    message: `Audit ${auditId} stopped successfully`,
  });
}));

/**
 * Delete an audit completely
 */
router.delete('/audits/:auditId', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;
  const { auditId } = req.params;
  const config = req.app.locals.config;

  // CRITICAL: First stop the running audit to prevent wasted API calls
  try {
    // Mark audit as stopped/cancelled in database
    // The Intelligence Engine checks this status between processing phases
    await db.query(`
      UPDATE ai_visibility_audits
      SET status = 'cancelled',
          error_message = 'Audit cancelled by admin',
          completed_at = NOW()
      WHERE id = $1
    `, [auditId]);

    console.log(`Audit ${auditId} marked as cancelled in database`);

    // Wait a moment for the processor to check status and stop gracefully
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (stopError) {
    console.error(`Error stopping audit: ${stopError}`);
    // Continue with deletion
  }

  // Delete in correct order due to foreign keys
  await db.query('DELETE FROM dashboard_data WHERE audit_id = $1', [auditId]);
  await db.query('DELETE FROM audit_score_breakdown WHERE audit_id = $1', [auditId]);
  await db.query('DELETE FROM audit_responses WHERE audit_id = $1', [auditId]);
  await db.query('DELETE FROM audit_queries WHERE audit_id = $1', [auditId]);
  await db.query('DELETE FROM ai_visibility_audits WHERE id = $1', [auditId]);

  res.json({
    success: true,
    message: `Audit ${auditId} stopped and deleted successfully`,
  });
}));

/**
 * Retry a failed audit
 */
router.post('/audits/:auditId/retry', asyncHandler(async (req: Request, res: Response) => {
  const { db, redis } = req.app.locals;
  const { auditId } = req.params;

  // Get audit details
  const auditResult = await db.query('SELECT * FROM ai_visibility_audits WHERE id = $1', [auditId]);
  if (auditResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Audit not found' });
  }

  const audit = auditResult.rows[0];

  // Reset audit status to processing
  await db.query(`
    UPDATE ai_visibility_audits
    SET status = 'processing',
        error_message = NULL,
        started_at = NOW()
    WHERE id = $1
  `, [auditId]);

  // Queue the audit for processing (continues from where it left off)
  const jobData = {
    audit_id: auditId,
    company_id: audit.company_id,
    query_count: 48, // Will skip if queries already exist
    providers: ['openai', 'anthropic', 'google', 'perplexity'],
    auto_triggered: false,
    source: 'retry'
  };

  // Queue using Bull queue (worker will pick it up)
  await auditQueue.add('process-audit', jobData);
  console.log(`[Admin] Queued audit ${auditId} for retry`);

  res.json({
    success: true,
    message: `Audit ${auditId} queued for retry. It will continue from where it left off.`,
    audit_id: auditId
  });
}));

/**
 * Skip Phase 2 (Query Execution) - Analyze existing responses without re-querying
 */
router.post('/audits/:auditId/skip-phase-2', asyncHandler(async (req: Request, res: Response) => {
  const { db, redis } = req.app.locals;
  const { auditId } = req.params;

  // Get audit details
  const auditResult = await db.query('SELECT * FROM ai_visibility_audits WHERE id = $1', [auditId]);
  if (auditResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Audit not found' });
  }

  const audit = auditResult.rows[0];

  // Check if there are existing responses
  const responsesResult = await db.query('SELECT COUNT(*) as count FROM audit_responses WHERE audit_id = $1', [auditId]);
  const responseCount = parseInt(responsesResult.rows[0].count);

  if (responseCount === 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot skip Phase 2 - no existing responses found. Run audit normally first.'
    });
  }

  // Reset audit status to processing
  await db.query(`
    UPDATE ai_visibility_audits
    SET status = 'processing',
        current_phase = 'pending',
        error_message = NULL,
        started_at = NOW()
    WHERE id = $1
  `, [auditId]);

  // Queue the audit with skip_phase_2 flag using proper Bull format
  const jobData = {
    audit_id: auditId,
    company_id: audit.company_id,
    query_count: 48,
    providers: ['openai', 'anthropic', 'google', 'perplexity'],
    skip_phase_2: true,  // CRITICAL FLAG
    auto_triggered: false,
    source: 'skip-phase-2'
  };

  // Create a unique job ID for this manual trigger
  const jobId = `${auditId.substring(0, 8)}-${Date.now()}`;

  // Store job data in Bull hash (Bull standard format)
  await redis.hmset(`bull:ai-visibility-audit:${jobId}`, {
    data: JSON.stringify(jobData),
    opts: JSON.stringify({
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    }),
    name: 'process-audit',
    timestamp: Date.now().toString(),
    delay: '0',
    priority: '0'
  });

  // Push just the job ID to the wait queue (Bull standard)
  await redis.rpush('bull:ai-visibility-audit:wait', jobId);

  console.log(`[SKIP-PHASE-2] Queued job ${jobId} for audit ${auditId} with ${responseCount} responses`);

  res.json({
    success: true,
    message: `Audit ${auditId} queued to skip Phase 2. Will analyze ${responseCount} existing responses with GPT-5 Nano.`,
    audit_id: auditId,
    existing_responses: responseCount
  });
}));

/**
 * Force Re-analyze - Re-analyze existing responses with GPT-5 Nano (skip Phases 1 & 2)
 */
router.post('/audits/:auditId/force-reanalyze', asyncHandler(async (req: Request, res: Response) => {
  const { db, redis } = req.app.locals;
  const { auditId } = req.params;

  // Get audit details
  const auditResult = await db.query('SELECT * FROM ai_visibility_audits WHERE id = $1', [auditId]);
  if (auditResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Audit not found' });
  }

  const audit = auditResult.rows[0];

  // Check if there are existing responses
  const responsesResult = await db.query('SELECT COUNT(*) as count FROM audit_responses WHERE audit_id = $1', [auditId]);
  const responseCount = parseInt(responsesResult.rows[0].count);

  if (responseCount === 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot re-analyze - no existing responses found. Run audit normally first.'
    });
  }

  // Clear existing analysis data
  await db.query(`
    UPDATE audit_responses
    SET
      brand_mentioned = NULL,
      mention_position = NULL,
      mention_context = NULL,
      sentiment = NULL,
      recommendation_strength = NULL,
      competitors_mentioned = NULL,
      key_features_mentioned = NULL,
      featured_snippet_potential = NULL,
      voice_search_optimized = NULL,
      analysis_metadata = NULL,
      geo_score = NULL,
      sov_score = NULL,
      context_completeness_score = NULL,
      recommendations = NULL
    WHERE audit_id = $1
  `, [auditId]);

  // Reset audit status
  await db.query(`
    UPDATE ai_visibility_audits
    SET status = 'processing',
        current_phase = 'pending',
        error_message = NULL,
        started_at = NOW()
    WHERE id = $1
  `, [auditId]);

  // Queue the audit with proper Bull format for force re-analysis
  const jobData = {
    audit_id: auditId,
    company_id: audit.company_id,
    query_count: 48,
    providers: ['openai', 'anthropic', 'google', 'perplexity'],
    skip_phase_2: true,  // Skip re-querying
    force_reanalyze: true,  // Force fresh analysis
    auto_triggered: false,
    source: 'force-reanalyze'
  };

  // Create a unique job ID for this manual trigger
  const jobId = `${auditId.substring(0, 8)}-${Date.now()}`;

  // Store job data in Bull hash (Bull standard format)
  await redis.hmset(`bull:ai-visibility-audit:${jobId}`, {
    data: JSON.stringify(jobData),
    opts: JSON.stringify({
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    }),
    name: 'process-audit',
    timestamp: Date.now().toString(),
    delay: '0',
    priority: '0'
  });

  // Push just the job ID to the wait queue (Bull standard)
  await redis.rpush('bull:ai-visibility-audit:wait', jobId);

  console.log(`[FORCE-REANALYZE] Queued job ${jobId} for audit ${auditId} with ${responseCount} responses`);

  res.json({
    success: true,
    message: `Audit ${auditId} queued for re-analysis. Will re-analyze ${responseCount} responses with GPT-5 Nano from scratch.`,
    audit_id: auditId,
    existing_responses: responseCount,
    cleared_analyses: true
  });
}));

/**
 * Resume Audit - Finalize with existing scores without re-analysis
 * Use this for completed audits that need dashboard population or failed audits with existing scores
 */
router.post('/audits/:auditId/resume', asyncHandler(async (req: Request, res: Response) => {
  const { db, redis } = req.app.locals;
  const { auditId } = req.params;

  // Get audit details
  const auditResult = await db.query('SELECT * FROM ai_visibility_audits WHERE id = $1', [auditId]);
  if (auditResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Audit not found' });
  }

  const audit = auditResult.rows[0];

  // Check if there are existing scores
  const scoresResult = await db.query('SELECT * FROM audit_score_breakdown WHERE audit_id = $1', [auditId]);

  if (scoresResult.rows.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot resume - no existing scores found. Run full audit or re-analyze first.'
    });
  }

  const scores = scoresResult.rows[0];

  // Reset audit status to processing
  await db.query(`
    UPDATE ai_visibility_audits
    SET status = 'processing',
        current_phase = 'finalizing',
        error_message = NULL,
        started_at = NOW()
    WHERE id = $1
  `, [auditId]);

  // Queue the audit with skip_analysis flag using proper Bull format
  const jobData = {
    audit_id: auditId,
    company_id: audit.company_id,
    query_count: 48,
    providers: ['openai', 'anthropic', 'google', 'perplexity'],
    skip_phase_2: true,  // Skip re-querying
    skip_analysis: true,  // Skip re-analysis - just finalize with existing scores
    auto_triggered: false,
    source: 'resume'
  };

  // Create a unique job ID for this manual trigger
  const jobId = `resume-${auditId.substring(0, 8)}-${Date.now()}`;

  // Store job data in Bull hash (Bull standard format)
  await redis.hmset(`bull:ai-visibility-audit:${jobId}`, {
    data: JSON.stringify(jobData),
    opts: JSON.stringify({
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    }),
    name: 'process-audit',
    timestamp: Date.now().toString(),
    delay: '0',
    priority: '0'
  });

  // Push just the job ID to the wait queue (Bull standard)
  await redis.rpush('bull:ai-visibility-audit:wait', jobId);

  console.log(`[RESUME] Queued job ${jobId} for audit ${auditId} with existing scores (overall: ${scores.overall})`);

  res.json({
    success: true,
    message: `Audit ${auditId} queued for resume. Will finalize with existing scores (no re-analysis needed).`,
    audit_id: auditId,
    existing_scores: {
      overall: scores.overall,
      geo: scores.geo,
      sov: scores.sov
    }
  });
}));

/**
 * Manually trigger dashboard population
 */
router.post('/audits/:auditId/populate-dashboard', asyncHandler(async (req: Request, res: Response) => {
  const { auditId } = req.params;
  const config = req.app.locals.config;

  try {
    const response = await fetch(`${config.services.intelligence}/api/dashboard/populate/${auditId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to populate dashboard');
    }

    const data = await response.json();

    res.json({
      success: true,
      message: `Dashboard populated for audit ${auditId}`,
      data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}));

/**
 * Generate shareable link for completed audit
 */
router.post('/audits/:auditId/generate-link', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;
  const { auditId } = req.params;

  // Check if audit exists and is completed
  const auditResult = await db.query(`
    SELECT av.*, c.name as company_name, u.email, u.id as user_id
    FROM ai_visibility_audits av
    LEFT JOIN companies c ON c.id = av.company_id
    LEFT JOIN users u ON u.company_id = av.company_id
    WHERE av.id = $1
    LIMIT 1
  `, [auditId]);

  if (auditResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Audit not found' });
  }

  const audit = auditResult.rows[0];

  if (audit.status !== 'completed') {
    return res.status(400).json({
      success: false,
      error: `Cannot generate link for audit with status: ${audit.status}. Audit must be completed first.`
    });
  }

  if (!audit.user_id) {
    return res.status(400).json({
      success: false,
      error: 'No user associated with this audit'
    });
  }

  try {
    // Import crypto for token generation
    const crypto = require('crypto');
    const tokenSecret = process.env.REPORT_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
    const tokenExpiryHours = parseInt(process.env.REPORT_TOKEN_EXPIRY_HOURS || '72');

    // Check if a report_request already exists for this audit
    let reportRequest = await db.query(`
      SELECT * FROM report_requests
      WHERE user_id = $1 AND company_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `, [audit.user_id, audit.company_id]);

    let reportId: number;

    if (reportRequest.rows.length > 0) {
      reportId = reportRequest.rows[0].id;
      console.log(`Using existing report request: ${reportId}`);
    } else {
      // Create new report_request
      const newReport = await db.query(`
        INSERT INTO report_requests (
          user_id, company_id, email, status, eta_minutes,
          idempotency_key, metadata, report_data, audit_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        audit.user_id,
        audit.company_id,
        audit.email,
        'ready',
        0,
        crypto.createHash('sha256').update(`${audit.user_id}-${audit.company_id}-${auditId}`).digest('hex'),
        JSON.stringify({ companyName: audit.company_name, auditId }),
        JSON.stringify({ auditId, companyId: audit.company_id }),
        auditId
      ]);
      reportId = newReport.rows[0].id;
      console.log(`Created new report request: ${reportId}`);
    }

    // Generate signed token
    const payload = {
      userId: audit.user_id,
      reportId: reportId,
      auditId: auditId,
      companyId: audit.company_id,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex')
    };

    const message = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', tokenSecret)
      .update(message)
      .digest('hex');

    const token = Buffer.from(`${message}.${signature}`).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenExpiresAt = new Date(Date.now() + tokenExpiryHours * 60 * 60 * 1000);

    // Update report_request with token
    await db.query(`
      UPDATE report_requests
      SET email_token_hash = $1,
          token_expires_at = $2,
          token_used = false
      WHERE id = $3
    `, [tokenHash, tokenExpiresAt, reportId]);

    res.json({
      success: true,
      token,
      reportId,
      auditId,
      companyName: audit.company_name,
      expiresAt: tokenExpiresAt,
      link: `http://localhost:3003/r/${token}`
    });
  } catch (error: any) {
    console.error('Failed to generate link:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate shareable link'
    });
  }
}));

/**
 * Verify shareable report token
 */
router.post('/reports/verify-token', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, error: 'Token is required' });
  }

  try {
    const crypto = require('crypto');
    const tokenSecret = process.env.REPORT_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

    // Decode token
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const [message, signature] = decoded.split('.');

    if (!message || !signature) {
      return res.status(400).json({ success: false, error: 'Invalid token format' });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', tokenSecret)
      .update(message)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ success: false, error: 'Invalid token signature' });
    }

    // Parse payload
    const payload = JSON.parse(message);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Check token in database
    const reportRequest = await db.query(`
      SELECT * FROM report_requests
      WHERE email_token_hash = $1
    `, [tokenHash]);

    if (reportRequest.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Token not found' });
    }

    const report = reportRequest.rows[0];

    // Check if token has expired
    if (report.token_expires_at && new Date() > new Date(report.token_expires_at)) {
      return res.status(401).json({ success: false, error: 'Token has expired' });
    }

    // Mark token as used
    await db.query(`
      UPDATE report_requests
      SET token_used = true,
          token_used_at = NOW()
      WHERE id = $1
    `, [report.id]);

    res.json({
      success: true,
      auditId: payload.auditId,
      companyId: payload.companyId,
      reportId: report.id,
    });
  } catch (error: any) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify token',
    });
  }
}));

/**
 * Get dashboard data for an audit (for shareable reports)
 */
router.get('/dashboard/data/:auditId', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;
  const { auditId } = req.params;

  try {
    const result = await db.query(`
      SELECT
        dd.*,
        av.company_name,
        av.status as audit_status
      FROM dashboard_data dd
      LEFT JOIN ai_visibility_audits av ON av.id = dd.audit_id
      WHERE dd.audit_id = $1
    `, [auditId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard data not found for this audit'
      });
    }

    const data = result.rows[0];

    res.json({
      audit_id: data.audit_id,
      company_name: data.company_name,
      overall_score: data.overall_score,
      geo_score: data.geo_score,
      sov_score: data.sov_score,
      brand_mention_rate: data.brand_mention_rate,
      total_queries: data.total_queries,
      total_responses: data.total_responses,
      main_competitors: data.main_competitors || [],
      provider_scores: data.provider_scores || {},
      competitor_mentions: data.competitor_mentions || {},
      score_breakdown: data.score_breakdown || {},
      top_recommendations: data.top_recommendations || [],
      key_insights: data.key_insights || [],
    });
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
    });
  }
}));

// ========================================
// BULK OPERATIONS
// ========================================

/**
 * Delete all failed audits
 */
router.delete('/audits/bulk/failed', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;

  const failed = await db.query(`
    SELECT id FROM ai_visibility_audits WHERE status = 'failed'
  `);

  const auditIds = failed.rows.map((r: any) => r.id);

  for (const auditId of auditIds) {
    await db.query('DELETE FROM dashboard_data WHERE audit_id = $1', [auditId]);
    await db.query('DELETE FROM audit_score_breakdown WHERE audit_id = $1', [auditId]);
    await db.query('DELETE FROM audit_responses WHERE audit_id = $1', [auditId]);
    await db.query('DELETE FROM audit_queries WHERE audit_id = $1', [auditId]);
    await db.query('DELETE FROM ai_visibility_audits WHERE id = $1', [auditId]);
  }

  res.json({
    success: true,
    message: `Deleted ${auditIds.length} failed audits`,
    deleted_count: auditIds.length,
  });
}));

// ========================================
// SYSTEM HEALTH
// ========================================

/**
 * Get system health status
 */
router.get('/system/health', asyncHandler(async (req: Request, res: Response) => {
  const { db, redis } = req.app.locals;
  const config = req.app.locals.config;

  const health: any = {
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Database health
  try {
    const result = await db.query('SELECT NOW()');
    health.services.database = {
      status: 'healthy',
      latency_ms: 0, // Would need timing
    };
  } catch (error) {
    health.services.database = {
      status: 'unhealthy',
      error: (error as Error).message,
    };
  }

  // Redis health
  try {
    await redis.ping();
    health.services.redis = {
      status: 'healthy',
    };
  } catch (error) {
    health.services.redis = {
      status: 'unhealthy',
      error: (error as Error).message,
    };
  }

  // Intelligence Engine health
  try {
    const response = await fetch(`${config.services.intelligence}/health`);
    health.services.intelligence_engine = {
      status: response.ok ? 'healthy' : 'unhealthy',
    };
  } catch (error) {
    health.services.intelligence_engine = {
      status: 'unhealthy',
      error: 'Connection failed',
    };
  }

  // Audit statistics
  const stats = await db.query(`
    SELECT
      COUNT(*) as total_audits,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_audits,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_audits,
      COUNT(*) FILTER (WHERE status = 'processing') as running_audits
    FROM ai_visibility_audits
  `);

  health.audit_stats = stats.rows[0];
  health.overall_status = health.services.database.status === 'healthy' &&
    health.services.redis.status === 'healthy' ? 'healthy' : 'degraded';

  res.json(health);
}));

// ========================================
// COMPANY JOURNEY (Existing endpoint)
// ========================================

router.get('/companies/all', asyncHandler(async (req: Request, res: Response) => {
  const { db } = req.app.locals;

  const result = await db.query(`
    SELECT
      c.id as company_id,
      c.name as company_name,
      c.domain,
      c.description as company_description,
      c.industry,
      c.created_at,
      u.email as user_email,
      u.id as user_id,
      os.session_id,
      os.status as session_status,
      os.started_at as session_started,
      os.completed_at as session_completed,
      os.original_company_data,
      os.edited_company_data,
      os.final_company_data,
      os.competitor_journey,
      os.time_on_company_step,
      os.time_on_description_step,
      os.time_on_competitor_step,
      (SELECT COUNT(*) FROM audit_queries aq
       JOIN ai_visibility_audits av ON av.id = aq.audit_id
       WHERE av.company_id = c.id) as query_count,
      (SELECT av.id FROM ai_visibility_audits av
       WHERE av.company_id = c.id
       ORDER BY av.created_at DESC LIMIT 1) as latest_audit_id,
      (SELECT av.status FROM ai_visibility_audits av
       WHERE av.company_id = c.id
       ORDER BY av.created_at DESC LIMIT 1) as audit_status
    FROM companies c
    LEFT JOIN users u ON u.id = (
      SELECT user_id FROM onboarding_sessions WHERE company_id = c.id LIMIT 1
    )
    LEFT JOIN onboarding_sessions os ON os.company_id = c.id
    ORDER BY c.created_at DESC
  `);

  res.json({
    success: true,
    companies: result.rows,
  });
}));

// ========================================
// FEATURE FLAGS
// ========================================

/**
 * Get all feature flags with current values
 */
router.get('/feature-flags', asyncHandler(async (req: Request, res: Response) => {
  const config = req.app.locals.config;

  try {
    // Fetch current feature flags from intelligence engine
    const response = await fetch(`${config.services.intelligence}/api/config/feature-flags`);

    if (!response.ok) {
      throw new Error('Failed to fetch feature flags from intelligence engine');
    }

    const data = await response.json();

    // Format for UI
    const flags = [
      {
        name: 'Batched-Only Analysis Mode',
        key: 'USE_BATCHED_ANALYSIS_ONLY',
        enabled: data.flags?.USE_BATCHED_ANALYSIS_ONLY !== false,
        description: 'Skip Phase 1 (144 individual LLM calls) and use ONLY Phase 2 batched Call #4 for per-response metrics. Achieves 87.5% LLM cost savings while maintaining accuracy.',
        impact: {
          type: 'cost',
          value: '87.5% Cost Savings',
          icon: 'DollarSign',
          color: 'bg-green-500/20'
        },
        requiresRestart: true,
        category: 'analysis'
      },
      {
        name: 'Phase 1 Deprecation Warnings',
        key: 'ENABLE_PHASE1_DEPRECATION_WARNINGS',
        enabled: data.flags?.ENABLE_PHASE1_DEPRECATION_WARNINGS !== false,
        description: 'Show warnings in logs when legacy Phase 1 (individual analysis) is used instead of batched-only mode. Helps monitor when old code paths are triggered.',
        impact: {
          type: 'monitoring',
          value: 'Enhanced Monitoring',
          icon: 'Activity',
          color: 'bg-blue-500/20'
        },
        requiresRestart: true,
        category: 'logging'
      }
    ];

    res.json({
      success: true,
      flags,
      last_updated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching feature flags:', error);

    // Return default flags if intelligence engine is unavailable
    const defaultFlags = [
      {
        name: 'Batched-Only Analysis Mode',
        key: 'USE_BATCHED_ANALYSIS_ONLY',
        enabled: true,
        description: 'Skip Phase 1 (144 individual LLM calls) and use ONLY Phase 2 batched Call #4 for per-response metrics. Achieves 87.5% LLM cost savings while maintaining accuracy.',
        impact: {
          type: 'cost',
          value: '87.5% Cost Savings',
          icon: 'DollarSign',
          color: 'bg-green-500/20'
        },
        requiresRestart: true,
        category: 'analysis'
      },
      {
        name: 'Phase 1 Deprecation Warnings',
        key: 'ENABLE_PHASE1_DEPRECATION_WARNINGS',
        enabled: true,
        description: 'Show warnings in logs when legacy Phase 1 (individual analysis) is used instead of batched-only mode. Helps monitor when old code paths are triggered.',
        impact: {
          type: 'monitoring',
          value: 'Enhanced Monitoring',
          icon: 'Activity',
          color: 'bg-blue-500/20'
        },
        requiresRestart: true,
        category: 'logging'
      }
    ];

    res.json({
      success: true,
      flags: defaultFlags,
      last_updated: new Date().toISOString(),
      warning: 'Using default values - intelligence engine unavailable'
    });
  }
}));

/**
 * Update a specific feature flag
 */
router.patch('/feature-flags/:key', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { enabled } = req.body;
  const config = req.app.locals.config;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'enabled must be a boolean value'
    });
  }

  try {
    // Update via intelligence engine API
    const response = await fetch(`${config.services.intelligence}/api/config/feature-flags/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });

    if (!response.ok) {
      throw new Error('Failed to update feature flag');
    }

    const data = await response.json();

    res.json({
      success: true,
      message: `Feature flag ${key} updated to ${enabled}`,
      flag: {
        key,
        enabled,
        requiresRestart: true
      }
    });
  } catch (error: any) {
    console.error('Error updating feature flag:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update feature flag'
    });
  }
}));

/**
 * Restart Intelligence Engine service
 */
router.post('/services/restart', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const path = require('path');
    const execAsync = promisify(exec);

    // Get base path from environment or use default
    const basePath = process.env.PROJECT_ROOT || path.join(__dirname, '../../..');
    const enginePath = path.join(basePath, 'services/intelligence-engine');

    console.log('[Service Restart] Initiating graceful shutdown...');

    // Step 1: Try graceful shutdown with SIGTERM (kill -15)
    let processesExist = false;
    try {
      const { stdout } = await execAsync('lsof -ti:8002');
      if (stdout.trim()) {
        processesExist = true;
        await execAsync('lsof -ti:8002 | xargs kill -15'); // SIGTERM - graceful
        console.log('[Service Restart] Sent SIGTERM to existing processes');
      }
    } catch (error) {
      console.log('[Service Restart] No existing processes to kill');
    }

    // Step 2: Wait up to 5 seconds for graceful shutdown
    if (processesExist) {
      console.log('[Service Restart] Waiting for graceful shutdown (max 5s)...');
      let shutdownComplete = false;

      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          const { stdout } = await execAsync('lsof -ti:8002');
          if (!stdout.trim()) {
            shutdownComplete = true;
            console.log(`[Service Restart] Graceful shutdown completed in ${i + 1}s`);
            break;
          }
        } catch {
          shutdownComplete = true;
          console.log(`[Service Restart] Graceful shutdown completed in ${i + 1}s`);
          break;
        }
      }

      // Step 3: Force kill if still running (SIGKILL)
      if (!shutdownComplete) {
        try {
          const { stdout } = await execAsync('lsof -ti:8002');
          if (stdout.trim()) {
            await execAsync('lsof -ti:8002 | xargs kill -9'); // SIGKILL - force
            console.log('[Service Restart] ⚠️  Forced shutdown with SIGKILL (process did not respond to SIGTERM)');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          // Process already terminated
        }
      }
    }

    // Wait a moment for port to be fully released
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start intelligence engine in background
    console.log(`[Service Restart] Starting Intelligence Engine from: ${enginePath}`);

    exec(
      `cd ${enginePath} && ` +
      `PYTHONPATH=${enginePath} ` +
      'nohup python3 src/main.py > /tmp/intelligence-engine.log 2>&1 &',
      (error, stdout, stderr) => {
        if (error) {
          console.error('[Service Restart] Failed to start:', error);
        } else {
          console.log('[Service Restart] Intelligence Engine restarted successfully');
        }
      }
    );

    res.json({
      success: true,
      message: 'Intelligence Engine restart initiated. Service will be available in ~10 seconds.',
      details: {
        graceful_shutdown: processesExist,
        engine_path: enginePath
      }
    });
  } catch (error: any) {
    console.error('Error restarting service:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to restart service'
    });
  }
}));

export default router;

import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { asyncHandler } from '../utils/async-handler';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * Transform dashboard_data row to frontend expected format
 */
function transformDashboardDataToAuditFormat(row: any) {
  // Combine key_insights and top_recommendations for insights
  const allInsights = [
    ...(row.key_insights || []),
    ...(row.top_recommendations || []).map((rec: any) => ({
      type: 'recommendation',
      message: rec.headline || rec.executive_pitch || 'Strategic Recommendation',
      importance: rec.priority_score >= 95 ? 'high' : rec.priority_score >= 85 ? 'medium' : 'low',
      details: rec
    }))
  ];

  return {
    id: row.audit_id,
    status: row.audit_status || 'completed',
    overallScore: row.overall_score || 0,
    geoScore: row.geo_score || 0,
    sovScore: row.sov_score || 0,
    brandMentionRate: row.brand_mention_rate || 0,
    competitivePosition: row.sov_score || 0, // Using SOV as competitive position
    scores: {
      visibility: row.visibility_score || 0,
      sentiment: row.sentiment_score || 0,
      recommendation: row.recommendation_score || 0,
      seo: row.geo_score || 0, // Using GEO score as SEO score
    },
    insights: transformInsights(allInsights),
    competitors: transformCompetitors(row.main_competitors || [], row.competitor_mentions || {}),
    totalQueries: row.total_queries || 0,
    totalResponses: row.total_responses || 0,
    createdAt: row.created_at,
    completedAt: row.audit_completed_at,
    companyName: row.company_name,
    companyDomain: row.company_domain,
    industry: row.industry,
    topRecommendations: row.top_recommendations || [],
    quickWins: row.quick_wins || [],
    executiveSummary: row.executive_summary || '',
    personalizedNarrative: row.personalized_narrative || '',
    providerScores: row.provider_scores || {},
  };
}

/**
 * Transform key_insights array to frontend expected format
 */
function transformInsights(insights: any[]): Array<{
  type: string;
  message: string;
  importance: 'high' | 'medium' | 'low';
  details?: any;
}> {
  if (!Array.isArray(insights)) return [];

  return insights.map((insight: any, index: number) => {
    // If insight is already an object with the right structure
    if (typeof insight === 'object' && insight.message) {
      return {
        type: insight.type || 'general',
        message: insight.message,
        importance: insight.importance || 'medium',
        details: insight.details || null,
      };
    }

    // If insight is a string or has headline property
    const message = typeof insight === 'string'
      ? insight
      : insight.headline || insight.insight || 'Insight';

    return {
      type: 'general',
      message,
      importance: index < 3 ? 'high' : 'medium', // First 3 are high priority
      details: null,
    };
  });
}

/**
 * Transform competitors array to frontend expected format
 */
function transformCompetitors(
  competitors: string[],
  mentions: Record<string, number>
): Array<{
  name: string;
  mentionCount: number;
  sentiment: number;
}> {
  if (!Array.isArray(competitors)) return [];

  return competitors.map(name => ({
    name,
    mentionCount: mentions[name] || 0,
    sentiment: 0.5, // Default neutral sentiment (0-1 scale)
  }));
}

/**
 * GET /api/audit/current
 * Get the latest audit for the authenticated user
 */
router.get(
  '/current',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      // Get the latest audit for this user from dashboard_data
      const result = await db.query(`
        SELECT dd.*, av.status as audit_status, av.completed_at as audit_completed_at
        FROM dashboard_data dd
        LEFT JOIN ai_visibility_audits av ON av.id = dd.audit_id
        WHERE dd.user_id = $1
        ORDER BY dd.created_at DESC
        LIMIT 1
      `, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'No audit found',
          message: 'No audits available for this user'
        });
      }

      const auditData = transformDashboardDataToAuditFormat(result.rows[0]);

      logger.info(`Retrieved current audit ${auditData.id} for user ${userId}`);

      res.json(auditData);
    } catch (error) {
      logger.error('Failed to fetch current audit:', error);
      res.status(500).json({
        error: 'Failed to fetch audit data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * GET /api/audit/:auditId/responses
 * Get all responses for a specific audit
 */
router.get(
  '/:auditId/responses',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { auditId } = req.params;
    const userId = (req as any).user?.id;

    try {
      // Verify user has access to this audit
      const accessCheck = await db.query(
        `SELECT 1 FROM dashboard_data WHERE audit_id = $1 AND user_id = $2`,
        [auditId, userId]
      );

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied to this audit' });
      }

      // Get all responses for this audit
      const result = await db.query(`
        SELECT
          ar.id,
          ar.query_id,
          ar.provider,
          ar.response_text,
          ar.brand_mentioned,
          ar.sentiment,
          ar.geo_score,
          ar.sov_score,
          ar.response_time_ms as response_time,
          ar.competitors_mentioned,
          ar.created_at,
          aq.query_text,
          aq.category as query_category
        FROM audit_responses ar
        LEFT JOIN audit_queries aq ON aq.id = ar.query_id
        WHERE ar.audit_id = $1
        ORDER BY ar.created_at DESC
      `, [auditId]);

      logger.info(`Retrieved ${result.rows.length} responses for audit ${auditId}`);

      res.json({
        auditId,
        total: result.rows.length,
        responses: result.rows.map(row => ({
          id: row.id,
          queryId: row.query_id,
          queryText: row.query_text,
          queryCategory: row.query_category,
          provider: row.provider,
          responseText: row.response_text,
          brandMentioned: row.brand_mentioned,
          sentiment: row.sentiment || 'neutral',
          geoScore: row.geo_score,
          sovScore: row.sov_score,
          responseTime: row.response_time,
          competitorsMentioned: row.competitors_mentioned || [],
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      logger.error(`Failed to fetch responses for audit ${auditId}:`, error);
      res.status(500).json({
        error: 'Failed to fetch responses',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * GET /api/audit/:auditId/insights
 * Get insights for a specific audit
 */
router.get(
  '/:auditId/insights',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { auditId } = req.params;
    const userId = (req as any).user?.id;

    try {
      // Verify user has access to this audit
      const result = await db.query(`
        SELECT
          dd.key_insights,
          dd.opportunity_areas,
          dd.risk_areas,
          dd.top_recommendations,
          dd.quick_wins,
          dd.executive_summary,
          dd.personalized_narrative
        FROM dashboard_data dd
        WHERE dd.audit_id = $1 AND dd.user_id = $2
      `, [auditId, userId]);

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied to this audit' });
      }

      const data = result.rows[0];

      logger.info(`Retrieved insights for audit ${auditId}`);

      res.json({
        auditId,
        insights: transformInsights(data.key_insights || []),
        opportunities: data.opportunity_areas || [],
        risks: data.risk_areas || [],
        recommendations: data.top_recommendations || [],
        quickWins: data.quick_wins || [],
        executiveSummary: data.executive_summary || '',
        narrative: data.personalized_narrative || '',
      });
    } catch (error) {
      logger.error(`Failed to fetch insights for audit ${auditId}:`, error);
      res.status(500).json({
        error: 'Failed to fetch insights',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * GET /api/audit/:auditId/queries
 * Get all queries for a specific audit
 */
router.get(
  '/:auditId/queries',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { auditId } = req.params;
    const userId = (req as any).user?.id;

    try {
      // Verify user has access to this audit
      const accessCheck = await db.query(
        `SELECT 1 FROM dashboard_data WHERE audit_id = $1 AND user_id = $2`,
        [auditId, userId]
      );

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied to this audit' });
      }

      // Get all queries for this audit
      const result = await db.query(`
        SELECT
          aq.id,
          aq.query_text,
          aq.category,
          aq.intent,
          aq.created_at,
          COUNT(ar.id) as response_count
        FROM audit_queries aq
        LEFT JOIN audit_responses ar ON ar.query_id = aq.id
        WHERE aq.audit_id = $1
        GROUP BY aq.id, aq.query_text, aq.category, aq.intent, aq.created_at
        ORDER BY aq.created_at DESC
      `, [auditId]);

      logger.info(`Retrieved ${result.rows.length} queries for audit ${auditId}`);

      res.json({
        auditId,
        total: result.rows.length,
        queries: result.rows.map(row => ({
          id: row.id,
          queryText: row.query_text,
          category: row.category,
          intent: row.intent,
          responseCount: parseInt(row.response_count) || 0,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      logger.error(`Failed to fetch queries for audit ${auditId}:`, error);
      res.status(500).json({
        error: 'Failed to fetch queries',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * GET /api/audit/by-token/:auditId
 * Get audit data using a shareable token (no JWT auth required)
 */
router.get(
  '/by-token/:auditId',
  asyncHandler(async (req: Request, res: Response) => {
    const { auditId } = req.params;
    const token = req.headers['x-access-token'] as string;

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    try {
      // Import crypto for token verification
      const crypto = require('crypto');
      const tokenSecret = process.env.REPORT_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

      // Decode and verify token
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const [message, signature] = decoded.split('.');

      if (!message || !signature) {
        return res.status(400).json({ error: 'Invalid token format' });
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', tokenSecret)
        .update(message)
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid token signature' });
      }

      // Parse payload
      const payload = JSON.parse(message);

      // Verify audit ID matches
      if (payload.auditId !== auditId) {
        return res.status(403).json({ error: 'Token does not grant access to this audit' });
      }

      // Calculate token hash
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Check token in database
      const reportRequest = await db.query(`
        SELECT * FROM report_requests
        WHERE email_token_hash = $1
      `, [tokenHash]);

      if (reportRequest.rows.length === 0) {
        return res.status(404).json({ error: 'Token not found or invalid' });
      }

      const report = reportRequest.rows[0];

      // Check if token has expired
      if (report.token_expires_at && new Date() > new Date(report.token_expires_at)) {
        return res.status(401).json({ error: 'Token has expired' });
      }

      // Get the audit data from dashboard_data
      const result = await db.query(`
        SELECT dd.*, av.status as audit_status, av.completed_at as audit_completed_at
        FROM dashboard_data dd
        LEFT JOIN ai_visibility_audits av ON av.id = dd.audit_id
        WHERE dd.audit_id = $1
        LIMIT 1
      `, [auditId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Audit not found',
          message: 'No audit data available for this ID'
        });
      }

      const auditData: any = transformDashboardDataToAuditFormat(result.rows[0]);

      // Fetch queries and responses in parallel
      const [queriesResult, responsesResult] = await Promise.all([
        db.query(`
          SELECT
            aq.id,
            aq.query_text,
            aq.category,
            aq.intent,
            aq.created_at,
            COUNT(ar.id) as response_count
          FROM audit_queries aq
          LEFT JOIN audit_responses ar ON ar.query_id = aq.id
          WHERE aq.audit_id = $1
          GROUP BY aq.id, aq.query_text, aq.category, aq.intent, aq.created_at
          ORDER BY aq.created_at DESC
        `, [auditId]),
        db.query(`
          SELECT
            ar.id,
            ar.query_id,
            ar.provider,
            ar.response_text,
            ar.brand_mentioned,
            ar.sentiment,
            ar.geo_score,
            ar.sov_score,
            ar.response_time_ms as response_time,
            ar.competitors_mentioned,
            ar.created_at,
            aq.query_text,
            aq.category as query_category
          FROM audit_responses ar
          LEFT JOIN audit_queries aq ON aq.id = ar.query_id
          WHERE ar.audit_id = $1
          ORDER BY ar.created_at DESC
        `, [auditId])
      ]);

      // Add queries and responses to audit data
      auditData.queries = queriesResult.rows.map(row => ({
        id: row.id,
        text: row.query_text,
        category: row.category,
        intent: row.intent,
        responseCount: parseInt(row.response_count) || 0,
        createdAt: row.created_at,
      }));

      auditData.responses = responsesResult.rows.map(row => ({
        id: row.id,
        query_id: row.query_id,
        query_text: row.query_text,
        provider: row.provider,
        response_text: row.response_text,
        brand_mentioned: row.brand_mentioned,
        sentiment: row.sentiment || 'neutral',
        recommendation_strength: Math.round(row.sov_score || 0),
        competitors_mentioned: row.competitors_mentioned || [],
        created_at: row.created_at,
      }));

      logger.info(`Retrieved audit ${auditId} with ${queriesResult.rows.length} queries and ${responsesResult.rows.length} responses via token access`);

      res.json(auditData);
    } catch (error) {
      logger.error('Failed to fetch audit data by token:', error);
      res.status(500).json({
        error: 'Failed to fetch audit data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;

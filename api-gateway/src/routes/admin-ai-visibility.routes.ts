import { Router, Response } from 'express';
import { db } from '../database/connection';
import { asyncHandler } from '../utils/async-handler';
import { logger } from '../utils/logger';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * Admin endpoint to view historical AI queries for a company
 * This is READ-ONLY - no generation happens here
 */
router.get(
  '/company/:companyId/historical-queries',
  authenticate,
  requireAdmin, // Only admins can view this data
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { companyId } = req.params;
    const { limit = 50, offset = 0, reportId } = req.query;

    logger.info(`Admin fetching historical queries for company ${companyId}`);

    try {
      // Use the admin view we created in the migration
      let query = `
        SELECT 
          q.*,
          json_agg(
            json_build_object(
              'provider', r.provider,
              'brand_mentioned', r.brand_mentioned,
              'sentiment', r.sentiment,
              'sentiment_score', r.sentiment_score,
              'response_snippet', LEFT(r.response_text, 200)
            ) ORDER BY r.provider
          ) FILTER (WHERE r.id IS NOT NULL) as responses
        FROM admin_historical_queries q
        LEFT JOIN audit_responses r ON q.query_id = r.query_id
        WHERE q.company_id = $1
      `;

      const params: any[] = [companyId];
      
      // Optional filter by specific report
      if (reportId) {
        query += ` AND q.report_id = $${params.length + 1}`;
        params.push(reportId);
      }

      query += `
        GROUP BY 
          q.id, q.company_id, q.query_id, q.query_text, q.intent,
          q.buyer_journey_stage, q.complexity_score, q.competitive_relevance,
          q.priority_score, q.created_at, q.report_id, q.report_generated_at,
          q.report_score, q.response_count, q.brand_mention_count, q.avg_sentiment_score
        ORDER BY q.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      params.push(limit, offset);

      const queriesResult = await db.query(query, params);

      // Get summary statistics
      const statsResult = await db.query(
        `SELECT 
          COUNT(DISTINCT q.id) as total_queries,
          COUNT(DISTINCT q.report_id) as total_reports,
          AVG(q.complexity_score) as avg_complexity,
          AVG(q.competitive_relevance) as avg_relevance,
          AVG(q.priority_score) as avg_priority,
          SUM(q.brand_mention_count) as total_brand_mentions,
          AVG(q.avg_sentiment_score) as overall_sentiment
         FROM admin_historical_queries q
         WHERE q.company_id = $1`,
        [companyId]
      );

      // Get latest report info
      const latestReportResult = await db.query(
        `SELECT 
          report_id,
          generated_at,
          overall_visibility_score,
          brand_mention_rate,
          competitive_position,
          platform_scores
         FROM ai_visibility_reports
         WHERE company_id = $1
         ORDER BY generated_at DESC
         LIMIT 1`,
        [companyId]
      );

      res.json({
        company_id: parseInt(companyId as string),
        queries: queriesResult.rows.map(q => ({
          id: q.query_id,
          query_text: q.query_text,
          intent: q.intent,
          complexity_score: parseFloat(q.complexity_score || 0),
          competitive_relevance: parseFloat(q.competitive_relevance || 0),
          buyer_journey_stage: q.buyer_journey_stage,
          priority_score: parseFloat(q.priority_score || 0),
          created_at: q.created_at,
          report_id: q.report_id,
          report_generated_at: q.report_generated_at,
          responses: q.responses || [],
          brand_mention_count: q.brand_mention_count,
          avg_sentiment_score: q.avg_sentiment_score,
        })),
        total: queriesResult.rows.length,
        statistics: statsResult.rows[0],
        latest_report: latestReportResult.rows[0] || null,
        fetched_at: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to fetch historical queries:', error);
      
      // Return empty data if tables don't exist yet
      res.json({
        company_id: parseInt(companyId as string),
        queries: [],
        total: 0,
        statistics: null,
        latest_report: null,
        fetched_at: new Date().toISOString(),
        error: 'Historical data not available',
      });
    }
  })
);

/**
 * Get AI visibility reports for a company
 */
router.get(
  '/company/:companyId/reports',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { companyId } = req.params;

    const reportsResult = await db.query(
      `SELECT 
        report_id,
        trigger_source,
        generated_at,
        processing_time_seconds,
        queries_generated,
        total_llm_calls,
        overall_visibility_score,
        brand_mention_rate,
        positive_sentiment_rate,
        competitive_position,
        platform_scores
       FROM ai_visibility_reports
       WHERE company_id = $1
       ORDER BY generated_at DESC
       LIMIT 10`,
      [companyId]
    );

    res.json({
      company_id: parseInt(companyId as string),
      reports: reportsResult.rows,
      total: reportsResult.rows.length,
    });
  })
);

/**
 * Get detailed AI visibility report
 */
router.get(
  '/report/:reportId',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { reportId } = req.params;

    const reportResult = await db.query(
      `SELECT * FROM ai_visibility_reports WHERE report_id = $1`,
      [reportId]
    );

    if (!reportResult.rows[0]) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];

    // Get queries for this report
    const queriesResult = await db.query(
      `SELECT aq.* FROM audit_queries aq
       JOIN report_audit_mapping ram ON aq.audit_id = ram.audit_id
       WHERE ram.report_id = $1
       ORDER BY aq.priority_score DESC`,
      [reportId]
    );

    // Get response statistics
    const responseStatsResult = await db.query(
      `SELECT
        provider,
        COUNT(*) as total_responses,
        SUM(CASE WHEN brand_mentioned THEN 1 ELSE 0 END) as brand_mentions,
        AVG(sentiment_score) as avg_sentiment
       FROM audit_responses ar
       JOIN audit_queries aq ON ar.query_id = aq.id
       WHERE aq.audit_id = (SELECT audit_id FROM report_audit_mapping WHERE report_id = $1)
       GROUP BY provider`,
      [reportId]
    );

    res.json({
      report,
      queries: queriesResult.rows,
      response_statistics: responseStatsResult.rows,
    });
  })
);

/**
 * Get competitive visibility data
 */
router.get(
  '/company/:companyId/competitive-visibility',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { companyId } = req.params;

    const competitiveResult = await db.query(
      `SELECT 
        competitor_name,
        SUM(mention_count) as total_mentions,
        SUM(co_mention_count) as co_mentions,
        SUM(wins) as wins,
        SUM(losses) as losses,
        SUM(ties) as ties,
        AVG(relative_visibility_score) as avg_relative_score
       FROM competitive_visibility
       WHERE company_id = $1
       GROUP BY competitor_name
       ORDER BY total_mentions DESC`,
      [companyId]
    );

    res.json({
      company_id: parseInt(companyId as string),
      competitors: competitiveResult.rows,
    });
  })
);

export default router;
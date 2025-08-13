import { Router } from 'express';
import { Database } from '../../lib/database';
import { asyncHandler } from '../middleware/async-handler';
import { validateRequest } from '../middleware/validation';
import { param, query } from 'express-validator';

export function executionRouter(db: Database): Router {
  const router = Router();

  // Get all executions
  router.get('/',
    query('recommendationId').optional().isUUID(),
    query('platform').optional().isString(),
    query('status').optional().isIn(['success', 'failed', 'pending']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const {
        recommendationId,
        platform,
        status,
        limit = 50,
        offset = 0,
        startDate,
        endDate
      } = req.query;

      let queryStr = 'SELECT * FROM action_center.execution_log WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (recommendationId) {
        queryStr += ` AND recommendation_id = $${paramIndex++}`;
        params.push(recommendationId);
      }

      if (platform) {
        queryStr += ` AND platform = $${paramIndex++}`;
        params.push(platform);
      }

      if (status) {
        queryStr += ` AND status = $${paramIndex++}`;
        params.push(status);
      }

      if (startDate) {
        queryStr += ` AND created_at >= $${paramIndex++}`;
        params.push(startDate);
      }

      if (endDate) {
        queryStr += ` AND created_at <= $${paramIndex++}`;
        params.push(endDate);
      }

      queryStr += ` ORDER BY created_at DESC`;
      queryStr += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(limit, offset);

      const result = await db.pool.query(queryStr, params);

      res.json({
        data: result.rows,
        meta: {
          total: result.rowCount,
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    })
  );

  // Get execution details
  router.get('/:id',
    param('id').isUUID(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { id } = req.params;

      const result = await db.pool.query(`
        SELECT 
          el.*,
          r.title as recommendation_title,
          r.type as recommendation_type
        FROM action_center.execution_log el
        JOIN action_center.recommendations r ON el.recommendation_id = r.id
        WHERE el.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Execution not found'
        });
      }

      res.json(result.rows[0]);
    })
  );

  // Get execution statistics
  router.get('/stats/summary',
    query('brandId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { brandId, startDate, endDate } = req.query;

      let queryStr = `
        SELECT 
          COUNT(*) as total_executions,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          AVG(execution_time_ms) as avg_execution_time,
          MAX(execution_time_ms) as max_execution_time,
          MIN(execution_time_ms) as min_execution_time,
          COUNT(DISTINCT platform) as platforms_used,
          COUNT(DISTINCT recommendation_id) as unique_recommendations
        FROM action_center.execution_log el
      `;

      const conditions = [];
      const params = [];
      let paramIndex = 1;

      if (brandId) {
        conditions.push(`EXISTS (
          SELECT 1 FROM action_center.recommendations r 
          WHERE r.id = el.recommendation_id AND r.brand_id = $${paramIndex++}
        )`);
        params.push(brandId);
      }

      if (startDate) {
        conditions.push(`el.created_at >= $${paramIndex++}`);
        params.push(startDate);
      }

      if (endDate) {
        conditions.push(`el.created_at <= $${paramIndex++}`);
        params.push(endDate);
      }

      if (conditions.length > 0) {
        queryStr += ' WHERE ' + conditions.join(' AND ');
      }

      const result = await db.pool.query(queryStr, params);

      // Get platform breakdown
      let platformQuery = `
        SELECT 
          platform,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
          AVG(execution_time_ms) as avg_time
        FROM action_center.execution_log el
      `;

      if (conditions.length > 0) {
        platformQuery += ' WHERE ' + conditions.join(' AND ');
      }

      platformQuery += ' GROUP BY platform';

      const platformResult = await db.pool.query(platformQuery, params);

      res.json({
        summary: result.rows[0],
        platformBreakdown: platformResult.rows
      });
    })
  );

  // Get transaction details
  router.get('/transactions/:transactionId',
    param('transactionId').isUUID(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { transactionId } = req.params;

      const result = await db.pool.query(`
        SELECT 
          t.*,
          r.title as recommendation_title
        FROM action_center.transactions t
        JOIN action_center.recommendations r ON t.recommendation_id = r.id
        WHERE t.id = $1
      `, [transactionId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Transaction not found'
        });
      }

      res.json(result.rows[0]);
    })
  );

  return router;
}
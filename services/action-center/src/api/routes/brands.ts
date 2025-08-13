import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../../lib/database';
import { logger } from '../../lib/logger';
import { asyncHandler } from '../middleware/async-handler';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

export function brandRouter(db: Database): Router {
  const router = Router();

  // Get all brands
  router.get('/',
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { limit = 50, offset = 0 } = req.query;

      const result = await db.pool.query(`
        SELECT * FROM action_center.brands
        ORDER BY name ASC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

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

  // Get single brand
  router.get('/:id',
    param('id').isUUID(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { id } = req.params;

      const result = await db.pool.query(`
        SELECT * FROM action_center.brands WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Brand not found'
        });
      }

      res.json(result.rows[0]);
    })
  );

  // Create brand
  router.post('/',
    body('name').isString().notEmpty().isLength({ max: 255 }),
    body('domain').optional().isURL(),
    body('platform').optional().isString(),
    body('tone').optional().isString(),
    body('keywords').optional().isArray(),
    body('competitors').optional().isArray(),
    body('settings').optional().isObject(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const id = uuidv4();
      const {
        name,
        domain,
        platform,
        tone,
        keywords,
        competitors,
        settings
      } = req.body;

      await db.pool.query(`
        INSERT INTO action_center.brands (
          id, name, domain, platform, tone, keywords, competitors, settings
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id,
        name,
        domain,
        platform,
        tone,
        keywords || [],
        competitors || [],
        JSON.stringify(settings || {
          autoExecutionEnabled: false,
          approvedTypes: [],
          maxDailyExecutions: 10,
          draftModeOnly: true,
          notificationChannels: []
        })
      ]);

      logger.info(`Created brand ${id}: ${name}`);

      const created = await db.pool.query(
        'SELECT * FROM action_center.brands WHERE id = $1',
        [id]
      );

      res.status(201).json(created.rows[0]);
    })
  );

  // Update brand
  router.patch('/:id',
    param('id').isUUID(),
    body('name').optional().isString().isLength({ max: 255 }),
    body('domain').optional().isURL(),
    body('platform').optional().isString(),
    body('tone').optional().isString(),
    body('keywords').optional().isArray(),
    body('competitors').optional().isArray(),
    body('settings').optional().isObject(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const updates = req.body;

      // Check if brand exists
      const existing = await db.pool.query(
        'SELECT * FROM action_center.brands WHERE id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Brand not found'
        });
      }

      // Build update query
      const updateFields = [];
      const values = [];
      let valueIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = $${valueIndex++}`);
          if (key === 'settings') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
        }
      });

      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        values.push(id);

        await db.pool.query(`
          UPDATE action_center.brands
          SET ${updateFields.join(', ')}
          WHERE id = $${valueIndex}
        `, values);
      }

      const updated = await db.pool.query(
        'SELECT * FROM action_center.brands WHERE id = $1',
        [id]
      );

      res.json(updated.rows[0]);
    })
  );

  // Delete brand
  router.delete('/:id',
    param('id').isUUID(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { id } = req.params;

      // Check if brand has recommendations
      const hasRecommendations = await db.pool.query(`
        SELECT COUNT(*) as count FROM action_center.recommendations
        WHERE brand_id = $1
      `, [id]);

      if (parseInt(hasRecommendations.rows[0].count) > 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Cannot delete brand with existing recommendations'
        });
      }

      const result = await db.pool.query(
        'DELETE FROM action_center.brands WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Brand not found'
        });
      }

      logger.info(`Deleted brand ${id}`);
      res.status(204).send();
    })
  );

  // Get brand recommendations
  router.get('/:id/recommendations',
    param('id').isUUID(),
    query('status').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { status, limit = 100 } = req.query;

      let queryStr = `
        SELECT r.*, rc.content
        FROM action_center.recommendations r
        LEFT JOIN action_center.recommendation_content rc ON r.id = rc.recommendation_id
        WHERE r.brand_id = $1
      `;

      const params = [id];

      if (status) {
        queryStr += ' AND r.status = $2';
        params.push(status as string);
      }

      queryStr += ' ORDER BY r.priority DESC, r.created_at DESC';
      queryStr += ` LIMIT $${params.length + 1}`;
      params.push(limit as any);

      const result = await db.pool.query(queryStr, params);

      res.json(result.rows);
    })
  );

  // Get brand statistics
  router.get('/:id/stats',
    param('id').isUUID(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { id } = req.params;

      // Get recommendation stats
      const recStats = await db.pool.query(`
        SELECT 
          COUNT(*) as total_recommendations,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'executing' THEN 1 END) as executing,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          AVG(priority) as avg_priority,
          AVG(estimated_impact) as avg_impact
        FROM action_center.recommendations
        WHERE brand_id = $1
      `, [id]);

      // Get execution stats
      const execStats = await db.pool.query(`
        SELECT 
          COUNT(*) as total_executions,
          COUNT(CASE WHEN el.status = 'success' THEN 1 END) as successful,
          COUNT(CASE WHEN el.status = 'failed' THEN 1 END) as failed,
          AVG(el.execution_time_ms) as avg_execution_time
        FROM action_center.execution_log el
        JOIN action_center.recommendations r ON el.recommendation_id = r.id
        WHERE r.brand_id = $1
      `, [id]);

      // Get recent activity
      const recentActivity = await db.pool.query(`
        SELECT 
          'recommendation' as type,
          id,
          title,
          created_at as timestamp
        FROM action_center.recommendations
        WHERE brand_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [id]);

      res.json({
        recommendations: recStats.rows[0],
        executions: execStats.rows[0],
        recentActivity: recentActivity.rows
      });
    })
  );

  return router;
}
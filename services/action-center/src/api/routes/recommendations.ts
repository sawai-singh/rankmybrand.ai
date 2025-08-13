import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../../lib/database';
import { Recommendation } from '../../types';
import { logger } from '../../lib/logger';
import { asyncHandler } from '../middleware/async-handler';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

export function recommendationRouter(db: Database): Router {
  const router = Router();

  // Get all recommendations with filtering
  router.get('/',
    query('brandId').optional().isUUID(),
    query('status').optional().isIn(['pending', 'approved', 'executing', 'completed', 'failed']),
    query('type').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('sortBy').optional().isIn(['priority', 'createdAt', 'estimatedImpact']),
    query('order').optional().isIn(['asc', 'desc']),
    validateRequest,
    asyncHandler(async (req, res) => {
      const {
        brandId,
        status,
        type,
        limit = 50,
        offset = 0,
        sortBy = 'priority',
        order = 'desc'
      } = req.query;

      // Build query
      let query = 'SELECT r.*, rc.content FROM action_center.recommendations r';
      query += ' LEFT JOIN action_center.recommendation_content rc ON r.id = rc.recommendation_id';
      
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      if (brandId) {
        conditions.push(`r.brand_id = $${paramIndex++}`);
        params.push(brandId);
      }

      if (status) {
        conditions.push(`r.status = $${paramIndex++}`);
        params.push(status);
      }

      if (type) {
        conditions.push(`r.type = $${paramIndex++}`);
        params.push(type);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Add sorting
      const sortColumn = sortBy === 'createdAt' ? 'created_at' :
                        sortBy === 'estimatedImpact' ? 'estimated_impact' :
                        'priority';
      query += ` ORDER BY r.${sortColumn} ${order.toString().toUpperCase()}`;

      // Add pagination
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(limit, offset);

      const result = await db.pool.query(query, params);

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

  // Get single recommendation
  router.get('/:id',
    param('id').isUUID(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const recommendation = await db.getRecommendation(req.params.id);
      
      if (!recommendation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Recommendation not found'
        });
      }

      res.json(recommendation);
    })
  );

  // Create recommendation manually
  router.post('/',
    body('brandId').isUUID(),
    body('type').isString().notEmpty(),
    body('title').isString().notEmpty().isLength({ max: 500 }),
    body('description').optional().isString(),
    body('priority').optional().isInt({ min: 0, max: 100 }),
    body('estimatedImpact').optional().isFloat({ min: 0, max: 100 }),
    body('implementationEffort').optional().isIn(['low', 'medium', 'high']),
    body('autoExecutable').optional().isBoolean(),
    body('content').optional().isString(),
    body('metadata').optional().isObject(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const recommendation: Recommendation = {
        id: uuidv4(),
        brandId: req.body.brandId,
        type: req.body.type,
        subtype: req.body.subtype,
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority || 50,
        estimatedImpact: req.body.estimatedImpact,
        implementationEffort: req.body.implementationEffort,
        autoExecutable: req.body.autoExecutable || false,
        status: 'pending',
        content: req.body.content,
        metadata: req.body.metadata || {},
        createdAt: new Date()
      };

      await db.saveRecommendation(recommendation);

      logger.info(`Created manual recommendation ${recommendation.id}`);

      res.status(201).json(recommendation);
    })
  );

  // Update recommendation
  router.patch('/:id',
    param('id').isUUID(),
    body('status').optional().isIn(['pending', 'approved', 'executing', 'completed', 'failed']),
    body('priority').optional().isInt({ min: 0, max: 100 }),
    body('metadata').optional().isObject(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const updates = req.body;

      const recommendation = await db.getRecommendation(id);
      if (!recommendation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Recommendation not found'
        });
      }

      // Update fields
      if (updates.status) {
        await db.updateRecommendationStatus(id, updates.status);
      }

      if (updates.priority !== undefined || updates.metadata) {
        await db.pool.query(`
          UPDATE action_center.recommendations
          SET 
            ${updates.priority !== undefined ? 'priority = $2,' : ''}
            ${updates.metadata ? 'metadata = $3,' : ''}
            updated_at = NOW()
          WHERE id = $1
        `, [
          id,
          updates.priority,
          updates.metadata ? JSON.stringify(updates.metadata) : undefined
        ].filter(Boolean));
      }

      const updated = await db.getRecommendation(id);
      res.json(updated);
    })
  );

  // Delete recommendation
  router.delete('/:id',
    param('id').isUUID(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { id } = req.params;

      const recommendation = await db.getRecommendation(id);
      if (!recommendation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Recommendation not found'
        });
      }

      // Delete recommendation and related data
      await db.pool.query('BEGIN');
      try {
        await db.pool.query('DELETE FROM action_center.recommendation_content WHERE recommendation_id = $1', [id]);
        await db.pool.query('DELETE FROM action_center.execution_log WHERE recommendation_id = $1', [id]);
        await db.pool.query('DELETE FROM action_center.approval_workflow WHERE recommendation_id = $1', [id]);
        await db.pool.query('DELETE FROM action_center.implementation_tracking WHERE recommendation_id = $1', [id]);
        await db.pool.query('DELETE FROM action_center.recommendations WHERE id = $1', [id]);
        await db.pool.query('COMMIT');

        logger.info(`Deleted recommendation ${id}`);
        res.status(204).send();
      } catch (error) {
        await db.pool.query('ROLLBACK');
        throw error;
      }
    })
  );

  // Get execution history for recommendation
  router.get('/:id/executions',
    param('id').isUUID(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { id } = req.params;

      const result = await db.pool.query(`
        SELECT * FROM action_center.execution_log
        WHERE recommendation_id = $1
        ORDER BY created_at DESC
      `, [id]);

      res.json(result.rows);
    })
  );

  // Execute recommendation manually
  router.post('/:id/execute',
    param('id').isUUID(),
    body('force').optional().isBoolean(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { force } = req.body;

      const recommendation = await db.getRecommendation(id);
      if (!recommendation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Recommendation not found'
        });
      }

      if (!recommendation.autoExecutable && !force) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Recommendation is not auto-executable. Use force=true to override.'
        });
      }

      // Queue for execution
      // In a real implementation, this would add to the execution queue
      await db.updateRecommendationStatus(id, 'executing');

      res.json({
        message: 'Recommendation queued for execution',
        recommendationId: id
      });
    })
  );

  return router;
}
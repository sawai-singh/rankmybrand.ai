import { Router } from 'express';
import { Database } from '../../lib/database';
import { logger } from '../../lib/logger';
import { asyncHandler } from '../middleware/async-handler';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

export function approvalRouter(db: Database): Router {
  const router = Router();

  // Get pending approvals
  router.get('/pending',
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { limit = 50, offset = 0 } = req.query;

      const result = await db.pool.query(`
        SELECT 
          aw.*,
          r.title as recommendation_title,
          r.type as recommendation_type,
          r.priority,
          r.estimated_impact,
          r.brand_id
        FROM action_center.approval_workflow aw
        JOIN action_center.recommendations r ON aw.recommendation_id = r.id
        WHERE aw.approval_status = 'pending'
        ORDER BY r.priority DESC, aw.requested_at DESC
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

  // Approve recommendation
  router.post('/:recommendationId/approve',
    param('recommendationId').isUUID(),
    body('approvedBy').isString().notEmpty(),
    body('notes').optional().isString(),
    body('executeImmediately').optional().isBoolean(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { recommendationId } = req.params;
      const { approvedBy, notes, executeImmediately } = req.body;

      // Check if recommendation exists
      const recommendation = await db.getRecommendation(recommendationId);
      if (!recommendation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Recommendation not found'
        });
      }

      // Check if there's a pending approval
      const pendingApproval = await db.pool.query(`
        SELECT * FROM action_center.approval_workflow
        WHERE recommendation_id = $1 AND approval_status = 'pending'
      `, [recommendationId]);

      if (pendingApproval.rows.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'No pending approval found for this recommendation'
        });
      }

      // Approve the recommendation
      await db.approveRecommendation(recommendationId, approvedBy, notes);

      // If executeImmediately is true, queue for execution
      if (executeImmediately) {
        await db.updateRecommendationStatus(recommendationId, 'executing');
        // In a real implementation, this would add to the execution queue
      }

      logger.info(`Recommendation ${recommendationId} approved by ${approvedBy}`);

      res.json({
        message: 'Recommendation approved successfully',
        recommendationId,
        executeImmediately: executeImmediately || false
      });
    })
  );

  // Reject recommendation
  router.post('/:recommendationId/reject',
    param('recommendationId').isUUID(),
    body('rejectedBy').isString().notEmpty(),
    body('reason').isString().notEmpty(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { recommendationId } = req.params;
      const { rejectedBy, reason } = req.body;

      // Check if recommendation exists
      const recommendation = await db.getRecommendation(recommendationId);
      if (!recommendation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Recommendation not found'
        });
      }

      // Update approval workflow
      await db.pool.query(`
        UPDATE action_center.approval_workflow
        SET 
          approval_status = 'rejected',
          approved_by = $2,
          approval_notes = $3,
          responded_at = NOW()
        WHERE recommendation_id = $1 AND approval_status = 'pending'
      `, [recommendationId, rejectedBy, reason]);

      // Update recommendation status
      await db.updateRecommendationStatus(recommendationId, 'rejected');

      logger.info(`Recommendation ${recommendationId} rejected by ${rejectedBy}`);

      res.json({
        message: 'Recommendation rejected',
        recommendationId,
        reason
      });
    })
  );

  // Get approval history
  router.get('/history',
    query('brandId').optional().isUUID(),
    query('status').optional().isIn(['approved', 'rejected']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { brandId, status, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT 
          aw.*,
          r.title as recommendation_title,
          r.type as recommendation_type,
          r.brand_id
        FROM action_center.approval_workflow aw
        JOIN action_center.recommendations r ON aw.recommendation_id = r.id
        WHERE aw.approval_status != 'pending'
      `;

      const params = [];
      let paramIndex = 1;

      if (brandId) {
        query += ` AND r.brand_id = $${paramIndex++}`;
        params.push(brandId);
      }

      if (status) {
        query += ` AND aw.approval_status = $${paramIndex++}`;
        params.push(status);
      }

      query += ` ORDER BY aw.responded_at DESC`;
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

  // Bulk approve
  router.post('/bulk-approve',
    body('recommendationIds').isArray().notEmpty(),
    body('recommendationIds.*').isUUID(),
    body('approvedBy').isString().notEmpty(),
    body('notes').optional().isString(),
    validateRequest,
    asyncHandler(async (req, res) => {
      const { recommendationIds, approvedBy, notes } = req.body;

      const approved = [];
      const failed = [];

      for (const id of recommendationIds) {
        try {
          await db.approveRecommendation(id, approvedBy, notes);
          approved.push(id);
        } catch (error) {
          logger.error(`Failed to approve recommendation ${id}:`, error);
          failed.push({ id, error: (error as Error).message });
        }
      }

      res.json({
        message: 'Bulk approval processed',
        approved,
        failed
      });
    })
  );

  return router;
}
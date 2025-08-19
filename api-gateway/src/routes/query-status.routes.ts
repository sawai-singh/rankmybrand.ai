import { Router, Request, Response } from 'express';
import { queryGenerationService } from '../services/query-generation.service';
import { db } from '../database/connection';
import { asyncHandler } from '../utils/async-handler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Check query generation status for a company
 */
router.get(
  '/company/:companyId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.params;
    
    // Check current status
    const status = queryGenerationService.getStatus(parseInt(companyId));
    
    // Check existing queries
    const result = await db.query(
      'SELECT COUNT(*) as count FROM ai_queries WHERE company_id = $1',
      [companyId]
    );
    
    const queryCount = result.rows[0]?.count || 0;
    
    res.json({
      company_id: parseInt(companyId),
      status: queryCount > 0 ? 'completed' : status,
      query_count: queryCount,
      message: queryCount > 0 
        ? `${queryCount} queries available` 
        : status === 'processing' 
          ? 'Query generation in progress'
          : status === 'pending'
            ? 'Query generation scheduled'
            : 'No queries generated yet'
    });
  })
);

/**
 * Manually trigger query generation for a company (admin endpoint)
 */
router.post(
  '/company/:companyId/generate',
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const { force } = req.body;
    
    logger.info(`Manual query generation requested for company ${companyId}`);
    
    // Check if queries already exist
    if (!force) {
      const existing = await db.query(
        'SELECT COUNT(*) as count FROM ai_queries WHERE company_id = $1',
        [companyId]
      );
      
      if (existing.rows[0]?.count > 0) {
        return res.status(400).json({
          error: 'Queries already exist for this company',
          count: existing.rows[0].count,
          message: 'Use force=true to regenerate'
        });
      }
    }
    
    // Schedule generation
    await queryGenerationService.scheduleQueryGeneration(parseInt(companyId));
    
    res.json({
      success: true,
      company_id: parseInt(companyId),
      message: 'Query generation scheduled'
    });
  })
);

export default router;
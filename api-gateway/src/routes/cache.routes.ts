/**
 * Cache Management Routes
 * Provides endpoints for monitoring and managing the cache system
 */

import { Router, Request, Response } from 'express';
import { cacheService } from '../services/cache.service';
import { asyncHandler } from '../utils/async-handler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get cache statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await cacheService.getStats();
    res.json(stats);
  })
);

/**
 * Clear specific cache type
 */
router.delete(
  '/clear/:type',
  asyncHandler(async (req: Request, res: Response) => {
    const { type } = req.params;
    const validTypes = ['company', 'scores', 'queries', 'metrics', 'heatmap', 'activities'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid cache type' });
    }

    await cacheService.clearType(type as any);
    logger.info(`Cache cleared for type: ${type}`);
    
    res.json({ 
      message: `Cache cleared for ${type}`,
      type 
    });
  })
);

/**
 * Invalidate specific cache entry
 */
router.delete(
  '/invalidate/:type/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { type, id } = req.params;
    const validTypes = ['company', 'scores', 'queries', 'metrics', 'heatmap', 'activities'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid cache type' });
    }

    await cacheService.invalidate(type as any, id);
    logger.info(`Cache invalidated for ${type}:${id}`);
    
    res.json({ 
      message: `Cache invalidated`,
      type,
      id 
    });
  })
);

export default router;
/**
 * Feedback Routes
 * Handles user feedback on scores and recommendations
 */

import { Router, Request, Response } from 'express';
import { feedbackService } from '../services/feedback.service';
import { asyncHandler } from '../utils/async-handler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Submit feedback on a score
 */
router.post(
  '/submit',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      companyId,
      scoreType,
      scoreValue,
      feedbackType,
      message,
      context
    } = req.body;

    // Validate required fields
    if (!companyId || !scoreType || !feedbackType) {
      return res.status(400).json({ 
        error: 'Company ID, score type, and feedback type are required' 
      });
    }

    // Validate score type
    const validScoreTypes = ['geo', 'sov', 'overall', 'recommendation'];
    if (!validScoreTypes.includes(scoreType)) {
      return res.status(400).json({ 
        error: 'Invalid score type. Must be: geo, sov, overall, or recommendation' 
      });
    }

    // Validate feedback type
    const validFeedbackTypes = ['confusing', 'helpful', 'incorrect', 'suggestion'];
    if (!validFeedbackTypes.includes(feedbackType)) {
      return res.status(400).json({ 
        error: 'Invalid feedback type. Must be: confusing, helpful, incorrect, or suggestion' 
      });
    }

    // Extract user info from token if available
    const userId = (req as any).user?.id || (req as any).user?.email;

    const feedbackId = await feedbackService.submitFeedback({
      userId,
      companyId,
      scoreType,
      scoreValue,
      feedbackType,
      message,
      context
    });

    // Check if we got an auto-response
    const isAutoResponse = feedbackId.length > 100; // Auto-responses are longer than UUIDs

    res.json({
      success: true,
      feedbackId: isAutoResponse ? null : feedbackId,
      message: isAutoResponse ? feedbackId : 'Thank you for your feedback!',
      autoResponse: isAutoResponse
    });
  })
);

/**
 * Get feedback statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.query;
    
    const stats = await feedbackService.getFeedbackStats(
      companyId ? parseInt(companyId as string) : undefined
    );

    res.json(stats);
  })
);

/**
 * Get recent feedback (admin)
 */
router.get(
  '/recent',
  asyncHandler(async (req: Request, res: Response) => {
    const { limit = 10 } = req.query;
    
    const feedback = await feedbackService.getRecentFeedback(
      parseInt(limit as string)
    );

    res.json({
      feedback,
      total: feedback.length
    });
  })
);

/**
 * Resolve feedback (admin)
 */
router.post(
  '/resolve/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({ error: 'Resolution notes are required' });
    }

    await feedbackService.resolveFeedback(id, notes);

    res.json({
      success: true,
      message: 'Feedback resolved'
    });
  })
);

/**
 * Quick feedback buttons (simplified submission)
 */
router.post(
  '/quick',
  asyncHandler(async (req: Request, res: Response) => {
    const { scoreType, reaction, companyId } = req.body;

    // Map reactions to feedback types
    const reactionMap: Record<string, string> = {
      '👍': 'helpful',
      '👎': 'incorrect',
      '❓': 'confusing',
      '💡': 'suggestion'
    };

    const feedbackType = reactionMap[reaction];
    if (!feedbackType) {
      return res.status(400).json({ error: 'Invalid reaction' });
    }

    const userId = (req as any).user?.id || (req as any).user?.email;

    const feedbackId = await feedbackService.submitFeedback({
      userId,
      companyId: companyId || 0,
      scoreType,
      feedbackType,
      message: `Quick reaction: ${reaction}`
    });

    res.json({
      success: true,
      message: 'Thanks for your feedback!'
    });
  })
);

export default router;
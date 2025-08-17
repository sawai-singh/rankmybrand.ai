import { Router, Request, Response } from 'express';
import { reportQueueService } from '../services/report-queue.service';
import { asyncHandler } from '../middleware/error.middleware';
import { body, validationResult } from 'express-validator';

const router = Router();

// Only enable routes if feature flag is set
const isFeatureEnabled = process.env.ENABLE_QUEUED_REPORT === 'true';

if (!isFeatureEnabled) {
  console.log('⚠️  Report queue routes disabled (ENABLE_QUEUED_REPORT=false)');
}

// Queue a report (idempotent)
router.post('/queue',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('companyName').notEmpty().withMessage('Company name is required'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!isFeatureEnabled) {
      return res.status(404).json({ error: 'Feature not enabled' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, companyId, sessionId, email, companyName, competitorCount, metadata } = req.body;

    const report = await reportQueueService.queueReport({
      userId,
      companyId,
      sessionId,
      email,
      companyName,
      competitorCount,
      metadata
    });

    if (report) {
      res.json({
        success: true,
        reportId: report.id,
        status: report.status,
        etaMinutes: report.eta_minutes,
        message: `Report queued. You'll receive an email at ${email} in about ${report.eta_minutes} minutes.`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to queue report'
      });
    }
  })
);

// Validate token from email link
router.post('/validate-token',
  [
    body('token').notEmpty().withMessage('Token is required'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!isFeatureEnabled) {
      return res.status(404).json({ error: 'Feature not enabled' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token } = req.body;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;

    const validation = await reportQueueService.validateToken(token);

    if (validation.valid && validation.data) {
      // Log analytics
      console.log(`Report link accessed: User ${validation.data.userId}, Report ${validation.data.reportId}`);
      
      res.json({
        valid: true,
        reportId: validation.data.reportId,
        companyId: validation.data.companyId,
        userId: validation.data.userId
      });
    } else {
      res.status(401).json({
        valid: false,
        error: 'Invalid or expired token'
      });
    }
  })
);

// Get report status
router.get('/status/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    if (!isFeatureEnabled) {
      return res.status(404).json({ error: 'Feature not enabled' });
    }

    const { userId } = req.params;
    const status = await reportQueueService.getReportStatus(userId);

    if (status) {
      res.json({
        found: true,
        ...status
      });
    } else {
      res.json({
        found: false
      });
    }
  })
);

// Update email preference (for generating page)
router.post('/update-email',
  [
    body('email').isEmail().withMessage('Valid email is required'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!isFeatureEnabled) {
      return res.status(404).json({ error: 'Feature not enabled' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, userId } = req.body;

    // In production, update user's email preference in database
    // For now, just acknowledge
    res.json({
      success: true,
      email,
      message: 'Email preference updated'
    });
  })
);

// Manual trigger for processing queue (dev/admin only)
if (process.env.NODE_ENV === 'development') {
  router.post('/process',
    asyncHandler(async (req: Request, res: Response) => {
      if (!isFeatureEnabled) {
        return res.status(404).json({ error: 'Feature not enabled' });
      }

      // Manually trigger queue processing
      await reportQueueService.processQueue();
      
      res.json({
        success: true,
        message: 'Queue processing triggered'
      });
    })
  );
}

export default router;
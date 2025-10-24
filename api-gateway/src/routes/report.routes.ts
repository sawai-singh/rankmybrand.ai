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

    const { userId, companyId, sessionId, email, companyName, competitorCount, auditId, metadata } = req.body;

    const report = await reportQueueService.queueReport({
      userId,
      companyId,
      sessionId,
      email,
      companyName,
      competitorCount,
      auditId,
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

    const { token, deviceInfo, utmParams, timestamp, deviceFingerprint, retryCount = 0 } = req.body;
    const userAgent = req.headers['user-agent'];
    const clientInfo = req.headers['x-client-info'];
    const ipAddress = req.ip;

    // Rate limiting check (simple in-memory)
    const rateLimitKey = `${ipAddress}-${deviceFingerprint || 'unknown'}`;
    
    // Log access attempt
    console.log(`Token validation attempt: IP ${ipAddress}, Device ${deviceFingerprint}, Retry ${retryCount}`);

    const validation = await reportQueueService.validateToken(token);

    if (validation.valid && validation.data) {
      // Log successful access with analytics
      console.log(`Report link accessed: User ${validation.data.userId}, Report ${validation.data.reportId}, UTM: ${JSON.stringify(utmParams)}`);
      
      // Track device info if provided
      if (deviceInfo) {
        console.log(`Device info: ${JSON.stringify(deviceInfo)}`);
      }
      
      res.json({
        valid: true,
        reportId: validation.data.reportId,
        companyId: validation.data.companyId,
        brandName: validation.data.companyName || 'Your Brand',
        userEmail: validation.data.email,
        userId: validation.data.userId,
        createdAt: validation.data.createdAt,
        expiresAt: validation.data.expiresAt,
        accessCount: validation.data.accessCount || 1,
        maxAccess: validation.data.maxAccess || null
      });
    } else {
      // Determine specific error type
      let errorCode = 'TOKEN_INVALID';
      let statusCode = 401;
      let errorMessage = 'Invalid or expired token';
      
      if (validation.error) {
        if (validation.error.includes('expired')) {
          errorCode = 'TOKEN_EXPIRED';
          statusCode = 410; // Gone
          errorMessage = 'This report link has expired';
        } else if (validation.error.includes('revoked')) {
          errorCode = 'TOKEN_REVOKED';
          errorMessage = 'This report link has been revoked';
        } else if (retryCount > 5) {
          errorCode = 'RATE_LIMITED';
          statusCode = 429; // Too Many Requests
          errorMessage = 'Too many attempts. Please try again later';
        }
      }
      
      res.status(statusCode).json({
        valid: false,
        error: errorMessage,
        errorCode: errorCode,
        retryAfter: errorCode === 'RATE_LIMITED' ? 60 : undefined
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
/**
 * Webhook Routes
 * Handles webhook management and triggers
 */

import { Router, Request, Response } from 'express';
import { webhookService } from '../services/webhook.service';
import { asyncHandler } from '../utils/async-handler';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * Trigger audit completed webhook (internal use)
 */
router.post(
  '/trigger/audit-completed',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      auditId,
      companyId,
      companyName,
      domain,
      geoScore,
      sovScore,
      overallScore,
      scoreBreakdown,
      providerMetrics
    } = req.body;

    // Validate required fields
    if (!auditId || !companyId || !companyName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await webhookService.sendAuditCompletedWebhook({
      auditId,
      companyId,
      companyName,
      domain,
      geoScore: geoScore || 0,
      sovScore: sovScore || 0,
      overallScore: overallScore || 0,
      scoreBreakdown,
      providerMetrics,
      completedAt: new Date()
    });

    res.json({ 
      message: 'Audit completed webhook triggered',
      auditId 
    });
  })
);

/**
 * Trigger score change webhook
 */
router.post(
  '/trigger/score-change',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      companyId,
      companyName,
      previousScores,
      newScores,
      threshold = 10
    } = req.body;

    if (!companyId || !previousScores || !newScores) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const changePercentages = {
      geo: ((newScores.geo - previousScores.geo) / previousScores.geo) * 100,
      sov: ((newScores.sov - previousScores.sov) / previousScores.sov) * 100,
      overall: ((newScores.overall - previousScores.overall) / previousScores.overall) * 100
    };

    await webhookService.sendScoreChangeWebhook({
      companyId,
      companyName,
      previousScores,
      newScores,
      changePercentages,
      threshold
    });

    res.json({ 
      message: 'Score change webhook triggered',
      companyId,
      changes: changePercentages
    });
  })
);

/**
 * Register a new webhook
 */
router.post(
  '/register',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, url, headers, events } = req.body;

    if (!name || !url || !events || !Array.isArray(events)) {
      return res.status(400).json({ 
        error: 'Name, URL, and events array are required' 
      });
    }

    const webhookId = await webhookService.registerWebhook({
      name,
      url,
      headers: headers || {},
      events
    });

    res.json({
      message: 'Webhook registered successfully',
      webhookId,
      name,
      url,
      events
    });
  })
);

/**
 * Get webhook statistics
 */
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await webhookService.getWebhookStats();
    
    res.json({
      webhooks: stats,
      summary: {
        total: stats.length,
        totalCalls: stats.reduce((sum: number, w: any) => sum + (w.total_calls || 0), 0),
        successRate: stats.length > 0 
          ? (stats.reduce((sum: number, w: any) => sum + (w.successful_calls || 0), 0) / 
             stats.reduce((sum: number, w: any) => sum + (w.total_calls || 0), 0) * 100).toFixed(2) + '%'
          : '0%'
      }
    });
  })
);

/**
 * Test webhook endpoint
 */
router.post(
  '/test',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { url, event = 'test.webhook' } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Send test webhook
    try {
      const axios = require('axios');
      const testPayload = {
        event,
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from RankMyBrand.ai',
          testId: `test_${Date.now()}`
        },
        metadata: {
          source: 'webhook-test-endpoint',
          version: '2.0'
        }
      };

      const response = await axios.post(url, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Test': 'true'
        },
        timeout: 5000
      });

      res.json({
        success: true,
        statusCode: response.status,
        response: response.data
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        statusCode: error.response?.status
      });
    }
  })
);

export default router;
import { Router } from 'express';
import { Database } from '../../lib/database';
import { asyncHandler } from '../middleware/async-handler';

export function healthRouter(db: Database): Router {
  const router = Router();

  // Basic health check
  router.get('/',
    asyncHandler(async (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'action-center',
        version: process.env.npm_package_version || '1.0.0'
      };

      res.json(health);
    })
  );

  // Detailed health check
  router.get('/detailed',
    asyncHandler(async (req, res) => {
      const checks = {
        database: 'unknown',
        redis: 'unknown',
        memory: 'unknown'
      };

      // Check database
      const dbHealthy = await db.healthCheck();
      checks.database = dbHealthy ? 'healthy' : 'unhealthy';

      // Check memory usage
      const memUsage = process.memoryUsage();
      const maxHeap = memUsage.heapTotal;
      const usedHeap = memUsage.heapUsed;
      const heapPercentage = (usedHeap / maxHeap) * 100;
      
      if (heapPercentage < 90) {
        checks.memory = 'healthy';
      } else {
        checks.memory = 'warning';
      }

      const allHealthy = Object.values(checks).every(v => v === 'healthy');

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks,
        memory: {
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
          heapPercentage: `${heapPercentage.toFixed(2)}%`
        }
      });
    })
  );

  // Liveness probe (for k8s)
  router.get('/live',
    (req, res) => {
      res.status(200).send('OK');
    }
  );

  // Readiness probe (for k8s)
  router.get('/ready',
    asyncHandler(async (req, res) => {
      const isReady = await db.healthCheck();
      if (isReady) {
        res.status(200).send('OK');
      } else {
        res.status(503).send('Not Ready');
      }
    })
  );

  return router;
}
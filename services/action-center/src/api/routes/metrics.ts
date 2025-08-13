import { Router } from 'express';
import { MetricsCollector } from '../../lib/metrics';
import { asyncHandler } from '../middleware/async-handler';

export function metricsRouter(metrics: MetricsCollector): Router {
  const router = Router();

  // Prometheus metrics endpoint
  router.get('/',
    asyncHandler(async (req, res) => {
      const metricsText = await metrics.getMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.send(metricsText);
    })
  );

  // JSON metrics endpoint
  router.get('/json',
    asyncHandler(async (req, res) => {
      const metricsJson = await metrics.getMetricsJson();
      res.json(metricsJson);
    })
  );

  return router;
}
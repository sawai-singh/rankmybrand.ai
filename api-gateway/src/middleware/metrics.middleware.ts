/**
 * Prometheus Metrics Middleware
 * Collects and exposes metrics for monitoring
 */

import { Request, Response, NextFunction } from 'express';
import * as promClient from 'prom-client';

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ 
  register,
  prefix: 'rankmybrand_api_gateway_'
});

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'rankmybrand_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

const httpRequestTotal = new promClient.Counter({
  name: 'rankmybrand_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new promClient.Gauge({
  name: 'rankmybrand_active_connections',
  help: 'Number of active connections'
});

const geoScoreCalculations = new promClient.Counter({
  name: 'rankmybrand_geo_calculations_total',
  help: 'Total number of GEO score calculations',
  labelNames: ['status', 'company']
});

const geoScoreValue = new promClient.Gauge({
  name: 'rankmybrand_geo_score_value',
  help: 'Latest GEO score value',
  labelNames: ['company', 'domain']
});

const sovScoreCalculations = new promClient.Counter({
  name: 'rankmybrand_sov_calculations_total',
  help: 'Total number of SOV score calculations',
  labelNames: ['status', 'company']
});

const sovScoreValue = new promClient.Gauge({
  name: 'rankmybrand_sov_score_value',
  help: 'Latest SOV score value',
  labelNames: ['company', 'domain']
});

const geoSovCalculationDuration = new promClient.Histogram({
  name: 'rankmybrand_geo_sov_calculation_duration_seconds',
  help: 'Duration of GEO/SOV score calculations',
  labelNames: ['type', 'company'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

const overallVisibilityScore = new promClient.Gauge({
  name: 'rankmybrand_overall_visibility_score',
  help: 'Overall visibility score combining GEO and SOV',
  labelNames: ['company', 'domain']
});

const databaseQueryDuration = new promClient.Histogram({
  name: 'rankmybrand_database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
});

const cacheHitRate = new promClient.Gauge({
  name: 'rankmybrand_cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type']
});

const apiErrors = new promClient.Counter({
  name: 'rankmybrand_api_errors_total',
  help: 'Total number of API errors',
  labelNames: ['endpoint', 'error_type', 'status_code']
});

const onboardingFunnel = new promClient.Gauge({
  name: 'rankmybrand_onboarding_funnel',
  help: 'Users at each stage of onboarding',
  labelNames: ['stage']
});

const websocketConnections = new promClient.Gauge({
  name: 'rankmybrand_websocket_connections',
  help: 'Number of active WebSocket connections'
});

const llmApiCalls = new promClient.Counter({
  name: 'rankmybrand_llm_api_calls_total',
  help: 'Total LLM API calls',
  labelNames: ['provider', 'model', 'status']
});

const llmTokenUsage = new promClient.Counter({
  name: 'rankmybrand_llm_tokens_used_total',
  help: 'Total tokens used in LLM calls',
  labelNames: ['provider', 'model', 'type']
});

const competitorAnalysisDuration = new promClient.Histogram({
  name: 'rankmybrand_competitor_analysis_duration_seconds',
  help: 'Duration of competitor analysis',
  labelNames: ['competitor_count'],
  buckets: [1, 5, 10, 30, 60, 120, 300]
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeConnections);
register.registerMetric(geoScoreCalculations);
register.registerMetric(geoScoreValue);
register.registerMetric(sovScoreCalculations);
register.registerMetric(sovScoreValue);
register.registerMetric(geoSovCalculationDuration);
register.registerMetric(overallVisibilityScore);
register.registerMetric(databaseQueryDuration);
register.registerMetric(cacheHitRate);
register.registerMetric(apiErrors);
register.registerMetric(onboardingFunnel);
register.registerMetric(websocketConnections);
register.registerMetric(llmApiCalls);
register.registerMetric(llmTokenUsage);
register.registerMetric(competitorAnalysisDuration);

// Middleware to track HTTP metrics
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // Track active connections
  activeConnections.inc();
  
  // Clean up route for metrics (remove IDs)
  const route = req.route?.path || req.path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\?.*/g, '');
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    // Record request duration
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    // Count total requests
    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
    
    // Track errors
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      apiErrors
        .labels(route, errorType, res.statusCode.toString())
        .inc();
    }
    
    // Decrement active connections
    activeConnections.dec();
  });
  
  next();
}

// Endpoint to expose metrics
export function metricsEndpoint(req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  register.metrics().then(metrics => {
    res.end(metrics);
  }).catch(err => {
    res.status(500).end(err);
  });
}

// Helper functions to update custom metrics
export const metrics = {
  recordGeoCalculation: (status: 'success' | 'failure', company?: string) => {
    geoScoreCalculations.labels(status, company || 'unknown').inc();
  },
  
  updateGeoScore: (company: string, domain: string, score: number) => {
    geoScoreValue.labels(company, domain).set(score);
  },
  
  recordSovCalculation: (status: 'success' | 'failure', company?: string) => {
    sovScoreCalculations.labels(status, company || 'unknown').inc();
  },
  
  updateSovScore: (company: string, domain: string, score: number) => {
    sovScoreValue.labels(company, domain).set(score);
  },
  
  recordGeoSovCalculationTime: (type: 'geo' | 'sov' | 'overall', company: string, duration: number) => {
    geoSovCalculationDuration.labels(type, company).observe(duration);
  },
  
  updateOverallVisibilityScore: (company: string, domain: string, score: number) => {
    overallVisibilityScore.labels(company, domain).set(score);
  },
  
  recordDatabaseQuery: (operation: string, table: string, duration: number) => {
    databaseQueryDuration.labels(operation, table).observe(duration / 1000);
  },
  
  updateCacheHitRate: (cacheType: string, rate: number) => {
    cacheHitRate.labels(cacheType).set(rate);
  },
  
  updateOnboardingFunnel: (stage: string, count: number) => {
    onboardingFunnel.labels(stage).set(count);
  },
  
  updateWebSocketConnections: (count: number) => {
    websocketConnections.set(count);
  },
  
  recordLLMCall: (provider: string, model: string, status: 'success' | 'failure') => {
    llmApiCalls.labels(provider, model, status).inc();
  },
  
  recordTokenUsage: (provider: string, model: string, type: 'input' | 'output', tokens: number) => {
    llmTokenUsage.labels(provider, model, type).inc(tokens);
  },
  
  recordCompetitorAnalysis: (competitorCount: number, duration: number) => {
    competitorAnalysisDuration.labels(competitorCount.toString()).observe(duration);
  }
};

// Export registry for testing
export { register };
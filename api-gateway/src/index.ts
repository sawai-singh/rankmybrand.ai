/**
 * Unified API Gateway for RankMyBrand
 * Routes requests to appropriate backend services
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const PORT = process.env.GATEWAY_PORT || 4000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Backend service URLs
const SERVICES = {
  geo: process.env.GEO_SERVICE || 'http://localhost:8000',
  crawler: process.env.CRAWLER_SERVICE || 'http://localhost:3002',
  search: process.env.SEARCH_SERVICE || 'http://localhost:3002',
  dashboard: process.env.DASHBOARD_SERVICE || 'http://localhost:3000',
  websocket: process.env.WEBSOCKET_SERVICE || 'http://localhost:3001',
  intelligence: process.env.INTELLIGENCE_SERVICE || 'http://localhost:8002',
  action: process.env.ACTION_SERVICE || 'http://localhost:8082',
};

// Create Express app
const app = express();
const server = http.createServer(app);

// Redis client for pub/sub
const redis = new Redis(REDIS_URL);
const redisPub = new Redis(REDIS_URL);

// WebSocket server for unified real-time updates
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests, please try again later.',
});

const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10, // 10 requests per minute for expensive operations
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: Object.keys(SERVICES),
    timestamp: new Date().toISOString(),
  });
});

// Service status endpoint
app.get('/status', async (req, res) => {
  const statuses: any = {};
  
  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const response = await fetch(`${url}/health`);
      statuses[name] = response.ok ? 'healthy' : 'unhealthy';
    } catch (error) {
      statuses[name] = 'unreachable';
    }
  }
  
  res.json({
    gateway: 'healthy',
    services: statuses,
    timestamp: new Date().toISOString(),
  });
});

// ========================================
// API Routes with Service Proxying
// ========================================

// GEO Calculator routes
app.use('/api/geo', limiter, createProxyMiddleware({
  target: SERVICES.geo,
  changeOrigin: true,
  pathRewrite: {
    '^/api/geo': '/api/v1/geo',
  },
  on: {
    proxyReq: (proxyReq: any, req: any) => {
      console.log(`[GEO] ${req.method} ${req.path}`);
    },
    error: (err: any, req: any, res: any) => {
      console.error('[GEO] Proxy error:', err);
      res.status(502).json({ error: 'GEO service unavailable' });
    },
  },
} as any));

// Web Crawler routes
app.use('/api/crawler', limiter, createProxyMiddleware({
  target: SERVICES.crawler,
  changeOrigin: true,
  pathRewrite: {
    '^/api/crawler': '/api',
  },
  on: {
    proxyReq: (proxyReq: any, req: any) => {
      console.log(`[Crawler] ${req.method} ${req.path}`);
    },
    error: (err: any, req: any, res: any) => {
      console.error('[Crawler] Proxy error:', err);
      res.status(502).json({ error: 'Crawler service unavailable' });
    },
  },
} as any));

// Search Intelligence routes
app.use('/api/search', limiter, createProxyMiddleware({
  target: SERVICES.search,
  changeOrigin: true,
  pathRewrite: {
    '^/api/search': '/api/search-intelligence',
  },
  on: {
    proxyReq: (proxyReq: any, req: any) => {
      console.log(`[Search] ${req.method} ${req.path}`);
    },
    error: (err: any, req: any, res: any) => {
      console.error('[Search] Proxy error:', err);
      res.status(502).json({ error: 'Search service unavailable' });
    },
  },
} as any));

// Intelligence Engine routes
app.use('/api/intelligence', limiter, createProxyMiddleware({
  target: SERVICES.intelligence,
  changeOrigin: true,
  pathRewrite: {
    '^/api/intelligence': '/api',
  },
  on: {
    proxyReq: (proxyReq: any, req: any) => {
      console.log(`[Intelligence] ${req.method} ${req.path}`);
    },
    error: (err: any, req: any, res: any) => {
      console.error('[Intelligence] Proxy error:', err);
      res.status(502).json({ error: 'Intelligence service unavailable' });
    },
  },
} as any));

// Action Center routes
app.use('/api/actions', limiter, createProxyMiddleware({
  target: SERVICES.action,
  changeOrigin: true,
  pathRewrite: {
    '^/api/actions': '/api',
  },
  on: {
    proxyReq: (proxyReq: any, req: any) => {
      console.log(`[Actions] ${req.method} ${req.path}`);
    },
    error: (err: any, req: any, res: any) => {
      console.error('[Actions] Proxy error:', err);
      res.status(502).json({ error: 'Action service unavailable' });
    },
  },
} as any));

// ========================================
// Unified API Endpoints
// ========================================

// Complete analysis endpoint (combines multiple services)
app.post('/api/analyze/complete', strictLimiter, async (req, res) => {
  const { domain, keywords } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }
  
  try {
    // Call multiple services in parallel
    const [geoResponse, crawlResponse] = await Promise.all([
      fetch(`${SERVICES.geo}/api/v1/geo/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, keywords }),
      }),
      fetch(`${SERVICES.crawler}/api/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://${domain}`, depth: 2, limit: 20 }),
      }),
    ]);
    
    const [geoData, crawlData] = await Promise.all([
      geoResponse.json(),
      crawlResponse.json(),
    ]);
    
    // Combine results
    const result = {
      domain,
      geo: geoData,
      crawl: crawlData,
      timestamp: new Date().toISOString(),
    };
    
    // Publish to Redis for real-time updates
    await redisPub.publish('analysis:complete', JSON.stringify(result));
    
    res.json(result);
  } catch (error: any) {
    console.error('Complete analysis error:', error);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

// Instant score endpoint (optimized for speed)
app.post('/api/analyze/instant', limiter, async (req, res) => {
  const { domain } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }
  
  try {
    // First try to call the real GEO Calculator service
    try {
      const geoResponse = await fetch(`${SERVICES.geo}/api/v1/geo/quick-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      
      if (geoResponse.ok) {
        const data = await geoResponse.json();
        
        // Publish for real-time updates
        await redisPub.publish('score:instant', JSON.stringify(data));
        
        return res.json(data);
      }
    } catch (serviceError) {
      console.log('GEO service not available, falling back to demo data');
    }
    
    // Fallback to demo data if service is not available
    const score = 60 + Math.random() * 35; // 60-95 range
    
    const data = {
      domain,
      score: Math.round(score * 10) / 10,
      platforms: {
        chatgpt: Math.round(70 + Math.random() * 25),
        claude: Math.round(65 + Math.random() * 30),
        perplexity: Math.round(60 + Math.random() * 35),
        gemini: Math.round(55 + Math.random() * 40),
        bing: Math.round(50 + Math.random() * 45),
        you: Math.round(45 + Math.random() * 50),
        poe: Math.round(40 + Math.random() * 55),
        huggingchat: Math.round(35 + Math.random() * 60)
      },
      shareOfVoice: Math.round(15 + Math.random() * 70),
      sentiment: {
        positive: Math.round(40 + Math.random() * 40),
        neutral: Math.round(20 + Math.random() * 30),
        negative: Math.round(5 + Math.random() * 20)
      },
      citationCount: Math.floor(5 + Math.random() * 95),
      competitorAnalysis: [
        { domain: 'competitor1.com', score: Math.round(50 + Math.random() * 40), position: 1 },
        { domain: 'competitor2.com', score: Math.round(45 + Math.random() * 40), position: 2 },
        { domain: 'competitor3.com', score: Math.round(40 + Math.random() * 40), position: 3 }
      ],
      insights: [
        'Your content is ranking well for informational queries',
        'Consider adding more statistical data to improve AI visibility',
        'Your brand authority score is strong in your niche'
      ],
      metrics: {
        statistics: 0.6 + Math.random() * 0.35,
        quotation: 0.5 + Math.random() * 0.4,
        fluency: 0.7 + Math.random() * 0.25,
        relevance: 0.6 + Math.random() * 0.3,
        authority: 0.5 + Math.random() * 0.35,
        ai_visibility: 0.6 + Math.random() * 0.3
      },
      recommendations: [] as string[],
      isDemo: true, // Flag to indicate this is demo data
      timestamp: new Date().toISOString()
    };
    
    // Add string recommendations based on metrics
    if (data.metrics.statistics < 0.7) {
      data.recommendations.push('Add more data points and statistics to your content');
    }
    
    if (data.metrics.quotation < 0.7) {
      data.recommendations.push('Include expert quotes and authoritative citations');
    }
    
    if (data.metrics.authority < 0.7) {
      data.recommendations.push('Build more high-quality backlinks to increase authority');
    }
    
    // Publish for real-time updates
    await redisPub.publish('score:instant', JSON.stringify(data));
    
    res.json(data);
  } catch (error: any) {
    console.error('Instant score error:', error);
    res.status(500).json({ error: 'Score calculation failed', message: error.message });
  }
});

// Competitor comparison endpoint
app.post('/api/analyze/competitors', limiter, async (req, res) => {
  const { domains } = req.body;
  
  if (!domains || !Array.isArray(domains) || domains.length < 2) {
    return res.status(400).json({ error: 'At least 2 domains required' });
  }
  
  try {
    const response = await fetch(`${SERVICES.geo}/api/v1/geo/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains }),
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Competitor comparison error:', error);
    res.status(500).json({ error: 'Comparison failed', message: error.message });
  }
});

// ========================================
// WebSocket Handling
// ========================================

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  // Subscribe to Redis channels
  const subscriber = new Redis(REDIS_URL);
  
  subscriber.subscribe(
    'analysis:complete',
    'score:instant',
    'metrics:update',
    'alert:new'
  );
  
  subscriber.on('message', (channel, message) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        channel,
        data: JSON.parse(message),
        timestamp: new Date().toISOString(),
      }));
    }
  });
  
  // Handle incoming messages from client
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'subscribe':
          if (data.domain) {
            subscriber.subscribe(`domain:${data.domain}`);
          }
          break;
          
        case 'unsubscribe':
          if (data.domain) {
            subscriber.unsubscribe(`domain:${data.domain}`);
          }
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  // Cleanup on disconnect
  ws.on('close', () => {
    console.log('WebSocket disconnected');
    subscriber.quit();
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to RankMyBrand Gateway',
  }));
});

// ========================================
// Error Handling
// ========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error:', err);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ========================================
// Server Startup
// ========================================

server.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log('\nConnected services:');
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`  - ${name}: ${url}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  
  server.close(() => {
    console.log('Server closed');
    redis.quit();
    redisPub.quit();
    process.exit(0);
  });
});
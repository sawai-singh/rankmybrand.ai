const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'web-crawler',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mock crawl endpoint
app.post('/api/crawl', (req, res) => {
  const { url, depth = 2 } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  // Generate mock job ID
  const jobId = `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  res.json({
    jobId,
    status: 'queued',
    url,
    depth,
    message: 'Crawl job queued successfully'
  });
});

// Get crawl job status
app.get('/api/crawl/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  // Mock completed job
  res.json({
    jobId,
    status: 'completed',
    url: 'https://example.com',
    pagesScanned: 5,
    results: {
      title: 'Example Domain',
      description: 'Example website for testing',
      keywords: ['example', 'test', 'demo'],
      links: 10,
      images: 3
    },
    completedAt: new Date().toISOString()
  });
});

// Mock SERP analysis endpoint
app.post('/api/serp/analyze', (req, res) => {
  const { query, platforms = ['google'] } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }
  
  res.json({
    query,
    platforms,
    results: {
      google: {
        position: 3,
        totalResults: 1250000,
        topCompetitors: ['competitor1.com', 'competitor2.com'],
        snippet: 'Your brand appears in position 3 for this query'
      }
    },
    analyzedAt: new Date().toISOString()
  });
});

// Mock competitor discovery
app.post('/api/competitors/discover', (req, res) => {
  const { domain } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }
  
  res.json({
    domain,
    competitors: [
      {
        domain: 'competitor1.com',
        name: 'Competitor One',
        similarity: 0.85,
        overlap: 45
      },
      {
        domain: 'competitor2.com',
        name: 'Competitor Two',
        similarity: 0.72,
        overlap: 38
      },
      {
        domain: 'competitor3.com',
        name: 'Competitor Three',
        similarity: 0.68,
        overlap: 32
      }
    ]
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🕷️ Web Crawler Service running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
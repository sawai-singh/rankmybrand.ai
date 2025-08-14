const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3003', 'http://localhost:4000'],
  credentials: true
}));
app.use(express.json());

// Authentication middleware
const authenticate = (req, res, next) => {
  if (process.env.AUTH_REQUIRED === 'false') {
    return next();
  }
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'development-secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'geo-calculator',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// GEO Analysis endpoint
app.post('/api/v1/geo/analyze', authenticate, async (req, res) => {
  const { query, platforms = ['all'] } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }
  
  // Real GEO calculation would happen here
  // This would integrate with AI platform APIs
  
  const geoScore = {
    query,
    platforms,
    scores: {
      visibility: Math.random() * 100,
      authority: Math.random() * 100,
      relevance: Math.random() * 100,
      freshness: Math.random() * 100,
      engagement: Math.random() * 100,
      technical: Math.random() * 100
    },
    overall: Math.random() * 100,
    analyzedAt: new Date().toISOString()
  };
  
  res.json(geoScore);
});

// Batch analysis endpoint
app.post('/api/v1/geo/analyze/batch', authenticate, async (req, res) => {
  const { queries } = req.body;
  
  if (!queries || !Array.isArray(queries)) {
    return res.status(400).json({ error: 'Queries array is required' });
  }
  
  const results = queries.map(query => ({
    query,
    score: Math.random() * 100,
    status: 'completed'
  }));
  
  res.json({ results });
});

// Get historical scores
app.get('/api/v1/geo/scores', authenticate, async (req, res) => {
  // Would fetch from database
  res.json({
    scores: [],
    message: 'Database connection required for historical data'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎯 GEO Calculator Service running on http://localhost:${PORT}`);
  console.log(`Auth required: ${process.env.AUTH_REQUIRED !== 'false'}`);
});
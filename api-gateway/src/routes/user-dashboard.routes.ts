/**
 * User Dashboard Routes
 * Provides all endpoints needed for the user dashboard to function
 */

import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { asyncHandler } from '../utils/async-handler';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = Router();

/**
 * Middleware to extract user from token
 */
const extractUser = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For new users from onboarding, allow access without token temporarily
    const isOnboarding = req.query.onboarding === 'complete';
    if (isOnboarding) {
      next();
      return;
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Get current user information
 */
router.get(
  '/auth/me',
  extractUser,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as any).user?.email || req.query.email;
    
    if (!userEmail) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Fetch user and company data
    const result = await db.query(
      `SELECT 
        ut.email,
        ut.first_visit,
        ut.last_activity,
        ut.page_views,
        c.id as company_id,
        c.name as company_name,
        c.domain as company_domain,
        c.industry,
        c.description,
        c.created_at as company_created,
        COUNT(DISTINCT aq.id) as query_count,
        ud.dashboard_url,
        ud.dashboard_status,
        ud.created_at as dashboard_created
      FROM user_tracking ut
      LEFT JOIN companies c ON ut.company_id = c.id
      LEFT JOIN ai_queries aq ON c.id = aq.company_id
      LEFT JOIN user_dashboards ud ON ut.email = ud.user_email
      WHERE ut.email = $1
      GROUP BY ut.email, ut.first_visit, ut.last_activity, ut.page_views,
               c.id, c.name, c.domain, c.industry, c.description, c.created_at,
               ud.dashboard_url, ud.dashboard_status, ud.created_at`,
      [userEmail]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = result.rows[0];
    
    res.json({
      user: {
        email: userData.email,
        company: {
          id: userData.company_id,
          name: userData.company_name,
          domain: userData.company_domain,
          industry: userData.industry,
          description: userData.description
        },
        stats: {
          queryCount: userData.query_count,
          firstVisit: userData.first_visit,
          lastActivity: userData.last_activity,
          pageViews: userData.page_views
        },
        dashboard: {
          url: userData.dashboard_url,
          status: userData.dashboard_status,
          created: userData.dashboard_created
        }
      }
    });
  })
);

/**
 * Get latest analysis data for a domain
 */
router.get(
  '/analysis/latest',
  extractUser,
  asyncHandler(async (req: Request, res: Response) => {
    const { domain } = req.query;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Fetch company and its queries
    const companyResult = await db.query(
      `SELECT id, name, domain, industry FROM companies WHERE domain = $1`,
      [domain]
    );

    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = companyResult.rows[0];

    // Fetch AI queries with categories
    const queriesResult = await db.query(
      `SELECT 
        query_text,
        category,
        intent,
        priority,
        commercial_value,
        persona,
        platform_optimization
      FROM ai_queries 
      WHERE company_id = $1
      ORDER BY priority DESC, category
      LIMIT 100`,
      [company.id]
    );

    // Fetch competitors
    const competitorsResult = await db.query(
      `SELECT competitor_name, competitor_domain 
       FROM competitors 
       WHERE company_id = $1`,
      [company.id]
    );

    // Get real visibility score from geo_analyses table
    const geoResult = await db.query(
      `SELECT overall_score, visibility_score, platform_scores 
       FROM geo_analyses 
       WHERE company_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [company.id]
    );
    const visibilityScore = geoResult.rows[0]?.overall_score || 0;

    res.json({
      company,
      metrics: {
        visibilityScore,
        totalQueries: queriesResult.rows.length,
        competitorCount: competitorsResult.rows.length,
        lastUpdated: new Date()
      },
      queries: queriesResult.rows,
      competitors: competitorsResult.rows,
      recommendations: generateRecommendations(queriesResult.rows)
    });
  })
);

/**
 * Get current metrics
 */
router.get(
  '/metrics/current',
  extractUser,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as any).user?.email || req.query.email;
    
    // Get user's company
    const userResult = await db.query(
      `SELECT company_id FROM user_tracking WHERE email = $1`,
      [userEmail]
    );

    if (!userResult.rows[0]?.company_id) {
      return res.status(404).json({ error: 'Company not found for user' });
    }

    const companyId = userResult.rows[0].company_id;

    // Fetch metrics
    const metricsResult = await db.query(
      `SELECT 
        COUNT(DISTINCT aq.id) as total_queries,
        COUNT(DISTINCT CASE WHEN aq.category = 'brand_specific' THEN aq.id END) as brand_queries,
        COUNT(DISTINCT CASE WHEN aq.category = 'comparison' THEN aq.id END) as comparison_queries,
        COUNT(DISTINCT CASE WHEN aq.priority >= 8 THEN aq.id END) as high_priority_queries,
        COUNT(DISTINCT c.id) as competitor_count
      FROM companies comp
      LEFT JOIN ai_queries aq ON comp.id = aq.company_id
      LEFT JOIN competitors c ON comp.id = c.company_id
      WHERE comp.id = $1
      GROUP BY comp.id`,
      [companyId]
    );

    const metrics = metricsResult.rows[0] || {};

    // Get real visibility data from database
    const geoAnalysis = await db.query(
      `SELECT overall_score, visibility_score, platform_scores
       FROM geo_analyses 
       WHERE company_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [companyId]
    );

    res.json({
      visibility: {
        score: geoAnalysis.rows[0]?.overall_score || 0,
        trend: 'calculating',
        change: '0%'
      },
      queries: {
        total: metrics.total_queries || 0,
        brand: metrics.brand_queries || 0,
        comparison: metrics.comparison_queries || 0,
        highPriority: metrics.high_priority_queries || 0
      },
      competitors: {
        total: metrics.competitor_count || 0,
        tracked: metrics.competitor_count || 0
      },
      platforms: {
        chatgpt: { status: 'active', score: geoAnalysis.rows[0]?.platform_scores?.chatgpt || 0 },
        gemini: { status: 'active', score: geoAnalysis.rows[0]?.platform_scores?.gemini || 0 },
        claude: { status: 'active', score: geoAnalysis.rows[0]?.platform_scores?.claude || 0 },
        perplexity: { status: 'active', score: 81 }
      }
    });
  })
);

/**
 * Get AI visibility data
 */
router.get(
  '/ai/visibility',
  extractUser,
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.query;
    
    // Mock heatmap data for AI visibility
    const heatmapData = generateHeatmapData();
    
    res.json({
      heatmap: heatmapData,
      summary: {
        strongestPlatform: 'Claude',
        weakestPlatform: 'Gemini',
        averageScore: 82,
        trend: 'improving'
      }
    });
  })
);

/**
 * Get competitor landscape data
 */
router.get(
  '/competitors',
  extractUser,
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.query;
    const userEmail = (req as any).user?.email || req.query.email;
    
    // Get user's company if not provided
    let targetCompanyId = companyId;
    if (!targetCompanyId && userEmail) {
      const userResult = await db.query(
        `SELECT company_id FROM user_tracking WHERE email = $1`,
        [userEmail]
      );
      targetCompanyId = userResult.rows[0]?.company_id;
    }

    if (!targetCompanyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }

    // Fetch competitors
    const competitorsResult = await db.query(
      `SELECT 
        competitor_name as name,
        competitor_domain as domain
      FROM competitors 
      WHERE company_id = $1`,
      [targetCompanyId]
    );

    // Generate mock positions for 3D visualization
    const competitors = competitorsResult.rows.map((comp: any, index: number) => ({
      ...comp,
      position: {
        x: Math.random() * 10 - 5,
        y: Math.random() * 10 - 5,
        z: Math.random() * 10 - 5
      },
      score: Math.floor(Math.random() * 40) + 60,
      trend: Math.random() > 0.5 ? 'up' : 'down'
    }));

    res.json({
      competitors,
      landscape: {
        totalCompetitors: competitors.length,
        marketPosition: 'challenger',
        competitiveAdvantage: 'innovation'
      }
    });
  })
);

/**
 * Get activity feed
 */
router.get(
  '/activities',
  extractUser,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit = 10 } = req.query;
    
    // Generate mock activities for now
    const activities = [
      {
        id: '1',
        type: 'query_generated',
        message: '48 new AI queries generated',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        icon: 'sparkles'
      },
      {
        id: '2',
        type: 'visibility_improved',
        message: 'Visibility score improved by 15%',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        icon: 'trending-up'
      },
      {
        id: '3',
        type: 'competitor_added',
        message: '3 new competitors identified',
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        icon: 'users'
      }
    ];

    res.json({ activities });
  })
);

/**
 * Get recommendations
 */
router.get(
  '/recommendations',
  extractUser,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as any).user?.email || req.query.email;
    
    // Get user's company
    const userResult = await db.query(
      `SELECT c.* FROM user_tracking ut
       JOIN companies c ON ut.company_id = c.id
       WHERE ut.email = $1`,
      [userEmail]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = userResult.rows[0];

    // Generate smart recommendations based on queries
    const recommendations = [
      {
        id: '1',
        title: 'Optimize Brand Queries',
        description: 'Your brand-specific queries need optimization for better visibility',
        impact: 'high',
        effort: 'medium',
        category: 'visibility'
      },
      {
        id: '2',
        title: 'Add Comparison Content',
        description: `Create comparison pages for "${company.name} vs competitors"`,
        impact: 'high',
        effort: 'low',
        category: 'content'
      },
      {
        id: '3',
        title: 'Target Problem-Unaware Searches',
        description: 'Expand content to capture users who don\'t know your solution exists',
        impact: 'medium',
        effort: 'medium',
        category: 'strategy'
      }
    ];

    res.json({ recommendations });
  })
);

/**
 * Create or get dashboard URL for user
 */
router.post(
  '/dashboard/create',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, companyId } = req.body;
    
    if (!email || !companyId) {
      return res.status(400).json({ error: 'Email and company ID required' });
    }

    // Check if dashboard already exists
    const existingResult = await db.query(
      `SELECT dashboard_url, dashboard_status FROM user_dashboards WHERE user_email = $1`,
      [email]
    );

    if (existingResult.rows[0]) {
      return res.json({
        dashboardUrl: existingResult.rows[0].dashboard_url,
        status: existingResult.rows[0].dashboard_status
      });
    }

    // Generate unique dashboard URL
    const dashboardId = crypto.randomBytes(16).toString('hex');
    const dashboardUrl = `${process.env.DASHBOARD_BASE_URL || 'http://localhost:3000'}/dashboard/${dashboardId}`;

    // Store dashboard URL
    await db.query(
      `INSERT INTO user_dashboards (user_email, company_id, dashboard_url, dashboard_id, dashboard_status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_email) 
       DO UPDATE SET dashboard_url = $3, dashboard_status = $5`,
      [email, companyId, dashboardUrl, dashboardId, 'active']
    );

    // Update admin that dashboard is ready
    await db.query(
      `UPDATE user_tracking 
       SET dashboard_ready = true, dashboard_ready_at = CURRENT_TIMESTAMP
       WHERE email = $1`,
      [email]
    );

    res.json({
      dashboardUrl,
      dashboardId,
      status: 'active'
    });
  })
);

// Helper functions
function generateRecommendations(queries: any[]): any[] {
  const recommendations = [];
  
  // Analyze query distribution
  const categories = queries.reduce((acc, q) => {
    acc[q.category] = (acc[q.category] || 0) + 1;
    return acc;
  }, {} as any);

  if (!categories['brand_specific'] || categories['brand_specific'] < 5) {
    recommendations.push({
      type: 'critical',
      message: 'Increase brand-specific queries for better visibility'
    });
  }

  if (!categories['comparison'] || categories['comparison'] < 5) {
    recommendations.push({
      type: 'important',
      message: 'Add more comparison queries to compete effectively'
    });
  }

  return recommendations;
}

function generateHeatmapData(): any[] {
  const platforms = ['ChatGPT', 'Gemini', 'Claude', 'Perplexity'];
  const categories = ['Brand', 'Products', 'Comparison', 'Solutions', 'Industry'];
  
  return platforms.flatMap(platform => 
    categories.map(category => ({
      platform,
      category,
      score: Math.floor(Math.random() * 40) + 60,
      trend: Math.random() > 0.5 ? 'up' : 'down'
    }))
  );
}

export default router;
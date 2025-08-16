import { Pool } from 'pg';
import Redis from 'ioredis';
import { MetricsData, RecommendationData, CompetitorData } from './types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:5432/rankmybrand`
});

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

export async function fetchLatestMetrics(brandId: string): Promise<MetricsData | null> {
  try {
    // Check cache first
    const cacheKey = `metrics:${brandId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fetch from database
    const result = await pool.query(`
      SELECT 
        COALESCE(geo_score, 0) as "geoScore",
        COALESCE(share_of_voice, 0) as "shareOfVoice",
        COALESCE(sentiment_positive, 0) as "sentimentPositive",
        COALESCE(sentiment_neutral, 0) as "sentimentNeutral",
        COALESCE(sentiment_negative, 0) as "sentimentNegative",
        COALESCE(citation_count, 0) as "citationCount",
        COALESCE(platform_scores, '{}') as "platformScores",
        created_at as "createdAt"
      FROM brand_metrics
      WHERE brand_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [brandId]);
    
    if (result.rows[0]) {
      const metrics: MetricsData = {
        geoScore: result.rows[0].geoScore,
        shareOfVoice: result.rows[0].shareOfVoice,
        sentiment: {
          positive: result.rows[0].sentimentPositive,
          neutral: result.rows[0].sentimentNeutral,
          negative: result.rows[0].sentimentNegative
        },
        citationCount: result.rows[0].citationCount,
        platformScores: result.rows[0].platformScores
      };
      
      // Cache for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(metrics));
      return metrics;
    }
    
    // Return default metrics if no data found
    return {
      geoScore: 0,
      shareOfVoice: 0,
      sentiment: { positive: 0, neutral: 0, negative: 0 },
      citationCount: 0,
      platformScores: {}
    };
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return null;
  }
}

export async function fetchRecommendations(brandId: string): Promise<RecommendationData[]> {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        title, 
        description, 
        priority, 
        impact, 
        effort, 
        status, 
        type, 
        created_at as "createdAt"
      FROM recommendations
      WHERE brand_id = $1 
        AND status IN ('pending', 'in_progress')
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        impact DESC
      LIMIT 10
    `, [brandId]);
    
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      impact: row.impact,
      effort: row.effort,
      status: row.status,
      type: row.type,
      createdAt: row.createdAt.toISOString()
    }));
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return [];
  }
}

export async function fetchCompetitors(brandId: string): Promise<CompetitorData[]> {
  try {
    const result = await pool.query(`
      SELECT 
        c.id, 
        c.name, 
        COALESCE(cm.geo_score, 0) as "geoScore",
        COALESCE(cm.share_of_voice, 0) as "shareOfVoice",
        c.color,
        cm.updated_at
      FROM competitors c
      LEFT JOIN competitor_metrics cm ON c.id = cm.competitor_id
      WHERE c.brand_id = $1
      ORDER BY cm.geo_score DESC NULLS LAST
      LIMIT 5
    `, [brandId]);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      geoScore: row.geoScore,
      shareOfVoice: row.shareOfVoice,
      color: row.color || '#999999'
    }));
  } catch (error) {
    console.error('Error fetching competitors:', error);
    return [];
  }
}

// Close pool on shutdown
export async function closeDatabaseConnection() {
  await pool.end();
  await redis.quit();
}
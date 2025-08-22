/**
 * Feedback Service
 * Handles user feedback on GEO/SOV scores and recommendations
 */

import { db } from '../database/connection';
import { logger } from '../utils/logger';
import Redis from 'ioredis';

interface FeedbackData {
  userId?: string;
  companyId: number;
  scoreType: 'geo' | 'sov' | 'overall' | 'recommendation';
  scoreValue?: number;
  feedbackType: 'confusing' | 'helpful' | 'incorrect' | 'suggestion';
  message?: string;
  context?: any;
}

interface FeedbackStats {
  totalFeedback: number;
  byType: Record<string, number>;
  byScoreType: Record<string, number>;
  commonIssues: Array<{ issue: string; count: number }>;
  averageScoreRating: number;
}

export class FeedbackService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      password: process.env.REDIS_PASSWORD
    });
    this.initializeFeedbackTable();
  }

  /**
   * Initialize feedback table if it doesn't exist
   */
  private async initializeFeedbackTable(): Promise<void> {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS user_feedback (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255),
          company_id INTEGER,
          score_type VARCHAR(50) NOT NULL,
          score_value NUMERIC(5,2),
          feedback_type VARCHAR(50) NOT NULL,
          message TEXT,
          context JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          resolved BOOLEAN DEFAULT false,
          resolved_at TIMESTAMP WITH TIME ZONE,
          resolution_notes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_feedback_company ON user_feedback(company_id);
        CREATE INDEX IF NOT EXISTS idx_feedback_type ON user_feedback(feedback_type);
        CREATE INDEX IF NOT EXISTS idx_feedback_score_type ON user_feedback(score_type);
        CREATE INDEX IF NOT EXISTS idx_feedback_created ON user_feedback(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_feedback_resolved ON user_feedback(resolved);

        -- Table for tracking common issues
        CREATE TABLE IF NOT EXISTS feedback_patterns (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pattern_type VARCHAR(100) NOT NULL,
          description TEXT,
          frequency INTEGER DEFAULT 1,
          last_reported TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          auto_response TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      logger.info('Feedback tables initialized');
    } catch (error) {
      logger.error('Error initializing feedback tables:', error);
    }
  }

  /**
   * Submit user feedback
   */
  async submitFeedback(feedback: FeedbackData): Promise<string> {
    try {
      // Store in database
      const result = await db.query(`
        INSERT INTO user_feedback (
          user_id, company_id, score_type, score_value,
          feedback_type, message, context
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        feedback.userId || 'anonymous',
        feedback.companyId,
        feedback.scoreType,
        feedback.scoreValue,
        feedback.feedbackType,
        feedback.message,
        JSON.stringify(feedback.context || {})
      ]);

      const feedbackId = result.rows[0].id;

      // Track in Redis for quick analytics
      await this.trackFeedbackPattern(feedback);

      // Send to support system if configured
      if (feedback.feedbackType === 'incorrect' || feedback.feedbackType === 'confusing') {
        await this.notifySupport(feedbackId, feedback);
      }

      // Check for auto-response
      const autoResponse = await this.getAutoResponse(feedback);
      if (autoResponse) {
        return autoResponse;
      }

      logger.info(`Feedback submitted: ${feedbackId}`);
      return feedbackId;
    } catch (error) {
      logger.error('Error submitting feedback:', error);
      throw error;
    }
  }

  /**
   * Track feedback patterns for analytics
   */
  private async trackFeedbackPattern(feedback: FeedbackData): Promise<void> {
    const key = `feedback:${feedback.scoreType}:${feedback.feedbackType}`;
    
    // Increment counter in Redis
    await this.redis.incr(key);
    await this.redis.expire(key, 86400 * 30); // 30 days

    // Track common issues
    if (feedback.message) {
      const issueKey = `feedback:issues:${this.categorizeIssue(feedback.message)}`;
      await this.redis.incr(issueKey);
    }
  }

  /**
   * Categorize feedback issue
   */
  private categorizeIssue(message: string): string {
    const lowercaseMsg = message.toLowerCase();
    
    if (lowercaseMsg.includes('understand') || lowercaseMsg.includes('confus')) {
      return 'understanding';
    }
    if (lowercaseMsg.includes('wrong') || lowercaseMsg.includes('incorrect')) {
      return 'accuracy';
    }
    if (lowercaseMsg.includes('miss') || lowercaseMsg.includes('not show')) {
      return 'missing_data';
    }
    if (lowercaseMsg.includes('slow') || lowercaseMsg.includes('load')) {
      return 'performance';
    }
    if (lowercaseMsg.includes('help') || lowercaseMsg.includes('how')) {
      return 'help_needed';
    }
    
    return 'other';
  }

  /**
   * Get auto-response for common feedback
   */
  private async getAutoResponse(feedback: FeedbackData): Promise<string | null> {
    // Check for common patterns
    const pattern = await db.query(`
      SELECT auto_response FROM feedback_patterns
      WHERE pattern_type = $1
      LIMIT 1
    `, [`${feedback.scoreType}_${feedback.feedbackType}`]);

    if (pattern.rows[0]?.auto_response) {
      return pattern.rows[0].auto_response;
    }

    // Default responses
    const responses: Record<string, string> = {
      'geo_confusing': 'GEO Score measures how well your content is optimized for AI engines. A higher score means AI systems can better understand and recommend your brand. We\'ll clarify this in the UI.',
      'sov_confusing': 'SOV (Share of Voice) shows what percentage of AI responses mention your brand versus competitors. Think of it as your "market share" in AI responses. We appreciate your feedback!',
      'overall_confusing': 'The overall score combines multiple factors: GEO (30%), SOV (25%), Recommendations (20%), Sentiment (15%), and Visibility (10%). We\'ll make this clearer.',
      'recommendation_helpful': 'Thank you! We\'re glad the recommendations are helpful. We continuously improve them based on user feedback.',
      'geo_incorrect': 'We\'re sorry the GEO score seems incorrect. Our team will review this. The score is based on 192 AI responses across 4 providers.',
      'sov_incorrect': 'Thank you for reporting this. SOV calculations are complex and we\'ll investigate. Please note SOV compares you to detected competitors in the same space.'
    };

    const key = `${feedback.scoreType}_${feedback.feedbackType}`;
    return responses[key] || null;
  }

  /**
   * Notify support team of critical feedback
   */
  private async notifySupport(feedbackId: string, feedback: FeedbackData): Promise<void> {
    // Add to support queue
    const supportQueue = 'support:feedback:queue';
    await this.redis.rpush(supportQueue, JSON.stringify({
      feedbackId,
      ...feedback,
      timestamp: new Date().toISOString(),
      priority: feedback.feedbackType === 'incorrect' ? 'high' : 'medium'
    }));

    // Log for monitoring
    logger.warn(`Support notification for feedback ${feedbackId}: ${feedback.feedbackType} on ${feedback.scoreType}`);
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats(companyId?: number): Promise<FeedbackStats> {
    const whereClause = companyId ? 'WHERE company_id = $1' : '';
    const params = companyId ? [companyId] : [];

    // Get overall stats
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT company_id) as companies,
        AVG(CASE WHEN score_value IS NOT NULL THEN score_value END) as avg_score_rating
      FROM user_feedback
      ${whereClause}
    `, params);

    // Get breakdown by type
    const byTypeResult = await db.query(`
      SELECT feedback_type, COUNT(*) as count
      FROM user_feedback
      ${whereClause}
      GROUP BY feedback_type
    `, params);

    // Get breakdown by score type
    const byScoreResult = await db.query(`
      SELECT score_type, COUNT(*) as count
      FROM user_feedback
      ${whereClause}
      GROUP BY score_type
    `, params);

    // Get common issues
    const issuesResult = await db.query(`
      SELECT 
        CASE 
          WHEN message ILIKE '%understand%' OR message ILIKE '%confus%' THEN 'Understanding issues'
          WHEN message ILIKE '%wrong%' OR message ILIKE '%incorrect%' THEN 'Accuracy concerns'
          WHEN message ILIKE '%miss%' OR message ILIKE '%not show%' THEN 'Missing data'
          WHEN message ILIKE '%slow%' OR message ILIKE '%load%' THEN 'Performance issues'
          ELSE 'Other'
        END as issue,
        COUNT(*) as count
      FROM user_feedback
      ${whereClause}
      ${whereClause ? 'AND' : 'WHERE'} message IS NOT NULL
      GROUP BY issue
      ORDER BY count DESC
      LIMIT 5
    `, params);

    const byType: Record<string, number> = {};
    byTypeResult.rows.forEach(row => {
      byType[row.feedback_type] = parseInt(row.count);
    });

    const byScoreType: Record<string, number> = {};
    byScoreResult.rows.forEach(row => {
      byScoreType[row.score_type] = parseInt(row.count);
    });

    return {
      totalFeedback: parseInt(statsResult.rows[0].total),
      byType,
      byScoreType,
      commonIssues: issuesResult.rows.map(row => ({
        issue: row.issue,
        count: parseInt(row.count)
      })),
      averageScoreRating: parseFloat(statsResult.rows[0].avg_score_rating) || 0
    };
  }

  /**
   * Get recent feedback for review
   */
  async getRecentFeedback(limit: number = 10): Promise<any[]> {
    const result = await db.query(`
      SELECT 
        f.*,
        c.name as company_name,
        c.domain as company_domain
      FROM user_feedback f
      LEFT JOIN companies c ON f.company_id = c.id
      WHERE f.resolved = false
      ORDER BY f.created_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  }

  /**
   * Mark feedback as resolved
   */
  async resolveFeedback(feedbackId: string, notes: string): Promise<void> {
    await db.query(`
      UPDATE user_feedback
      SET 
        resolved = true,
        resolved_at = NOW(),
        resolution_notes = $2
      WHERE id = $1
    `, [feedbackId, notes]);

    logger.info(`Feedback ${feedbackId} marked as resolved`);
  }
}

// Export singleton instance
export const feedbackService = new FeedbackService();
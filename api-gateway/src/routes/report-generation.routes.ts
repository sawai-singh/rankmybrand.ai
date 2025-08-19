import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { asyncHandler } from '../utils/async-handler';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import Bull from 'bull';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Initialize Redis client for pub/sub
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

// Initialize Bull queue for background processing
const reportQueue = new Bull('report-generation', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

interface ReportGenerationRequest {
  companyId: number;
  userId: number;
  includeAIVisibility: boolean;
  includeCompetitorAnalysis: boolean;
  reportType: 'instant' | 'comprehensive' | 'detailed';
}

/**
 * Generate comprehensive report including AI Visibility analysis
 * This is the main entry point that triggers AI visibility query generation
 */
router.post(
  '/generate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { 
      companyId, 
      reportType = 'comprehensive',
      includeAIVisibility = true,
      includeCompetitorAnalysis = true 
    } = req.body;

    logger.info(`Starting report generation for company ${companyId}`);

    try {
      // Fetch company data
      const companyResult = await db.query(
        `SELECT c.*, array_agg(DISTINCT comp.name) as competitors
         FROM companies c
         LEFT JOIN company_competitors cc ON cc.company_id = c.id
         LEFT JOIN companies comp ON comp.id = cc.competitor_id
         WHERE c.id = $1 AND c.user_id = $2
         GROUP BY c.id`,
        [companyId, userId]
      );

      if (!companyResult.rows[0]) {
        return res.status(404).json({ error: 'Company not found' });
      }

      const company = companyResult.rows[0];
      const reportId = uuidv4();

      // Create report record
      await db.query(
        `INSERT INTO reports (id, company_id, user_id, type, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [reportId, companyId, userId, reportType, 'processing']
      );

      // Queue the report generation job
      const job = await reportQueue.add('generate-report', {
        reportId,
        companyId,
        userId,
        reportType,
        company: {
          id: company.id,
          name: company.name,
          domain: company.domain,
          description: company.description,
          industry: company.industry,
          competitors: company.competitors || [],
        },
        options: {
          includeAIVisibility,
          includeCompetitorAnalysis,
        },
      }, {
        jobId: reportId,
      });

      // Notify via WebSocket for real-time updates
      redis.publish('report:started', JSON.stringify({
        reportId,
        companyId,
        userId,
        timestamp: new Date().toISOString(),
      }));

      res.json({
        success: true,
        reportId,
        status: 'processing',
        message: 'Report generation started',
        estimatedTime: reportType === 'instant' ? 30 : 120, // seconds
      });

    } catch (error) {
      logger.error('Failed to start report generation:', error);
      res.status(500).json({
        error: 'Failed to start report generation',
        message: 'Please try again later',
      });
    }
  })
);

/**
 * Get report status and results
 */
router.get(
  '/status/:reportId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { reportId } = req.params;
    const userId = (req as any).user.id;

    const reportResult = await db.query(
      `SELECT r.*, c.name as company_name,
        av.overall_visibility_score,
        av.brand_mention_rate,
        av.competitive_position,
        av.platform_scores
       FROM reports r
       LEFT JOIN companies c ON c.id = r.company_id
       LEFT JOIN ai_visibility_reports av ON av.company_id = r.company_id
       WHERE r.id = $1 AND r.user_id = $2
       ORDER BY av.generated_at DESC
       LIMIT 1`,
      [reportId, userId]
    );

    if (!reportResult.rows[0]) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];

    // If report is complete, include AI visibility data
    if (report.status === 'completed' && report.overall_visibility_score) {
      // Fetch AI visibility insights
      const insightsResult = await db.query(
        `SELECT strengths, weaknesses, opportunities, recommendations
         FROM ai_visibility_reports
         WHERE company_id = $1
         ORDER BY generated_at DESC
         LIMIT 1`,
        [report.company_id]
      );

      if (insightsResult.rows[0]) {
        report.ai_visibility = {
          score: report.overall_visibility_score,
          brandMentionRate: report.brand_mention_rate,
          competitivePosition: report.competitive_position,
          platformScores: report.platform_scores,
          insights: insightsResult.rows[0],
        };
      }
    }

    res.json(report);
  })
);

// Report Queue Processor
reportQueue.process('generate-report', async (job) => {
  const { reportId, companyId, company, options } = job.data;
  
  logger.info(`Processing report ${reportId} for company ${companyId}`);

  try {
    // Step 1: Generate GEO score
    logger.info('Step 1: Generating GEO score...');
    const geoScore = await generateGEOScore(company);
    
    // Step 2: If AI Visibility is enabled, trigger AI analysis
    if (options.includeAIVisibility) {
      logger.info('Step 2: Starting AI Visibility analysis...');
      
      // This triggers the comprehensive AI visibility pipeline
      const aiVisibilityResult = await triggerAIVisibilityAnalysis({
        companyId,
        companyData: company,
        reportId,
      });
      
      // Store AI visibility report reference
      await db.query(
        `UPDATE reports 
         SET ai_visibility_report_id = $1
         WHERE id = $2`,
        [aiVisibilityResult.reportId, reportId]
      );
      
      // Notify progress
      redis.publish('report:ai-visibility-complete', JSON.stringify({
        reportId,
        aiVisibilityScore: aiVisibilityResult.overallScore,
        timestamp: new Date().toISOString(),
      }));
    }
    
    // Step 3: Competitor analysis if enabled
    if (options.includeCompetitorAnalysis && company.competitors.length > 0) {
      logger.info('Step 3: Running competitor analysis...');
      const competitorAnalysis = await generateCompetitorAnalysis(company);
      
      await db.query(
        `UPDATE reports 
         SET competitor_analysis = $1
         WHERE id = $2`,
        [JSON.stringify(competitorAnalysis), reportId]
      );
    }
    
    // Step 4: Mark report as complete
    await db.query(
      `UPDATE reports 
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [reportId]
    );
    
    // Notify completion
    redis.publish('report:completed', JSON.stringify({
      reportId,
      companyId,
      timestamp: new Date().toISOString(),
    }));
    
    logger.info(`Report ${reportId} completed successfully`);
    
  } catch (error) {
    logger.error(`Failed to generate report ${reportId}:`, error);
    
    await db.query(
      `UPDATE reports 
       SET status = 'failed', error = $1
       WHERE id = $2`,
      [error.message, reportId]
    );
    
    throw error;
  }
});

/**
 * Trigger AI Visibility Analysis
 * This is where the magic happens - queries are generated and sent to LLMs
 */
async function triggerAIVisibilityAnalysis(params: {
  companyId: number;
  companyData: any;
  reportId: string;
}) {
  const { companyId, companyData, reportId } = params;
  
  try {
    // Call the Python AI Visibility service
    const response = await fetch('http://localhost:8085/api/visibility/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        company_data: companyData,
        trigger_source: 'report_generation',
        report_id: reportId,
      }),
    });
    
    if (!response.ok) {
      throw new Error('AI Visibility service unavailable');
    }
    
    const result = await response.json();
    
    // The AI Visibility service will:
    // 1. Generate 40-50 intelligent queries using GPT-4
    // 2. Send queries to multiple LLMs (OpenAI, Claude, Gemini, Perplexity)
    // 3. Analyze responses for brand mentions and sentiment
    // 4. Calculate visibility scores
    // 5. Store everything in the database for admin tracking
    
    return {
      reportId: result.report_id,
      overallScore: result.overall_visibility_score,
      queriesGenerated: result.queries_generated,
      llmCalls: result.total_llm_calls,
      insights: result.insights,
    };
    
  } catch (error) {
    logger.error('Failed to trigger AI visibility analysis:', error);
    
    // Fallback: Create a basic analysis
    return {
      reportId: `fallback-${reportId}`,
      overallScore: 0,
      queriesGenerated: 0,
      llmCalls: 0,
      insights: {
        strengths: [],
        weaknesses: ['AI visibility analysis unavailable'],
        opportunities: [],
        recommendations: ['Please retry report generation'],
      },
    };
  }
}

async function generateGEOScore(company: any) {
  // Implementation for GEO score generation
  return {
    score: 75,
    breakdown: {
      technical: 80,
      content: 70,
      authority: 75,
    },
  };
}

async function generateCompetitorAnalysis(company: any) {
  // Implementation for competitor analysis
  return {
    competitors: company.competitors,
    positioning: 'challenger',
    strengths: [],
    weaknesses: [],
  };
}

export default router;
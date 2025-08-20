/**
 * Enhanced Query Generation Routes
 * Endpoints for testing and managing enhanced query generation
 */

import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { asyncHandler } from '../utils/async-handler';
import { logger } from '../utils/logger';
import { PromptBuilderService } from '../services/prompt-builder.service';
import { queryGenerationService } from '../services/query-generation.service';

const router = Router();
const promptBuilder = new PromptBuilderService();

/**
 * Get query category distribution for a company
 */
router.get(
  '/company/:companyId/distribution',
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.params;
    
    const result = await db.query(
      `SELECT 
        category,
        COUNT(*) as query_count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage,
        SUM(CASE WHEN priority >= 8 THEN 1 ELSE 0 END) as high_priority_count,
        AVG(priority) as avg_priority
      FROM ai_queries
      WHERE company_id = $1 AND category IS NOT NULL
      GROUP BY category
      ORDER BY query_count DESC`,
      [companyId]
    );
    
    const summary = await db.query(
      `SELECT 
        COUNT(*) as total_queries,
        AVG(priority) as avg_priority,
        SUM(CASE WHEN commercial_value = 'high' THEN 1 ELSE 0 END) as high_value_count
      FROM ai_queries
      WHERE company_id = $1`,
      [companyId]
    );
    
    res.json({
      company_id: parseInt(companyId),
      distribution: result.rows,
      summary: summary.rows[0]
    });
  })
);

/**
 * Get sample queries by category
 */
router.get(
  '/company/:companyId/samples',
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const { category } = req.query;
    
    let query = `
      SELECT 
        query_text as query,
        category,
        intent,
        priority,
        persona,
        platform_optimization,
        commercial_value
      FROM ai_queries
      WHERE company_id = $1
    `;
    
    const params: any[] = [companyId];
    
    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }
    
    query += ' ORDER BY priority DESC, category LIMIT 20';
    
    const result = await db.query(query, params);
    
    res.json({
      company_id: parseInt(companyId),
      category: category || 'all',
      queries: result.rows
    });
  })
);

/**
 * Generate enhanced prompt for a company (for testing)
 */
router.post(
  '/company/:companyId/generate-prompt',
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.params;
    
    // Fetch company data
    const companyResult = await db.query(
      `SELECT c.*, 
              array_agg(DISTINCT comp.competitor_name) FILTER (WHERE comp.competitor_name IS NOT NULL) as competitors
       FROM companies c
       LEFT JOIN competitors comp ON c.id = comp.company_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [companyId]
    );
    
    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    const company = companyResult.rows[0];
    const enhancedContext = promptBuilder.buildEnhancedContext(company);
    const prompt = promptBuilder.buildQueryGenerationPrompt(enhancedContext);
    
    res.json({
      company_id: parseInt(companyId),
      company_name: company.name,
      context: enhancedContext,
      prompt: prompt,
      prompt_length: prompt.length,
      estimated_tokens: Math.ceil(prompt.length / 4)
    });
  })
);

/**
 * Trigger enhanced query generation with custom context
 */
router.post(
  '/company/:companyId/generate-enhanced',
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const { additionalContext, forceRegenerate } = req.body;
    
    logger.info(`Enhanced query generation requested for company ${companyId}`);
    
    // Check existing queries
    if (!forceRegenerate) {
      const existing = await db.query(
        'SELECT COUNT(*) as count FROM ai_queries WHERE company_id = $1',
        [companyId]
      );
      
      if (existing.rows[0]?.count > 0) {
        return res.status(400).json({
          error: 'Queries already exist',
          count: existing.rows[0].count,
          message: 'Use forceRegenerate=true to override'
        });
      }
    }
    
    // Fetch company data with enhanced fields
    const companyResult = await db.query(
      `SELECT c.*, 
              array_agg(DISTINCT comp.competitor_name) FILTER (WHERE comp.competitor_name IS NOT NULL) as competitors,
              array_agg(DISTINCT ps.service_name) FILTER (WHERE ps.service_name IS NOT NULL) as products_services
       FROM companies c
       LEFT JOIN competitors comp ON c.id = comp.company_id
       LEFT JOIN products_services ps ON c.id = ps.company_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [companyId]
    );
    
    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    const company = companyResult.rows[0];
    
    // Build enhanced context with any additional context from request
    let enhancedContext = promptBuilder.buildEnhancedContext(company);
    
    if (additionalContext) {
      // Merge additional context
      enhancedContext = {
        ...enhancedContext,
        ...additionalContext
      };
    }
    
    // Schedule enhanced generation
    await queryGenerationService.scheduleQueryGeneration(parseInt(companyId));
    
    res.json({
      success: true,
      company_id: parseInt(companyId),
      company_name: company.name,
      message: 'Enhanced query generation scheduled',
      context_summary: {
        industry: enhancedContext.company.industry,
        competitors: enhancedContext.competitors.direct_competitors.length,
        target_personas: enhancedContext.target_audience.secondary_personas.length + 1,
        products_services: enhancedContext.products_services.main_offerings.length
      }
    });
  })
);

/**
 * Analyze query coverage for a company
 */
router.get(
  '/company/:companyId/coverage',
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.params;
    
    // Check coverage across categories
    const coverageResult = await db.query(
      `SELECT 
        CASE WHEN SUM(CASE WHEN category = 'problem_unaware' THEN 1 ELSE 0 END) >= 6 THEN true ELSE false END as problem_unaware_covered,
        CASE WHEN SUM(CASE WHEN category = 'solution_seeking' THEN 1 ELSE 0 END) >= 8 THEN true ELSE false END as solution_seeking_covered,
        CASE WHEN SUM(CASE WHEN category = 'brand_specific' THEN 1 ELSE 0 END) >= 6 THEN true ELSE false END as brand_specific_covered,
        CASE WHEN SUM(CASE WHEN category = 'comparison' THEN 1 ELSE 0 END) >= 6 THEN true ELSE false END as comparison_covered,
        CASE WHEN SUM(CASE WHEN category = 'purchase_intent' THEN 1 ELSE 0 END) >= 6 THEN true ELSE false END as purchase_intent_covered,
        CASE WHEN SUM(CASE WHEN category = 'use_case' THEN 1 ELSE 0 END) >= 4 THEN true ELSE false END as use_case_covered,
        COUNT(*) as total_queries,
        COUNT(DISTINCT category) as categories_used,
        COUNT(DISTINCT intent) as intents_covered,
        COUNT(DISTINCT persona) as personas_covered
      FROM ai_queries
      WHERE company_id = $1`,
      [companyId]
    );
    
    const coverage = coverageResult.rows[0];
    
    // Calculate coverage score
    let coverageScore = 0;
    if (coverage.problem_unaware_covered) coverageScore += 16.67;
    if (coverage.solution_seeking_covered) coverageScore += 16.67;
    if (coverage.brand_specific_covered) coverageScore += 16.67;
    if (coverage.comparison_covered) coverageScore += 16.67;
    if (coverage.purchase_intent_covered) coverageScore += 16.67;
    if (coverage.use_case_covered) coverageScore += 16.67;
    
    res.json({
      company_id: parseInt(companyId),
      coverage: {
        ...coverage,
        coverage_score: Math.round(coverageScore),
        coverage_grade: coverageScore >= 90 ? 'A' : coverageScore >= 75 ? 'B' : coverageScore >= 60 ? 'C' : 'D'
      },
      recommendations: getCoverageRecommendations(coverage)
    });
  })
);

// Helper function for recommendations
function getCoverageRecommendations(coverage: any): string[] {
  const recommendations = [];
  
  if (!coverage.problem_unaware_covered) {
    recommendations.push('Add more problem-unaware queries to capture users who don\'t know your solution exists');
  }
  if (!coverage.solution_seeking_covered) {
    recommendations.push('Increase solution-seeking queries to appear when users research options');
  }
  if (!coverage.brand_specific_covered) {
    recommendations.push('Add brand-specific queries to control your brand narrative');
  }
  if (!coverage.comparison_covered) {
    recommendations.push('Include more comparison queries to win competitive evaluations');
  }
  if (!coverage.purchase_intent_covered) {
    recommendations.push('Add purchase-intent queries to capture ready-to-buy users');
  }
  if (!coverage.use_case_covered) {
    recommendations.push('Include use-case specific queries for niche applications');
  }
  
  return recommendations;
}

export default router;
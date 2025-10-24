/**
 * Onboarding API Routes
 * Handles the complete onboarding flow from email to dashboard
 */

import { Router, Request, Response } from 'express';
import { enrichmentService } from '../services/enrichment.service';
import { queryGenerationService } from '../services/query-generation.service';
import { emailService } from '../services/email.service';
import { cacheService } from '../services/cache.service';
import Redis from 'ioredis';
import axios from 'axios';
import { WebSocket } from 'ws';
import { db } from '../database/connection';
import Bull from 'bull';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Initialize Bull queue for audit processing
export const auditQueue = new Bull('ai-visibility-audit', {
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
      delay: 2000,
    },
  },
});

// NOTE: Worker removed - Intelligence Engine directly consumes from Redis queue
// The Intelligence Engine has its own job processor that:
// 1. Reads jobs directly from Redis queue (no HTTP hop needed)
// 2. Fetches company data from database directly
// 3. Updates audit status to 'processing'
// 4. Generates queries and executes full audit pipeline

// WebSocket connections for real-time updates
const onboardingConnections = new Map<string, WebSocket>();

/**
 * Test endpoint to verify onboarding routes are working
 */
router.get('/test', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    message: 'Onboarding routes are working',
    timestamp: new Date().toISOString()
  });
});

/**
 * Validate work email
 */
router.post('/validate-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Track user immediately when they enter email
    if (db) {
      try {
        await db.query(
          `INSERT INTO user_tracking (email, first_seen, last_activity, ip_address, user_agent)
           VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $2, $3)
           ON CONFLICT (email) 
           DO UPDATE SET last_activity = CURRENT_TIMESTAMP, ip_address = $2, user_agent = $3`,
          [email, ipAddress, userAgent]
        );
        
        // First, mark as 'email_entered' when they submit email
        const sessionId = `session_${Date.now()}_${email}`;
        await db.query(
          `INSERT INTO onboarding_sessions (session_id, email, status, created_at)
           VALUES ($1, $2, 'email_entered', CURRENT_TIMESTAMP)
           ON CONFLICT (email) 
           DO UPDATE SET status = CASE 
             WHEN onboarding_sessions.status = 'email_entered' THEN 'email_entered'
             ELSE onboarding_sessions.status 
           END, 
           last_activity = CURRENT_TIMESTAMP`,
          [sessionId, email]
        );
        
        // Log activity
        await db.query(
          `INSERT INTO activity_log (user_email, action_type, action_details, ip_address, user_agent, page_url, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [email, 'email_entered', JSON.stringify({ email }), ipAddress, userAgent, req.headers.referer || '/onboarding']
        );
      } catch (dbError) {
        console.error('Failed to track user:', dbError);
      }
    }

    const validation = await enrichmentService.validateCorporateEmail(email);
    
    // Store email validation result and update status
    if (db) {
      try {
        await db.query(
          `INSERT INTO email_validations (email, domain, is_valid, is_business_email, validation_method, created_at)
           VALUES ($1, $2, $3, $4, 'corporate_check', CURRENT_TIMESTAMP)`,
          [email, validation.domain || email.split('@')[1], validation.valid, validation.valid]
        );
        
        // If validation successful, update status to 'email_validated'
        if (validation.valid) {
          await db.query(
            `UPDATE onboarding_sessions 
             SET status = 'email_validated', 
                 steps_completed = COALESCE(steps_completed, '[]'::jsonb) || 
                   jsonb_build_array(jsonb_build_object('step', 'email_validation', 'timestamp', CURRENT_TIMESTAMP::text)),
                 last_activity = CURRENT_TIMESTAMP
             WHERE email = $1`,
            [email]
          );
        }
      } catch (dbError) {
        console.error('Failed to store email validation:', dbError);
      }
    }
    
    if (!validation.valid) {
      return res.status(400).json({
        valid: false,
        message: validation.reason || 'Invalid corporate email'
      });
    }

    res.json({
      valid: true,
      domain: validation.domain
    });
  } catch (error: any) {
    console.error('Email validation error:', error);
    res.status(500).json({ error: 'Failed to validate email' });
  }
});

/**
 * Enrich company from email
 */
router.post('/enrich', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const enrichStartTime = Date.now();
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check cache first
    const cachedCompany = await cacheService.getCachedCompany(email);
    if (cachedCompany) {
      console.log(`Cache hit for company lookup: ${email}`);
      
      // Generate session ID for cached data
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await redis.setex(sessionId, 3600, JSON.stringify({ email, enrichmentData: cachedCompany }));
      
      return res.json({
        sessionId,
        enrichmentData: cachedCompany,
        nextStep: '/onboarding/company',
        fromCache: true
      });
    }

    // Update user tracking
    if (db) {
      try {
        await db.query(
          `UPDATE user_tracking SET last_activity = CURRENT_TIMESTAMP WHERE email = $1`,
          [email]
        );
      } catch (dbError) {
        console.error('Failed to update user tracking:', dbError);
      }
    }

    // Validate email first
    const validation = await enrichmentService.validateCorporateEmail(email);
    if (!validation.valid) {
      console.error(`Email validation failed for ${email}:`, validation.reason);
      return res.status(400).json({
        error: validation.reason || 'Invalid corporate email'
      });
    }

    // Enrich company data
    console.log(`Starting enrichment for ${email}...`);
    const enrichmentData = await enrichmentService.enrichFromEmail(email);
    console.log(`Enrichment result for ${email}:`, {
      source: enrichmentData.enrichmentSource,
      confidence: enrichmentData.confidence,
      hasBusinessModel: !!enrichmentData.business_model
    });
    
    // Store in Redis for session
    const sessionId = `onboarding:${Date.now()}:${validation.domain}`;
    await redis.setex(sessionId, 3600, JSON.stringify({
      email,
      enrichmentData,
      step: 'company_details'
    }));

    // Store company data and onboarding session in database
    if (db) {
      try {
        // Store company with original data tracking
        // CRITICAL: Only store enrichment data - NEVER overwrite user-provided descriptions
        const companyResult = await db.query(
          `INSERT INTO companies (
            name, domain, description, industry, website_url, enrichment_data,
            original_name, original_description, original_industry,
            source_type, data_completeness, created_at
          )
           VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, 'enrichment', $7, CURRENT_TIMESTAMP)
           ON CONFLICT (domain)
           DO UPDATE SET
             enrichment_data = $6,
             -- ONLY update these fields if they are NULL (never overwrite user data)
             name = COALESCE(companies.name, $1),
             description = COALESCE(companies.description, $3),
             industry = COALESCE(companies.industry, $4),
             data_completeness = $7,
             updated_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [enrichmentData.name, enrichmentData.domain, enrichmentData.description,
           enrichmentData.industry, `https://${enrichmentData.domain}`, JSON.stringify(enrichmentData),
           calculateDataCompleteness(enrichmentData)]
        );
        
        // Log enrichment attempt
        await db.query(
          `INSERT INTO company_enrichment_log (
            company_id, enrichment_type, enrichment_source, raw_response, 
            extracted_data, data_quality, fields_enriched, created_at
          )
          VALUES ($1, 'email', $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [companyResult.rows[0].id, enrichmentData.enrichmentSource || 'clearbit',
           JSON.stringify(enrichmentData), JSON.stringify(enrichmentData),
           enrichmentData.confidence || 0.5, Object.keys(enrichmentData).length]
        );
        
        // Update onboarding session with enhanced tracking
        const enrichTime = Date.now() - enrichStartTime;
        await db.query(
          `INSERT INTO onboarding_sessions (
            session_id, email, status, steps_completed, metadata, 
            original_company_data, time_on_company_step, last_activity, created_at
          )
          VALUES ($1, $2, 'company_enriched', 
            jsonb_build_array(jsonb_build_object('step', 'company_enrichment', 'timestamp', CURRENT_TIMESTAMP::text)),
            $3::jsonb, $4::jsonb, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (session_id) 
          DO UPDATE SET 
            status = 'company_enriched',
            steps_completed = COALESCE(onboarding_sessions.steps_completed, '[]'::jsonb) || 
              jsonb_build_array(jsonb_build_object('step', 'company_enrichment', 'timestamp', CURRENT_TIMESTAMP::text)),
            metadata = COALESCE(onboarding_sessions.metadata, '{}'::jsonb) || $3::jsonb,
            original_company_data = $4::jsonb,
            time_on_company_step = $5,
            last_activity = CURRENT_TIMESTAMP`,
          [sessionId, email, JSON.stringify({ company_id: companyResult.rows[0].id, enrichmentData }),
           JSON.stringify(enrichmentData), Math.round(enrichTime / 1000)]
        );
        
        // Track user journey analytics
        await db.query(
          `INSERT INTO user_journey_analytics (
            session_id, company_id, journey_stage, stage_started_at,
            stage_completed_at, time_spent_seconds, actions_taken, created_at
          )
          VALUES ($1, $2, 'company_enrichment', $3, CURRENT_TIMESTAMP, $4, $5, CURRENT_TIMESTAMP)`,
          [sessionId, companyResult.rows[0].id, new Date(Date.now() - enrichTime),
           Math.round(enrichTime / 1000), JSON.stringify([{action: 'enrichment_completed', timestamp: new Date()}])]
        );
        
        // Log activity
        await db.query(
          `INSERT INTO activity_log (user_email, session_id, action_type, action_details, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [email, sessionId, 'company_enrichment', JSON.stringify(enrichmentData), ipAddress, userAgent]
        );
      } catch (dbError) {
        console.error('Failed to store enrichment data:', dbError);
      }
    }

    // Cache the enrichment data for future use
    await cacheService.cacheCompanyLookup(email, enrichmentData);

    // Start background crawl
    startBackgroundCrawl(enrichmentData.domain, sessionId);

    res.json({
      sessionId,
      enrichmentData,
      nextStep: '/onboarding/company'
    });
  } catch (error: any) {
    console.error('Enrichment error:', error);
    res.status(500).json({ error: 'Failed to enrich company data' });
  }
});

/**
 * Track company edits during onboarding
 */
router.post('/track-edit', async (req: Request, res: Response) => {
  try {
    const { sessionId, field, oldValue, newValue, step } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    if (!sessionId || !field) {
      return res.status(400).json({ error: 'Session ID and field are required' });
    }

    // Get session data
    const sessionData = await redis.get(sessionId);
    if (!sessionData) {
      return res.status(400).json({ error: 'Invalid or expired session' });
    }

    const session = JSON.parse(sessionData);
    const email = session.email;
    const companyDomain = session.enrichmentData?.domain;

    if (db && companyDomain) {
      try {
        // Get company ID
        const companyResult = await db.query(
          `SELECT id FROM companies WHERE domain = $1`,
          [companyDomain]
        );
        
        if (companyResult.rows[0]) {
          const companyId = companyResult.rows[0].id;
          
          // Track edit in history
          await db.query(
            `INSERT INTO company_edit_history (
              company_id, session_id, field_name, old_value, new_value,
              edit_source, edit_step, ip_address, user_agent, created_at
            )
            VALUES ($1, $2, $3, $4, $5, 'onboarding', $6, $7, $8, CURRENT_TIMESTAMP)`,
            [companyId, sessionId, field, oldValue, newValue, step, ipAddress, userAgent]
          );
          
          // Update company with edited values and track edit count
          await db.query(
            `UPDATE companies 
             SET ${field} = $1,
                 user_edited = TRUE,
                 edit_count = COALESCE(edit_count, 0) + 1,
                 last_edited_at = CURRENT_TIMESTAMP,
                 final_${field} = $1
             WHERE id = $2`,
            [newValue, companyId]
          );
          
          // Update onboarding session
          await db.query(
            `UPDATE onboarding_sessions 
             SET edited_company_data = COALESCE(edited_company_data, original_company_data)::jsonb || 
                   jsonb_build_object($1, $2),
                 total_edits = COALESCE(total_edits, 0) + 1,
                 last_activity = CURRENT_TIMESTAMP
             WHERE session_id = $3`,
            [field, newValue, sessionId]
          );
        }
      } catch (dbError) {
        console.error('Failed to track edit:', dbError);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Edit tracking error:', error);
    res.status(500).json({ error: 'Failed to track edit' });
  }
});

/**
 * Generate AI description
 */
router.post('/generate-description', async (req: Request, res: Response) => {
  try {
    const { sessionId, company, crawledPages, userEditedCompany } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const descriptionStartTime = Date.now();
    
    if (!sessionId || !company) {
      return res.status(400).json({ error: 'Session ID and company data are required' });
    }

    // Get session data
    const sessionData = await redis.get(sessionId);
    if (!sessionData) {
      return res.status(400).json({ error: 'Invalid or expired session' });
    }

    const session = JSON.parse(sessionData);
    const email = session.email;

    // Update user tracking
    if (db && email) {
      try {
        await db.query(
          `UPDATE user_tracking SET last_activity = CURRENT_TIMESTAMP WHERE email = $1`,
          [email]
        );
      } catch (dbError) {
        console.error('Failed to update user tracking:', dbError);
      }
    }

    // Use edited company data if provided
    const companyData = userEditedCompany || company;
    
    // Generate description using real content
    const description = await enrichmentService.generateDescription(companyData, crawledPages);
    
    // Update session
    session.description = description;
    session.company = companyData;  // Store the edited version
    session.step = 'description';
    await redis.setex(sessionId, 3600, JSON.stringify(session));

    // Update database
    if (db) {
      try {
        // Update onboarding session with description tracking
        const descriptionTime = Date.now() - descriptionStartTime;
        await db.query(
          `UPDATE onboarding_sessions 
           SET status = 'description_generated', 
               steps_completed = COALESCE(steps_completed, '[]'::jsonb) || 
                 jsonb_build_array(jsonb_build_object('step', 'description_generation', 'timestamp', CURRENT_TIMESTAMP::text)),
               metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
               ai_generated_descriptions = jsonb_build_array($2::jsonb),
               selected_description = $3,
               time_on_description_step = COALESCE(time_on_description_step, 0) + $4,
               edited_company_data = $5::jsonb,
               last_activity = CURRENT_TIMESTAMP
           WHERE email = $6 OR session_id = $7`,
          [JSON.stringify({ description, wordCount: description.split(' ').length }),
           JSON.stringify({ text: description, generated_at: new Date() }),
           description, Math.round(descriptionTime / 1000),
           JSON.stringify(companyData), email, sessionId]
        );
        
        // If company was edited, save final version
        if (userEditedCompany && companyData.domain) {
          await db.query(
            `UPDATE companies 
             SET final_name = $1, final_description = $2, final_industry = $3,
                 user_edited = TRUE
             WHERE domain = $4`,
            [companyData.name, companyData.description, companyData.industry, companyData.domain]
          );
        }
        
        // Log activity
        await db.query(
          `INSERT INTO activity_log (user_email, session_id, action_type, action_details, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [email, sessionId, 'description_generation', JSON.stringify({ description, wordCount: description.split(' ').length }), ipAddress, userAgent]
        );
        
        // Track API usage if using OpenAI
        await db.query(
          `INSERT INTO api_usage (user_email, api_provider, endpoint, tokens_used, success, created_at)
           VALUES ($1, 'openai', 'generate_description', $2, true, CURRENT_TIMESTAMP)`,
          [email, Math.round(description.length * 0.75)] // Rough token estimate
        );
      } catch (dbError) {
        console.error('Failed to update database:', dbError);
      }
    }

    res.json({
      description,
      wordCount: description.split(' ').length,
      nextStep: '/onboarding/description'
    });
  } catch (error: any) {
    console.error('Description generation error:', error);
    res.status(500).json({ error: 'Failed to generate description' });
  }
});

/**
 * Save description edits
 */
router.post('/save-description', async (req: Request, res: Response) => {
  try {
    const { sessionId, description, editedDescription, originalDescription } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Update session in Redis
    const sessionData = await redis.get(sessionId);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.description = editedDescription || description;
      session.editedDescription = editedDescription;
      session.originalDescription = originalDescription;
      session.descriptionEdited = editedDescription !== originalDescription;
      await redis.set(sessionId, JSON.stringify(session));
    }

    // CRITICAL FIX: Update companies table with user's edited description
    if (db && sessionData) {
      const session = JSON.parse(sessionData);
      const companyDomain = session.enrichmentData?.domain;
      const finalDescription = editedDescription || description;

      if (companyDomain && finalDescription) {
        try {
          // Update companies table with user's description
          await db.query(
            `UPDATE companies
             SET description = $1,
                 original_description = COALESCE(original_description, $1),
                 final_description = $1,
                 user_edited = TRUE,
                 edit_count = COALESCE(edit_count, 0) + 1,
                 last_edited_at = CURRENT_TIMESTAMP
             WHERE domain = $2`,
            [finalDescription, companyDomain]
          );

          console.log(`✅ Saved user description for ${companyDomain} (${finalDescription.length} chars)`);
        } catch (companyUpdateError) {
          console.error('Failed to update companies table:', companyUpdateError);
        }
      }

      // Update onboarding_sessions table
      try {
        await db.query(
          `UPDATE onboarding_sessions
           SET description_text = $2,
               edited_description = $3,
               description_edit_count = COALESCE(description_edit_count, 0) + 1,
               last_activity = CURRENT_TIMESTAMP
           WHERE session_id = $1`,
          [sessionId, description, editedDescription]
        );
      } catch (dbError) {
        console.error('Failed to update onboarding_sessions:', dbError);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Save description error:', error);
    res.status(500).json({ error: 'Failed to save description' });
  }
});

/**
 * Find competitors
 */
router.post('/find-competitors', async (req: Request, res: Response) => {
  try {
    const { sessionId, company } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const competitorStartTime = Date.now();
    
    if (!sessionId || !company) {
      return res.status(400).json({ error: 'Session ID and company data are required' });
    }

    // Get session data
    const sessionData = await redis.get(sessionId);
    if (!sessionData) {
      return res.status(400).json({ error: 'Invalid or expired session' });
    }

    const session = JSON.parse(sessionData);
    const email = session.email;

    // Update user tracking
    if (db && email) {
      try {
        await db.query(
          `UPDATE user_tracking SET last_activity = CURRENT_TIMESTAMP WHERE email = $1`,
          [email]
        );
      } catch (dbError) {
        console.error('Failed to update user tracking:', dbError);
      }
    }

    // Find competitors using Search Intelligence
    const competitors = await enrichmentService.findCompetitors(company);
    
    // Update session
    session.competitors = competitors;
    session.step = 'competitors';
    await redis.setex(sessionId, 3600, JSON.stringify(session));

    // Store competitors in database
    if (db && company.domain) {
      try {
        // Get company ID
        const companyResult = await db.query(
          `SELECT id FROM companies WHERE domain = $1`,
          [company.domain]
        );
        
        if (companyResult.rows[0]) {
          const companyId = companyResult.rows[0].id;
          
          // Store each competitor (handle both string and object formats)
          for (const competitor of competitors || []) {
            const competitorName = typeof competitor === 'string' ? competitor : competitor.name;
            const competitorDomain = typeof competitor === 'string' ? 'unknown' : (competitor.domain || 'unknown');

            if (competitorName && competitorDomain) {
              await db.query(
                `INSERT INTO competitors (company_id, competitor_name, competitor_domain, discovery_source, created_at)
                 VALUES ($1, $2, $3, 'ai_suggested', CURRENT_TIMESTAMP)
                 ON CONFLICT (company_id, competitor_domain) DO NOTHING`,
                [companyId, competitorName, competitorDomain]
              );
            }
          }
        }
        
        // Update onboarding session with competitor tracking
        const competitorTime = Date.now() - competitorStartTime;
        await db.query(
          `UPDATE onboarding_sessions 
           SET status = 'competitors_selected', 
               steps_completed = COALESCE(steps_completed, '[]'::jsonb) || 
                 jsonb_build_array(jsonb_build_object('step', 'competitor_discovery', 'timestamp', CURRENT_TIMESTAMP::text)),
               metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
               suggested_competitors = $2::jsonb,
               final_competitors = $2::jsonb,
               time_on_competitor_step = COALESCE(time_on_competitor_step, 0) + $3,
               last_activity = CURRENT_TIMESTAMP
           WHERE email = $4 OR session_id = $5`,
          [JSON.stringify({ competitors, count: competitors.length }),
           JSON.stringify(competitors), Math.round(competitorTime / 1000),
           email, sessionId]
        );
        
        // Log activity
        await db.query(
          `INSERT INTO activity_log (user_email, session_id, action_type, action_details, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [email, sessionId, 'competitor_discovery', JSON.stringify({ competitors, count: competitors.length }), ipAddress, userAgent]
        );
      } catch (dbError) {
        console.error('Failed to store competitors:', dbError);
      }
    }

    res.json({
      competitors,
      count: competitors.length,
      nextStep: '/onboarding/competitors'
    });
  } catch (error: any) {
    console.error('Competitor discovery error:', error);
    res.status(500).json({ error: 'Failed to find competitors' });
  }
});

/**
 * Complete onboarding and start full analysis
 */
router.post('/complete', async (req: Request, res: Response) => {
  console.log('=== ONBOARDING COMPLETE ENDPOINT CALLED ===');
  try {
    const { sessionId, email, company, competitors, description, editedDescription, companyName, domain, industry, additionalInfo } = req.body;
    const completionTime = Date.now();
    
    // Allow simplified onboarding for testing
    let finalEmail = email;
    let finalCompany = company;
    
    if (!email && !sessionId) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Handle simplified test data or direct field mapping
    if (!company && companyName && domain) {
      finalCompany = {
        name: companyName,
        domain: domain,
        industry: industry || 'Technology',
        description: description || `${companyName} is a leading company in ${industry || 'Technology'}`,
        size: req.body.company_size || req.body.size,
        location: req.body.location ? {
          city: req.body.location.split(',')[0]?.trim(),
          state: req.body.location.split(',')[1]?.trim(),
          country: req.body.location.split(',')[2]?.trim() || 'United States'
        } : undefined,
        value_proposition: req.body.value_proposition,
        sub_industry: req.body.sub_industry,
        products_services: req.body.products_services,
        originalName: companyName,
        originalDescription: description
      };
    }
    
    if (!finalEmail || !finalCompany) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    // Get session data from Redis
    const sessionData = await redis.get(sessionId);
    if (!sessionData) {
      // For development, allow completion without session
      console.warn('No session found, continuing anyway for development');
    }

    // For now, create a simplified response without database
    // This allows the onboarding to complete while database setup is pending
    try {
      // Import required services carefully
      const { userRepository } = require('../database/repositories/user.repository');
      const { companyRepository } = require('../database/repositories/company.repository');
      const { authService } = require('../services/auth.service');
      const { db } = require('../database/connection');

      // Start database transaction
      const result = await db.transaction(async (client: any) => {
      // 1. Create or update company in database with final data
      let companyRecord = await companyRepository.findByDomain(finalCompany.domain);
      
      if (!companyRecord) {
        // Prioritize user-provided descriptions over enrichment
        const userDescription = editedDescription || description || finalCompany.originalDescription || finalCompany.description;

        companyRecord = await companyRepository.create({
          name: finalCompany.name,
          domain: finalCompany.domain,
          logo_url: finalCompany.logo,
          description: userDescription,
          original_name: finalCompany.originalName || finalCompany.name,
          original_description: userDescription,  // Save user's detailed description here
          final_name: finalCompany.name,
          final_description: userDescription,
          user_edited: !!(editedDescription || description) || finalCompany.userEdited,
          industry: finalCompany.industry,
          sub_industry: finalCompany.sub_industry,
          value_proposition: finalCompany.value_proposition,
          products_services: finalCompany.products_services,
          company_size: finalCompany.size || finalCompany.company_size,
          employee_count: finalCompany.employeeCount,
          headquarters_city: finalCompany.location?.city,
          headquarters_state: finalCompany.location?.state,
          headquarters_country: finalCompany.location?.country,
          location: finalCompany.location ? 
            `${finalCompany.location.city || ''}${finalCompany.location.state ? ', ' + finalCompany.location.state : ''}${finalCompany.location.country ? ', ' + finalCompany.location.country : ''}`.trim() : 
            undefined,
          linkedin_url: finalCompany.socialProfiles?.linkedin,
          twitter_url: finalCompany.socialProfiles?.twitter,
          facebook_url: finalCompany.socialProfiles?.facebook,
          tech_stack: finalCompany.techStack,
          tags: finalCompany.tags,
          enrichment_source: finalCompany.enrichmentSource || 'manual',
          enrichment_data: finalCompany,
          enrichment_confidence: finalCompany.confidence,
          enrichment_date: new Date()
        });
      }

      // 2. Create user account
      let user = await userRepository.findByEmail(finalEmail);
      
      if (!user) {
        user = await userRepository.create({
          email: finalEmail,
          work_email: finalEmail,
          company_id: companyRecord.id,
          email_verified: true, // Auto-verify since they came through onboarding
          onboarding_completed: true,
          onboarding_completed_at: new Date()
        });
      } else {
        // Update existing user
        await userRepository.update(user.id, {
          company_id: companyRecord.id,
          onboarding_completed: true,
          onboarding_completed_at: new Date()
        });
      }

      // 3. Save competitors (handle both string and object formats)
      if (competitors && competitors.length > 0) {
        for (const competitor of competitors) {
          const competitorName = typeof competitor === 'string' ? competitor : competitor.name;
          // Use placeholder domain if not provided
          const competitorDomain = typeof competitor === 'string' 
            ? `${competitorName.toLowerCase().replace(/\s+/g, '')}.com` 
            : (competitor.domain || `${competitor.name.toLowerCase().replace(/\s+/g, '')}.com`);
          
          if (competitorName) {
            await companyRepository.addCompetitor({
              company_id: companyRecord.id,
              competitor_name: competitorName,
              competitor_domain: competitorDomain,
              discovery_source: typeof competitor === 'string' ? 'manual' : (competitor.source || 'manual'),
              discovery_reason: typeof competitor === 'string' ? null : competitor.reason,
              similarity_score: typeof competitor === 'string' ? null : competitor.similarity,
              added_by_user_id: user.id
            });
          }
        }
      }

      // 4. Save complete onboarding session with all tracking data
      await db.query(`
        INSERT INTO onboarding_sessions (
          session_id, user_id, email, current_step, status,
          email_validated, company_enriched, description_generated,
          competitors_selected, completed, completed_at,
          company_data, description_text,
          final_company_data, edited_description,
          final_competitors,
          data_quality_score, completeness_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (session_id) DO UPDATE SET
          status = 'completed',
          current_step = 'complete',
          completed = true,
          completed_at = CURRENT_TIMESTAMP,
          user_id = EXCLUDED.user_id,
          final_company_data = EXCLUDED.final_company_data,
          edited_description = EXCLUDED.edited_description,
          final_competitors = EXCLUDED.final_competitors,
          data_quality_score = EXCLUDED.data_quality_score,
          completeness_score = EXCLUDED.completeness_score
      `, [
        sessionId,
        user.id,
        email,
        'complete',
        'completed',  // status
        true,
        true,
        true,
        true,
        true,
        new Date(),
        JSON.stringify(company),
        description,
        JSON.stringify(company),  // final_company_data
        editedDescription || description,  // edited_description
        JSON.stringify(competitors || []),  // final_competitors
        Math.min(9.99, calculateDataQuality(company) / 10),  // data_quality_score (scale to 0-9.99)
        Math.min(9.99, calculateDataCompleteness(company) / 10)  // completeness_score (scale to 0-9.99)
      ]);
      
      // Log final journey analytics
      await db.query(
        `INSERT INTO user_journey_analytics (
          user_id, session_id, company_id, journey_stage,
          stage_started_at, stage_completed_at, time_spent_seconds,
          actions_taken, created_at
        )
        VALUES ($1, $2, $3, 'onboarding_complete', $4, CURRENT_TIMESTAMP, $5, $6, CURRENT_TIMESTAMP)`,
        [user.id, sessionId, companyRecord.id, new Date(completionTime),
         Math.round((Date.now() - completionTime) / 1000),
         JSON.stringify([{action: 'completed_onboarding', timestamp: new Date()}])]
      );

      return { user, company: companyRecord };
    });

    // 5. Start full analysis jobs
    console.log('Transaction result:', JSON.stringify(result, null, 2));
    const analysisJobs = await startFullAnalysis(result.company, competitors);
    
    // 6. Save analysis job IDs
    await db.query(`
      UPDATE onboarding_sessions 
      SET geo_analysis_job_id = $1, 
          crawl_job_id = $2,
          search_analysis_job_id = $3
      WHERE session_id = $4
    `, [
      analysisJobs.find((j: any) => j.type === 'geo')?.id,
      analysisJobs.find((j: any) => j.type === 'crawl')?.id,
      analysisJobs.find((j: any) => j.type === 'search')?.id,
      sessionId
    ]);

    // 7. Create user session (auto-login)
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const session = await authService.createSession(result.user, ipAddress, userAgent);
    
    // 8. Clear Redis session
    await redis.del(sessionId);
    
    // 9. Trigger full AI Visibility Audit automatically
    const companyId = result?.company?.id;
    if (companyId) {
      try {
        // Create audit record and queue job for background processing
        const auditId = uuidv4();

        // Create audit record
        await db.query(
          `INSERT INTO ai_visibility_audits (
            id, company_id, company_name, status, query_count, current_phase, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [
            auditId,
            companyId,
            result.company.name || 'Unknown',
            'queued',
            48,
            'pending'
          ]
        );

        // Queue job for background processing (job processor will generate queries)
        const job = await auditQueue.add('process-audit', {
          auditId,
          companyId,
          userId: result.user.id || 'api_user',
          queryCount: 48,
          providers: ['openai_gpt5', 'anthropic_claude', 'google_gemini', 'perplexity'],
          config: {
            company_name: result.company.name || 'Unknown',
            domain: result.company.domain,
            industry: result.company.industry || 'Technology'
          }
        });

        console.log(`[Onboarding] ✅ Audit queued - Audit ID: ${auditId}, Job ID: ${job.id}`);
      } catch (auditError) {
        console.error(`Failed to queue audit for company ${companyId}:`, auditError);
        // Don't fail onboarding if audit queueing fails
      }

      // 10. Generate dashboard URL for the user
      try {
        const crypto = require('crypto');
        const dashboardId = crypto.randomBytes(16).toString('hex');
        const dashboardUrl = `${process.env.DASHBOARD_BASE_URL || 'http://localhost:3000'}/dashboard/${dashboardId}`;
        
        // Store dashboard URL in database
        await db.query(
          `INSERT INTO user_dashboards (user_email, company_id, dashboard_id, dashboard_url, dashboard_status)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_email) 
           DO UPDATE SET dashboard_url = $4, dashboard_status = $5`,
          [email, companyId, dashboardId, dashboardUrl, 'active']
        );
        
        // Update user tracking
        await db.query(
          `UPDATE user_tracking 
           SET company_id = $1, 
               dashboard_url = $2, 
               dashboard_ready = true, 
               dashboard_ready_at = CURRENT_TIMESTAMP
           WHERE email = $3`,
          [companyId, dashboardUrl, email]
        );
        
        console.log(`Dashboard URL generated for user ${email}: ${dashboardUrl}`);
        
        // 11. Send email with dashboard link
        try {
          await emailService.sendDashboardReadyEmail(
            email,
            dashboardUrl,
            result.company.name,
            session.session_token
          );
          console.log(`Dashboard email sent to ${email}`);
        } catch (emailError) {
          console.error('Failed to send dashboard email:', emailError);
        }
      } catch (dashboardError) {
        console.error('Failed to generate dashboard URL:', dashboardError);
      }
    }

    res.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        company: {
          id: result.company.id,
          name: result.company.name,
          domain: result.company.domain
        }
      },
      auth: {
        token: session.session_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at
      },
      analysisJobs,
      redirectUrl: '/dashboard?onboarding=complete'
    });
  } catch (dbError: any) {
    console.error('Database operation failed, using fallback:', dbError.message);
    // Note: Audit creation is already handled in the main transaction above
    // This fallback only handles returning response to user
      
      // Fallback response without database
      // Still try to update onboarding status to completed
      if (db) {
        try {
          await db.query(
            `UPDATE onboarding_sessions 
             SET status = 'completed', 
                 completed_at = CURRENT_TIMESTAMP,
                 steps_completed = COALESCE(steps_completed, '[]'::jsonb) || 
                   jsonb_build_array(jsonb_build_object('step', 'onboarding_completed', 'timestamp', CURRENT_TIMESTAMP::text)),
                 last_activity = CURRENT_TIMESTAMP
             WHERE email = $1`,
            [finalEmail]
          );
          
          // Also update users table if exists
          await db.query(
            `UPDATE users SET onboarding_completed = true WHERE email = $1`,
            [finalEmail]
          );
        } catch (e) {
          console.log('Failed to update completion status:', e);
        }
      }
      
      // Generate a simple JWT token for development
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { 
          userId: `user_${Date.now()}`,
          email: finalEmail,
          company: finalCompany.name || finalCompany.domain
        },
        process.env.JWT_SECRET || 'development-secret',
        { expiresIn: '24h' }
      );
      
      // Return success without database persistence
      res.json({
        success: true,
        user: {
          id: `user_${Date.now()}`,
          email: finalEmail,
          company: {
            id: Date.now(),
            name: finalCompany.name || finalCompany.domain,
            domain: finalCompany.domain
          }
        },
        auth: {
          token: token,
          refreshToken: token, // Same token for simplicity in dev
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        analysisJobs: [
          { type: 'geo', id: `job_geo_${Date.now()}` },
          { type: 'crawl', id: `job_crawl_${Date.now()}` },
          { type: 'search', id: `job_search_${Date.now()}` }
        ],
        redirectUrl: '/dashboard?onboarding=complete',
        note: 'Running in development mode without database persistence'
      });
    }
  } catch (error: any) {
    console.error('Onboarding completion error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// WebSocket support removed - handled at the main gateway level
// Use the main gateway WebSocket at ws://localhost:4000/ws for real-time updates

// Helper functions

/**
 * Start background crawl for company website
 */
async function startBackgroundCrawl(domain: string, sessionId: string) {
  try {
    const crawlerService = process.env.CRAWLER_SERVICE || 'http://localhost:3002';
    const response = await axios.post(`${crawlerService}/api/crawl`, {
      url: `https://${domain}`,
      options: {
        maxPages: 10,
        extractMetadata: true
      }
    });
    
    // Send update via WebSocket
    const ws = onboardingConnections.get(sessionId);
    if (ws) {
      ws.send(JSON.stringify({
        type: 'crawl_started',
        jobId: response.data.id
      }));
    }
    
    return response.data.id;
  } catch (error) {
    console.error('Failed to start crawl:', error);
    return null;
  }
}

/**
 * Start full analysis for company and competitors
 */
async function startFullAnalysis(company: any, competitors: any[]) {
  const jobs: any[] = [];
  
  // AI VISIBILITY ANALYSIS - Generate queries and analyze with LLMs
  try {
    console.log('Starting AI Visibility analysis for company:', company.name);
    const reportService = process.env.API_GATEWAY || 'http://localhost:4000';
    const reportResponse = await axios.post(`${reportService}/api/reports/generate-internal`, {
      companyId: company.id,
      userId: company.user_id,
      reportType: 'comprehensive',
      includeAIVisibility: true,
      includeCompetitorAnalysis: true
    });
    
    if (reportResponse.data.reportId) {
      jobs.push({ type: 'ai_visibility', id: reportResponse.data.reportId });
      console.log('AI Visibility report queued:', reportResponse.data.reportId);
    }
  } catch (error) {
    console.error('AI Visibility analysis failed:', error);
  }
  
  // GEO analysis
  try {
    const geoService = process.env.GEO_SERVICE || 'http://localhost:8002';
    const geoResponse = await axios.post(`${geoService}/api/v1/geo/analyze/batch`, {
      urls: [company.domain, ...competitors.map((c: any) => c.domain)]
    });
    jobs.push({ type: 'geo', id: geoResponse.data.jobId });
  } catch (error) {
    console.error('GEO analysis failed:', error);
  }
  
  // Crawl analysis
  try {
    const crawlerService = process.env.CRAWLER_SERVICE || 'http://localhost:3002';
    const crawlResponse = await axios.post(`${crawlerService}/api/crawl`, {
      url: `https://${company.domain}`,
      options: { maxPages: 100 }
    });
    jobs.push({ type: 'crawl', id: crawlResponse.data.id });
  } catch (error) {
    console.error('Crawl analysis failed:', error);
  }
  
  // Search Intelligence analysis
  try {
    const searchService = process.env.SEARCH_SERVICE || 'http://localhost:3002';
    const searchResponse = await axios.post(`${searchService}/api/search-intelligence/analyze`, {
      brand: company.name,
      domain: company.domain,
      competitors: competitors.map((c: any) => c.domain)
    });
    jobs.push({ type: 'search', id: searchResponse.data.analysisId });
  } catch (error) {
    console.error('Search analysis failed:', error);
  }
  
  return jobs;
}

/**
 * Store user data in database
 */
async function storeUserData(email: string, company: any, competitors: any[], analysisJobs: any[]) {
  // This would connect to your PostgreSQL database
  // For now, we'll store in Redis
  const userData = {
    email,
    company,
    competitors,
    analysisJobs,
    createdAt: new Date().toISOString()
  };
  
  await redis.setex(`user:${email}`, 86400, JSON.stringify(userData));
  return userData;
}

/**
 * Calculate data completeness percentage
 */
function calculateDataCompleteness(data: any): number {
  const fields = [
    'name', 'domain', 'description', 'industry', 'size',
    'employeeCount', 'logo', 'location', 'socialProfiles', 'techStack'
  ];
  
  let filledFields = 0;
  fields.forEach(field => {
    if (data[field]) {
      if (typeof data[field] === 'object' && !Array.isArray(data[field])) {
        // Check if object has values
        if (Object.keys(data[field]).some(key => data[field][key])) {
          filledFields++;
        }
      } else if (Array.isArray(data[field]) && data[field].length > 0) {
        filledFields++;
      } else if (data[field]) {
        filledFields++;
      }
    }
  });
  
  // Ensure the result fits in NUMERIC(3,2) - max 99.99
  const percentage = (filledFields / fields.length) * 100;
  return Math.min(99.99, Math.round(percentage * 100) / 100);
}

/**
 * Calculate data quality score
 */
function calculateDataQuality(data: any): number {
  let score = 0;
  let weights = 0;
  
  // Name and domain are critical
  if (data.name && data.name.length > 2) {
    score += 20;
    weights += 20;
  }
  
  if (data.domain && data.domain.includes('.')) {
    score += 20;
    weights += 20;
  }
  
  // Description quality
  if (data.description) {
    const wordCount = data.description.split(' ').length;
    if (wordCount > 50) score += 15;
    else if (wordCount > 20) score += 10;
    else if (wordCount > 0) score += 5;
    weights += 15;
  }
  
  // Other important fields
  if (data.industry) { score += 10; weights += 10; }
  if (data.employeeCount || data.size) { score += 10; weights += 10; }
  if (data.location && data.location.city) { score += 10; weights += 10; }
  if (data.logo) { score += 5; weights += 5; }
  if (data.techStack && data.techStack.length > 0) { score += 10; weights += 10; }
  
  return weights > 0 ? Math.round((score / weights) * 100) : 0;
}

/**
 * Track step transitions and time spent
 */
router.post('/track-step', async (req: Request, res: Response) => {
  try {
    const { sessionId, fromStep, toStep, timeSpent } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Get session data from Redis
    const sessionData = await redis.get(sessionId);
    if (!sessionData) {
      return res.status(400).json({ error: 'Invalid or expired session' });
    }

    const session = JSON.parse(sessionData);
    
    // Update session in database with time tracking
    if (db) {
      try {
        // Map step names to database columns
        const timeColumns: Record<string, string> = {
          'company': 'time_on_company_step',
          'description': 'time_on_description_step', 
          'competitors': 'time_on_competitor_step'
        };
        
        const columnName = timeColumns[fromStep];
        if (columnName && timeSpent) {
          await db.query(
            `UPDATE onboarding_sessions 
             SET ${columnName} = COALESCE(${columnName}, 0) + $1,
                 last_activity = CURRENT_TIMESTAMP
             WHERE session_id = $2`,
            [Math.round(timeSpent / 1000), sessionId]
          );
        }

        // Track journey analytics
        await db.query(
          `INSERT INTO user_journey_analytics (
            session_id, journey_stage, stage_started_at, stage_completed_at,
            time_spent_seconds, created_at
          )
          VALUES ($1, $2, CURRENT_TIMESTAMP - INTERVAL '${timeSpent} milliseconds', 
                  CURRENT_TIMESTAMP, $3, CURRENT_TIMESTAMP)`,
          [sessionId, fromStep, Math.round(timeSpent / 1000)]
        );
      } catch (dbError) {
        console.error('Failed to track step time:', dbError);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Step tracking error:', error);
    res.status(500).json({ error: 'Failed to track step' });
  }
});

/**
 * Enhanced edit tracking with proper session handling
 */
router.post('/track-field-edit', async (req: Request, res: Response) => {
  try {
    const { sessionId, field, oldValue, newValue, step } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    if (!sessionId || !field) {
      return res.status(400).json({ error: 'Session ID and field are required' });
    }

    // Get session data from Redis
    const sessionData = await redis.get(sessionId);
    if (!sessionData) {
      return res.status(400).json({ error: 'Invalid or expired session' });
    }

    const session = JSON.parse(sessionData);
    const email = session.email;
    const companyDomain = session.enrichmentData?.domain;

    if (db && companyDomain) {
      try {
        // Get company ID
        const companyResult = await db.query(
          `SELECT id FROM companies WHERE domain = $1`,
          [companyDomain]
        );
        
        if (companyResult.rows[0]) {
          const companyId = companyResult.rows[0].id;
          
          // Track edit in history with proper session_id
          await db.query(
            `INSERT INTO company_edit_history (
              company_id, session_id, field_name, old_value, new_value,
              edit_source, edit_step, ip_address, user_agent, created_at
            )
            VALUES ($1, $2, $3, $4, $5, 'onboarding', $6, $7, $8, CURRENT_TIMESTAMP)`,
            [companyId, sessionId, field, oldValue || '', newValue || '', step || 'company', ipAddress, userAgent]
          );
          
          // Update company with edited values (using safe parameterized queries)
          if (field === 'name') {
            await db.query(
              `UPDATE companies
               SET name = $1, final_name = $1, original_name = COALESCE(original_name, $1),
                   user_edited = TRUE, edit_count = COALESCE(edit_count, 0) + 1,
                   last_edited_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [newValue, companyId]
            );
          } else if (field === 'description') {
            await db.query(
              `UPDATE companies
               SET description = $1, final_description = $1, original_description = COALESCE(original_description, $1),
                   user_edited = TRUE, edit_count = COALESCE(edit_count, 0) + 1,
                   last_edited_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [newValue, companyId]
            );
            console.log(`✅ Saved user-edited description for company ${companyId} (${newValue.length} chars)`);
          } else if (field === 'industry') {
            await db.query(
              `UPDATE companies
               SET industry = $1, final_industry = $1, original_industry = COALESCE(original_industry, $1),
                   user_edited = TRUE, edit_count = COALESCE(edit_count, 0) + 1,
                   last_edited_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [newValue, companyId]
            );
          } else if (field === 'business_model') {
            // Update business_model in enrichment_data JSONB
            await db.query(
              `UPDATE companies
               SET enrichment_data = COALESCE(enrichment_data, '{}'::jsonb) || jsonb_build_object('business_model', $1::text),
                   user_edited = TRUE, edit_count = COALESCE(edit_count, 0) + 1,
                   last_edited_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [newValue, companyId]
            );
            console.log(`✅ Updated business_model to ${newValue} for company ${companyId}`);
          }

          // Update session tracking
          await db.query(
            `UPDATE onboarding_sessions 
             SET edited_company_data = COALESCE(edited_company_data, '{}'::jsonb) || 
                   jsonb_build_object($1, $2),
                 total_edits = COALESCE(total_edits, 0) + 1,
                 last_activity = CURRENT_TIMESTAMP
             WHERE session_id = $3`,
            [field, newValue, sessionId]
          );
        }
      } catch (dbError) {
        console.error('Failed to track edit:', dbError);
        return res.status(500).json({ error: 'Failed to track edit' });
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Edit tracking error:', error);
    res.status(500).json({ error: 'Failed to track edit' });
  }
});

/**
 * Track competitor changes (additions/removals)
 */
router.post('/track-competitor-change', async (req: Request, res: Response) => {
  try {
    const { 
      sessionId, 
      action, // 'add' | 'remove' | 'finalize'
      competitor,
      suggestedCompetitors,
      finalCompetitors 
    } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Get session data from Redis
    const sessionData = await redis.get(sessionId);
    if (!sessionData) {
      return res.status(400).json({ error: 'Invalid or expired session' });
    }

    const session = JSON.parse(sessionData);
    
    if (db) {
      try {
        // Get or create the onboarding session record
        const sessionResult = await db.query(
          `SELECT suggested_competitors, user_added_competitors, removed_competitors 
           FROM onboarding_sessions WHERE session_id = $1`,
          [sessionId]
        );

        let currentSuggested = sessionResult.rows[0]?.suggested_competitors || suggestedCompetitors || [];
        let currentAdded = sessionResult.rows[0]?.user_added_competitors || [];
        let currentRemoved = sessionResult.rows[0]?.removed_competitors || [];

        // Handle different actions
        if (action === 'add' && competitor) {
          // Add to user_added_competitors if not in suggested
          if (!currentSuggested.includes(competitor)) {
            currentAdded = [...new Set([...currentAdded, competitor])];
          }
        } else if (action === 'remove' && competitor) {
          // Add to removed_competitors if it was suggested
          if (currentSuggested.includes(competitor)) {
            currentRemoved = [...new Set([...currentRemoved, competitor])];
          }
          // Remove from added if it was manually added
          currentAdded = currentAdded.filter((c: string) => c !== competitor);
        } else if (action === 'finalize' && finalCompetitors) {
          // Store the final selection
          await db.query(
            `UPDATE onboarding_sessions 
             SET suggested_competitors = COALESCE(suggested_competitors, $2::jsonb),
                 user_added_competitors = $3::jsonb,
                 removed_competitors = $4::jsonb,
                 final_competitors = $5::jsonb,
                 last_activity = CURRENT_TIMESTAMP
             WHERE session_id = $1`,
            [sessionId, 
             JSON.stringify(suggestedCompetitors || currentSuggested),
             JSON.stringify(currentAdded),
             JSON.stringify(currentRemoved),
             JSON.stringify(finalCompetitors)]
          );
          
          return res.json({ success: true, finalized: true });
        }

        // Update the session with current state
        if (action === 'add' || action === 'remove') {
          await db.query(
            `UPDATE onboarding_sessions
             SET suggested_competitors = COALESCE(suggested_competitors, $2::jsonb),
                 user_added_competitors = $3::jsonb,
                 removed_competitors = $4::jsonb,
                 last_activity = CURRENT_TIMESTAMP
             WHERE session_id = $1`,
            [sessionId,
             JSON.stringify(suggestedCompetitors || currentSuggested),
             JSON.stringify(currentAdded),
             JSON.stringify(currentRemoved)]
          );
        }

        res.json({ 
          success: true,
          userAddedCompetitors: currentAdded,
          removedCompetitors: currentRemoved
        });
      } catch (dbError) {
        console.error('Failed to track competitor change:', dbError);
        return res.status(500).json({ error: 'Failed to track competitor change' });
      }
    } else {
      res.json({ success: true });
    }
  } catch (error: any) {
    console.error('Competitor tracking error:', error);
    res.status(500).json({ error: 'Failed to track competitor change' });
  }
});

export default router;
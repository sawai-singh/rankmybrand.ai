import { v4 as uuidv4 } from 'uuid';
import {
  Recommendation,
  ExecutionResult,
  ExecutionTransaction,
  ExecutionStep,
  Brand
} from '../types';
import { WordPress } from '../integrations/wordpress';
import { Webflow } from '../integrations/webflow';
import { GitHub } from '../integrations/github';
import { Database } from '../lib/database';
import { NotificationService } from '../lib/notification';
import { logger } from '../lib/logger';
import { MetricsCollector } from '../lib/metrics';

export class AutoExecutor {
  private wordpress: WordPress;
  private webflow: Webflow;
  private github: GitHub;
  private db: Database;
  private notifications: NotificationService;
  private metrics: MetricsCollector;
  private approvedTypes: Set<string>;
  private executionCount: number = 0;
  private dailyLimit: number;

  constructor(
    db: Database,
    notifications: NotificationService,
    metrics: MetricsCollector
  ) {
    this.db = db;
    this.notifications = notifications;
    this.metrics = metrics;
    
    this.wordpress = new WordPress();
    this.webflow = new Webflow();
    this.github = new GitHub();
    
    // Auto-approve safe operations
    this.approvedTypes = new Set([
      'meta_optimization',
      'faq_addition',
      'schema_markup',
      'draft_creation'
    ]);
    
    this.dailyLimit = parseInt(process.env.MAX_AUTO_EXECUTIONS_PER_DAY || '10');
  }

  async execute(recommendation: Recommendation): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    logger.info(`Executing recommendation ${recommendation.id} of type ${recommendation.type}`);
    
    // Check if auto-execution is allowed
    if (!await this.canAutoExecute(recommendation)) {
      return this.queueForApproval(recommendation);
    }
    
    // Check daily limit
    if (this.executionCount >= this.dailyLimit) {
      logger.warn(`Daily execution limit reached (${this.dailyLimit})`);
      return this.queueForApproval(recommendation);
    }
    
    let transaction: ExecutionTransaction | null = null;
    
    try {
      // Start transaction for rollback capability
      transaction = await this.startTransaction(recommendation);
      
      // Execute based on type
      let result: ExecutionResult;
      
      switch (recommendation.type) {
        case 'content_creation':
          result = await this.publishContent(recommendation, transaction);
          break;
          
        case 'schema_markup':
          result = await this.updateSchema(recommendation, transaction);
          break;
          
        case 'meta_optimization':
          result = await this.updateMetaTags(recommendation, transaction);
          break;
          
        case 'faq_addition':
          result = await this.addFAQ(recommendation, transaction);
          break;
          
        case 'technical_optimization':
          result = await this.executeTechnicalOptimization(recommendation, transaction);
          break;
          
        case 'link_building':
          result = await this.createLinkBuildingTask(recommendation, transaction);
          break;
          
        case 'competitive_response':
          result = await this.executeCompetitiveResponse(recommendation, transaction);
          break;
          
        default:
          result = await this.createManualTask(recommendation, transaction);
      }
      
      // Commit transaction
      await this.commitTransaction(transaction);
      
      // Update execution count
      this.executionCount++;
      
      // Track execution
      await this.trackExecution(recommendation, result);
      
      // Record metrics
      this.metrics.recordExecution(
        recommendation.type,
        result.platform || 'unknown',
        result.success ? 'success' : 'failed',
        Date.now() - startTime
      );
      
      // Notify stakeholders
      await this.notifications.notifyExecution(recommendation, result);
      
      return result;
      
    } catch (error) {
      logger.error(`Execution failed for ${recommendation.id}:`, error);
      
      // Rollback on failure
      if (transaction) {
        await this.rollback(transaction, error as Error);
      }
      
      // Record failure metric
      this.metrics.recordExecution(
        recommendation.type,
        'unknown',
        'error',
        Date.now() - startTime
      );
      
      return {
        success: false,
        recommendationId: recommendation.id,
        error: (error as Error).message,
        executionTimeMs: Date.now() - startTime,
        rollbackAvailable: !!transaction
      };
    }
  }

  private async canAutoExecute(recommendation: Recommendation): Promise<boolean> {
    // Check global flag
    if (process.env.AUTO_EXECUTION_ENABLED !== 'true') {
      logger.info('Auto-execution disabled globally');
      return false;
    }
    
    // Get brand settings
    const brand = await this.db.getBrand(recommendation.brandId);
    if (!brand.settings?.autoExecutionEnabled) {
      logger.info(`Auto-execution disabled for brand ${recommendation.brandId}`);
      return false;
    }
    
    // Check if type is approved
    if (!this.approvedTypes.has(recommendation.type)) {
      const brandApprovedTypes = brand.settings?.approvedTypes || [];
      if (!brandApprovedTypes.includes(recommendation.type)) {
        logger.info(`Type ${recommendation.type} not approved for auto-execution`);
        return false;
      }
    }
    
    // Check priority threshold
    if (recommendation.priority < 70 && recommendation.implementationEffort !== 'easy') {
      logger.info(`Priority ${recommendation.priority} below threshold for auto-execution`);
      return false;
    }
    
    return true;
  }

  private async queueForApproval(recommendation: Recommendation): Promise<ExecutionResult> {
    logger.info(`Queuing recommendation ${recommendation.id} for approval`);
    
    // Create approval request
    await this.db.createApprovalRequest({
      recommendationId: recommendation.id,
      requestedBy: 'system',
      requestedAt: new Date()
    });
    
    // Update recommendation status
    await this.db.updateRecommendationStatus(recommendation.id, 'pending');
    
    // Send notification
    await this.notifications.notifyApprovalRequired(recommendation);
    
    return {
      success: true,
      recommendationId: recommendation.id,
      error: 'Queued for approval',
      executionTimeMs: 0,
      rollbackAvailable: false
    };
  }

  private async startTransaction(recommendation: Recommendation): Promise<ExecutionTransaction> {
    const transaction: ExecutionTransaction = {
      id: uuidv4(),
      recommendationId: recommendation.id,
      startedAt: new Date(),
      steps: [],
      status: 'pending'
    };
    
    // Save transaction to database
    await this.db.saveTransaction(transaction);
    
    return transaction;
  }

  private async commitTransaction(transaction: ExecutionTransaction): Promise<void> {
    transaction.status = 'committed';
    await this.db.updateTransaction(transaction);
    logger.info(`Transaction ${transaction.id} committed`);
  }

  private async rollback(transaction: ExecutionTransaction, error: Error): Promise<void> {
    logger.warn(`Rolling back transaction ${transaction.id} due to: ${error.message}`);
    
    // Execute rollback steps in reverse order
    for (let i = transaction.steps.length - 1; i >= 0; i--) {
      const step = transaction.steps[i];
      
      if (step.rollbackData) {
        try {
          await this.executeRollbackStep(step);
        } catch (rollbackError) {
          logger.error(`Rollback failed for step ${step.action}:`, rollbackError);
        }
      }
    }
    
    transaction.status = 'rolled_back';
    await this.db.updateTransaction(transaction);
  }

  private async executeRollbackStep(step: ExecutionStep): Promise<void> {
    switch (step.platform) {
      case 'wordpress':
        await this.wordpress.rollback(step.rollbackData);
        break;
      case 'webflow':
        await this.webflow.rollback(step.rollbackData);
        break;
      case 'github':
        await this.github.rollback(step.rollbackData);
        break;
    }
  }

  private async publishContent(
    recommendation: Recommendation,
    transaction: ExecutionTransaction
  ): Promise<ExecutionResult> {
    const brand = await this.db.getBrand(recommendation.brandId);
    const platform = await this.detectPlatform(brand);
    
    const isDraftMode = process.env.DRAFT_MODE_ONLY === 'true' || 
                       brand.settings?.draftModeOnly;
    
    let result: any;
    const step: ExecutionStep = {
      action: 'publish_content',
      platform,
      request: {
        title: recommendation.title,
        content: recommendation.content,
        status: isDraftMode ? 'draft' : 'publish'
      }
    };
    
    try {
      if (platform === 'wordpress') {
        result = await this.wordpress.createPost({
          title: recommendation.title,
          content: recommendation.content || '',
          status: isDraftMode ? 'draft' : 'publish',
          categories: recommendation.metadata?.categories,
          tags: recommendation.metadata?.tags,
          meta: {
            _yoast_wpseo_metadesc: recommendation.metadata?.metaDescription
          }
        });
        
        step.response = result;
        step.rollbackData = { postId: result.id };
        
      } else if (platform === 'webflow') {
        result = await this.webflow.createItem({
          collection: 'blog-posts',
          fields: {
            name: recommendation.title,
            content: recommendation.content || '',
            slug: this.generateSlug(recommendation.title),
            'meta-description': recommendation.metadata?.metaDescription
          }
        });
        
        step.response = result;
        step.rollbackData = { itemId: result.id };
        
      } else {
        // Fallback: create markdown file in repo
        const slug = this.generateSlug(recommendation.title);
        result = await this.github.createFile({
          path: `content/blog/${slug}.md`,
          content: this.convertToMarkdown(recommendation),
          message: `Auto-generated: ${recommendation.title}`,
          branch: 'auto-content'
        });
        
        step.response = result;
        step.rollbackData = { path: result.path, sha: result.sha };
      }
      
      transaction.steps.push(step);
      
      return {
        success: true,
        recommendationId: recommendation.id,
        platform,
        resultUrl: result.url || result.link,
        resultId: result.id || result.sha,
        executionTimeMs: 0,
        rollbackAvailable: true
      };
      
    } catch (error) {
      step.error = (error as Error).message;
      transaction.steps.push(step);
      throw error;
    }
  }

  private async updateSchema(
    recommendation: Recommendation,
    transaction: ExecutionTransaction
  ): Promise<ExecutionResult> {
    const brand = await this.db.getBrand(recommendation.brandId);
    const platform = await this.detectPlatform(brand);
    
    const step: ExecutionStep = {
      action: 'update_schema',
      platform,
      request: {
        schema: recommendation.content
      }
    };
    
    try {
      let result: any;
      
      if (platform === 'wordpress') {
        // Update schema via WordPress
        result = await this.wordpress.updateSchema({
          pageId: recommendation.metadata?.pageId,
          schema: recommendation.content || ''
        });
      } else {
        // Update via GitHub
        result = await this.github.updateFile({
          path: 'public/schema.json',
          content: recommendation.content || '',
          message: `Update schema: ${recommendation.title}`,
          branch: 'auto-schema'
        });
        
        step.rollbackData = { path: result.path, sha: result.sha };
      }
      
      step.response = result;
      transaction.steps.push(step);
      
      return {
        success: true,
        recommendationId: recommendation.id,
        platform,
        resultId: result.id || result.sha,
        executionTimeMs: 0,
        rollbackAvailable: true
      };
      
    } catch (error) {
      step.error = (error as Error).message;
      transaction.steps.push(step);
      throw error;
    }
  }

  private async updateMetaTags(
    recommendation: Recommendation,
    transaction: ExecutionTransaction
  ): Promise<ExecutionResult> {
    const brand = await this.db.getBrand(recommendation.brandId);
    const platform = await this.detectPlatform(brand);
    
    const step: ExecutionStep = {
      action: 'update_meta',
      platform,
      request: recommendation.metadata
    };
    
    try {
      let result: any;
      
      if (platform === 'wordpress') {
        result = await this.wordpress.updatePostMeta({
          postId: recommendation.metadata?.postId,
          meta: recommendation.metadata?.meta || {}
        });
      } else {
        // Update via code
        result = await this.github.updateFile({
          path: recommendation.metadata?.filePath || 'pages/meta.json',
          content: JSON.stringify(recommendation.metadata?.meta, null, 2),
          message: `Update meta: ${recommendation.title}`,
          branch: 'auto-meta'
        });
      }
      
      step.response = result;
      step.rollbackData = result;
      transaction.steps.push(step);
      
      return {
        success: true,
        recommendationId: recommendation.id,
        platform,
        executionTimeMs: 0,
        rollbackAvailable: true
      };
      
    } catch (error) {
      step.error = (error as Error).message;
      transaction.steps.push(step);
      throw error;
    }
  }

  private async addFAQ(
    recommendation: Recommendation,
    transaction: ExecutionTransaction
  ): Promise<ExecutionResult> {
    // Similar implementation to publishContent but specifically for FAQ
    return this.publishContent(recommendation, transaction);
  }

  private async executeTechnicalOptimization(
    recommendation: Recommendation,
    transaction: ExecutionTransaction
  ): Promise<ExecutionResult> {
    // Create a task for technical optimization
    return this.createManualTask(recommendation, transaction);
  }

  private async createLinkBuildingTask(
    recommendation: Recommendation,
    transaction: ExecutionTransaction
  ): Promise<ExecutionResult> {
    // Create task in project management system
    return this.createManualTask(recommendation, transaction);
  }

  private async executeCompetitiveResponse(
    recommendation: Recommendation,
    transaction: ExecutionTransaction
  ): Promise<ExecutionResult> {
    // Publish competitive response content
    return this.publishContent(recommendation, transaction);
  }

  private async createManualTask(
    recommendation: Recommendation,
    transaction: ExecutionTransaction
  ): Promise<ExecutionResult> {
    // Create task in project management system or as GitHub issue
    const result = await this.github.createIssue({
      title: recommendation.title,
      body: `
        ## Recommendation
        ${recommendation.description}
        
        ## Priority
        ${recommendation.priority}/100
        
        ## Estimated Impact
        ${recommendation.estimatedImpact}/100
        
        ## Implementation
        ${recommendation.content || 'Manual implementation required'}
        
        ---
        *Generated by RankMyBrand Action Center*
      `,
      labels: ['auto-generated', recommendation.type, `priority-${recommendation.priority > 70 ? 'high' : recommendation.priority > 40 ? 'medium' : 'low'}`]
    });
    
    return {
      success: true,
      recommendationId: recommendation.id,
      platform: 'github',
      resultUrl: result.html_url,
      resultId: result.number.toString(),
      executionTimeMs: 0,
      rollbackAvailable: false
    };
  }

  private async detectPlatform(brand: Brand): Promise<string> {
    if (brand.platform) {
      return brand.platform;
    }
    
    // Try to detect platform
    if (process.env.WORDPRESS_URL) {
      return 'wordpress';
    }
    
    if (process.env.WEBFLOW_API_KEY) {
      return 'webflow';
    }
    
    return 'github'; // Default fallback
  }

  private async trackExecution(
    recommendation: Recommendation,
    result: ExecutionResult
  ): Promise<void> {
    await this.db.saveExecutionLog({
      recommendationId: recommendation.id,
      action: recommendation.type,
      platform: result.platform,
      status: result.success ? 'success' : 'failed',
      request: recommendation.metadata,
      response: result,
      error: result.error,
      executionTimeMs: result.executionTimeMs,
      createdAt: new Date()
    });
    
    // Update recommendation status
    await this.db.updateRecommendationStatus(
      recommendation.id,
      result.success ? 'completed' : 'failed'
    );
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private convertToMarkdown(recommendation: Recommendation): string {
    const matter = `---
title: ${recommendation.title}
date: ${new Date().toISOString()}
type: ${recommendation.type}
priority: ${recommendation.priority}
---

`;
    
    // Convert HTML content to markdown if needed
    // For now, just return the content as is
    return matter + (recommendation.content || recommendation.description);
  }
}
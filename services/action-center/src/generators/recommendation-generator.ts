import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  MetricsEvent,
  ContentGap,
  Recommendation,
  RecommendationType,
  Brand,
  GenerationOptions
} from '../types';
import { Database } from '../lib/database';
import { logger } from '../lib/logger';

export class RecommendationGenerator {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private db: Database;
  private templates: Map<string, string>;

  constructor(db: Database) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    this.db = db;
    this.templates = new Map();
    this.loadTemplates();
  }

  async generateFromGap(
    gap: ContentGap,
    metrics: MetricsEvent
  ): Promise<Recommendation> {
    logger.info(`Generating recommendation for gap: ${gap.type}`);
    
    // Analyze gap type and severity
    const gapAnalysis = await this.analyzeGap(gap, metrics);
    
    // Determine recommendation type
    const recommendationType = this.determineRecommendationType(gap, gapAnalysis);
    
    // Generate specific recommendation
    const recommendation = await this.createRecommendation(
      gap,
      metrics,
      recommendationType,
      gapAnalysis
    );
    
    // Generate implementation content if needed
    if (this.requiresContentGeneration(recommendationType)) {
      recommendation.content = await this.generateContent(
        gap,
        metrics.brandId,
        recommendationType
      );
    }
    
    // Calculate priority and impact
    recommendation.priority = this.calculatePriority(gap, metrics, recommendation);
    recommendation.estimatedImpact = this.estimateImpact(
      gap.estimatedSearchVolume || 1000,
      metrics.shareOfVoice,
      gap.competitorAdvantage
    );
    
    // Determine if auto-executable
    recommendation.autoExecutable = this.isAutoExecutable(recommendation);
    
    return recommendation;
  }

  private async analyzeGap(gap: ContentGap, metrics: MetricsEvent): Promise<any> {
    const prompt = `
      Analyze this content gap for a brand:
      
      Gap Type: ${gap.type}
      Description: ${gap.description}
      Query Examples: ${gap.queryExamples.join(', ')}
      Current GEO Score: ${metrics.geoScore}
      Current Share of Voice: ${metrics.shareOfVoice}%
      Competitor Advantage: ${gap.competitorAdvantage}
      
      Provide:
      1. Root cause analysis
      2. Urgency level (1-10)
      3. Best approach to address
      4. Expected improvement potential
      
      Format as JSON.
    `;

    try {
      const response = await this.anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';
      return JSON.parse(content);
    } catch (error) {
      logger.error('Gap analysis failed:', error);
      return {
        urgency: gap.priority,
        approach: 'content_creation',
        improvement: 0.2
      };
    }
  }

  private determineRecommendationType(gap: ContentGap, analysis: any): RecommendationType {
    const typeMap: Record<string, RecommendationType> = {
      'MISSING_TOPIC': 'content_creation',
      'WEAK_COVERAGE': 'content_creation',
      'COMPETITOR_ADVANTAGE': 'competitive_response',
      'OUTDATED_INFO': 'content_creation',
      'MISSING_FEATURE': 'faq_addition',
      'CITATION_GAP': 'link_building',
      'TECHNICAL_ISSUE': 'technical_optimization',
      'SCHEMA_MISSING': 'schema_markup'
    };

    return typeMap[gap.type] || 'content_creation';
  }

  private async createRecommendation(
    gap: ContentGap,
    metrics: MetricsEvent,
    type: RecommendationType,
    analysis: any
  ): Promise<Recommendation> {
    const brand = await this.db.getBrand(metrics.brandId);
    
    const recommendation: Recommendation = {
      id: uuidv4(),
      brandId: metrics.brandId,
      type,
      title: await this.generateTitle(gap, type),
      description: await this.generateDescription(gap, type, analysis),
      priority: 50, // Will be calculated
      estimatedImpact: 0, // Will be calculated
      implementationEffort: this.estimateEffort(type),
      autoExecutable: false, // Will be determined
      status: 'pending',
      metadata: {
        gapId: gap.id,
        platform: metrics.platform,
        geoScoreBefore: metrics.geoScore,
        shareOfVoiceBefore: metrics.shareOfVoice
      },
      createdAt: new Date()
    };

    return recommendation;
  }

  private async generateTitle(gap: ContentGap, type: RecommendationType): Promise<string> {
    const titles: Record<RecommendationType, string> = {
      'content_creation': `Create content for: ${gap.queryExamples[0] || gap.description}`,
      'technical_optimization': `Optimize: ${gap.description}`,
      'link_building': `Build citations for: ${gap.description}`,
      'competitive_response': `Counter competitor advantage: ${gap.description}`,
      'meta_optimization': `Update meta tags for: ${gap.description}`,
      'schema_markup': `Add schema markup for: ${gap.description}`,
      'faq_addition': `Add FAQ for: ${gap.queryExamples[0] || gap.description}`
    };

    return titles[type] || `Address: ${gap.description}`;
  }

  private async generateDescription(
    gap: ContentGap,
    type: RecommendationType,
    analysis: any
  ): Promise<string> {
    return `
      Recommendation to address content gap with ${analysis.urgency || 'medium'} urgency.
      Expected to improve GEO score by ${(analysis.improvement * 100).toFixed(1)}%.
      Approach: ${analysis.approach || type}.
      Queries to target: ${gap.queryExamples.join(', ')}.
    `.trim();
  }

  async generateContent(
    gap: ContentGap,
    brandId: string,
    type: RecommendationType,
    options: GenerationOptions = {}
  ): Promise<string> {
    const brand = await this.db.getBrand(brandId);
    
    const prompt = this.buildContentPrompt(gap, brand, type, options);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: options.model || process.env.OPENAI_MODEL || 'gpt-5-nano-2025-08-07',
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1500
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Post-process content
      return this.postProcessContent(content, type, options);
    } catch (error) {
      logger.error('Content generation failed:', error);
      throw error;
    }
  }

  private buildContentPrompt(
    gap: ContentGap,
    brand: Brand,
    type: RecommendationType,
    options: GenerationOptions
  ): string {
    const basePrompt = `
      Create SEO-optimized content for ${brand.name} to address this gap:
      
      Missing Topic: ${gap.description}
      Query Examples: ${gap.queryExamples.join(', ')}
      Brand: ${brand.name}
      Domain: ${brand.domain}
      Tone: ${brand.tone || 'Professional'}
      Key Terms: ${brand.keywords?.join(', ') || 'N/A'}
      
      Requirements:
      - Include relevant keywords naturally
      - Answer the specific queries comprehensively
      - Optimize for AI engine citations
      - Make it scannable with proper headings
      - Include actionable insights
      ${options.includeSchema ? '- Add JSON-LD schema markup' : ''}
      ${options.includeCitations ? '- Include authoritative citations' : ''}
      - Target length: ${options.targetLength || '500-800'} words
    `;

    const typeSpecificPrompts: Record<RecommendationType, string> = {
      'content_creation': `
        ${basePrompt}
        
        Format as a complete blog post with:
        - Engaging title
        - Meta description (155 chars)
        - Introduction
        - Main sections with H2/H3 headings
        - Conclusion with CTA
        - Format as HTML
      `,
      'faq_addition': `
        ${basePrompt}
        
        Create an FAQ section with:
        - 5-8 relevant questions
        - Comprehensive answers (100-150 words each)
        - Natural keyword integration
        - Schema.org FAQPage markup
        - Format as HTML with proper structure
      `,
      'schema_markup': `
        Create JSON-LD schema markup for:
        ${gap.description}
        
        Include appropriate schema types:
        - Organization/LocalBusiness
        - FAQPage if relevant
        - Product/Service if applicable
        - BreadcrumbList
        
        Ensure valid JSON-LD format.
      `,
      'meta_optimization': `
        Create optimized meta tags for:
        ${gap.description}
        
        Include:
        - Title tag (50-60 chars)
        - Meta description (150-155 chars)
        - Open Graph tags
        - Twitter Card tags
        - Canonical URL
        
        Format as HTML meta tags.
      `,
      'competitive_response': `
        ${basePrompt}
        
        Create content that:
        - Directly addresses competitor advantages
        - Highlights unique value propositions
        - Provides superior information
        - Includes comparison elements
        - Format as HTML
      `,
      'technical_optimization': `
        Provide technical optimization recommendations for:
        ${gap.description}
        
        Include:
        - Specific implementation steps
        - Code examples if relevant
        - Expected impact
        - Priority order
        
        Format as structured markdown.
      `,
      'link_building': `
        Create link-worthy content for:
        ${gap.description}
        
        Include:
        - Unique data or insights
        - Quotable statistics
        - Visual elements descriptions
        - Outreach email template
        
        Format as HTML with emphasis on shareability.
      `
    };

    return typeSpecificPrompts[type] || basePrompt;
  }

  private postProcessContent(
    content: string,
    type: RecommendationType,
    options: GenerationOptions
  ): string {
    // Clean up any markdown artifacts
    content = content.replace(/```html\n?/g, '').replace(/```\n?/g, '');
    
    // Add tracking parameters if needed
    if (type === 'content_creation' || type === 'competitive_response') {
      content = this.addTrackingElements(content);
    }
    
    // Validate and fix HTML if needed
    if (content.includes('<') && content.includes('>')) {
      content = this.validateHTML(content);
    }
    
    return content.trim();
  }

  private addTrackingElements(content: string): string {
    // Add UTM parameters to links
    content = content.replace(
      /href="(https?:\/\/[^"]+)"/g,
      'href="$1?utm_source=rankmybrand&utm_medium=content&utm_campaign=auto"'
    );
    
    // Add data attributes for tracking
    content = content.replace(
      /<article/g,
      '<article data-generated="auto" data-generator="rankmybrand"'
    );
    
    return content;
  }

  private validateHTML(content: string): string {
    // Basic HTML validation and fixing
    // In production, use a proper HTML parser like cheerio
    
    // Ensure closing tags
    const openTags = content.match(/<(\w+)[^>]*>/g) || [];
    const closeTags = content.match(/<\/(\w+)>/g) || [];
    
    // Add missing closing tags
    // This is a simplified version - use cheerio for production
    
    return content;
  }

  private calculatePriority(
    gap: ContentGap,
    metrics: MetricsEvent,
    recommendation: Recommendation
  ): number {
    const weights = {
      gapSeverity: 0.3,
      competitorAdvantage: 0.25,
      implementationEase: 0.2,
      currentPerformance: 0.15,
      queryVolume: 0.1
    };
    
    const scores = {
      gapSeverity: gap.priority / 10,
      competitorAdvantage: gap.competitorAdvantage,
      implementationEase: this.getImplementationEaseScore(recommendation.implementationEffort),
      currentPerformance: 1 - (metrics.geoScore / 100),
      queryVolume: Math.min((gap.estimatedSearchVolume || 1000) / 10000, 1)
    };
    
    const priority = Object.entries(weights).reduce(
      (total, [key, weight]) => {
        const score = scores[key as keyof typeof scores] || 0;
        return total + (score * weight * 100);
      },
      0
    );
    
    return Math.round(Math.min(100, Math.max(0, priority)));
  }

  private getImplementationEaseScore(effort: 'easy' | 'medium' | 'hard'): number {
    const scores = {
      'easy': 1.0,
      'medium': 0.5,
      'hard': 0.2
    };
    return scores[effort];
  }

  private estimateImpact(
    searchVolume: number,
    currentSOV: number,
    competitorAdvantage: number
  ): number {
    // Estimate potential impact on GEO score (0-100)
    const volumeImpact = Math.min(searchVolume / 10000, 1) * 30;
    const sovGap = (100 - currentSOV) / 100 * 40;
    const competitiveGap = competitorAdvantage * 30;
    
    return Math.round(volumeImpact + sovGap + competitiveGap);
  }

  private estimateEffort(type: RecommendationType): 'easy' | 'medium' | 'hard' {
    const effortMap: Record<RecommendationType, 'easy' | 'medium' | 'hard'> = {
      'meta_optimization': 'easy',
      'schema_markup': 'easy',
      'faq_addition': 'easy',
      'content_creation': 'medium',
      'technical_optimization': 'medium',
      'competitive_response': 'hard',
      'link_building': 'hard'
    };
    
    return effortMap[type] || 'medium';
  }

  private requiresContentGeneration(type: RecommendationType): boolean {
    return [
      'content_creation',
      'faq_addition',
      'competitive_response',
      'link_building'
    ].includes(type);
  }

  private isAutoExecutable(recommendation: Recommendation): boolean {
    // Check if this type can be auto-executed
    const autoExecutableTypes: RecommendationType[] = [
      'meta_optimization',
      'schema_markup',
      'faq_addition'
    ];
    
    if (!autoExecutableTypes.includes(recommendation.type)) {
      return false;
    }
    
    // Check if draft mode is required
    if (process.env.DRAFT_MODE_ONLY === 'true') {
      return true; // Can auto-execute as draft
    }
    
    // Check priority threshold
    if (recommendation.priority < 70) {
      return false; // Require approval for lower priority
    }
    
    // Check effort level
    if (recommendation.implementationEffort === 'hard') {
      return false; // Require approval for complex changes
    }
    
    return true;
  }

  private loadTemplates(): void {
    // Load content templates for common scenarios
    this.templates.set('blog_intro', `
      <p>In today's digital landscape, understanding {topic} is crucial for {benefit}. 
      This comprehensive guide will explore {key_points} to help you {outcome}.</p>
    `);
    
    this.templates.set('faq_question', `
      <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
        <h3 itemprop="name">{question}</h3>
        <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
          <div itemprop="text">{answer}</div>
        </div>
      </div>
    `);
    
    // Add more templates as needed
  }
}
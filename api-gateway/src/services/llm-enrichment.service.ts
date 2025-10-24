/**
 * LLM-based Company Enrichment Service
 * Uses OpenAI GPT to gather company information
 */

import OpenAI from 'openai';
import { CompanyEnrichment } from './enrichment.service';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class LLMEnrichmentService {
  private openai: OpenAI | null = null;

  /**
   * Lazy initialization of OpenAI client
   */
  private getOpenAI(): OpenAI {
    if (!this.openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
      }
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    return this.openai;
  }
  /**
   * Enrich company data using GPT-5
   */
  async enrichWithLLM(domain: string): Promise<CompanyEnrichment | null> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.error('OpenAI API key not configured');
        return null;
      }

      const prompt = `You are analyzing the company at domain "${domain}".

GOAL: Provide accurate, specific information that demonstrates deep understanding of this company.

Return ONLY valid JSON (no markdown, no explanations) with this structure:

{
  "name": "Official company name",
  "domain": "${domain}",
  "industry": "Specific industry (not just 'Technology' - be precise like 'Enterprise AI', 'B2B SaaS', 'E-commerce Platform')",
  "size": "Employee range",
  "employeeCount": number_or_null,

  "what_they_do": "One clear sentence explaining their core business",
  "how_they_help": "1-2 sentences on customer value and outcomes",

  "description": "Comprehensive 100-150 word description covering: what they do, key products/services, primary use cases, who they serve, and unique value. Write in third person, professional tone. Include specific details about their offerings and how they help customers. This should be trust-building and informative.",

  "products_services": [
    {
      "name": "Actual product name (NOT 'Software Solution' or 'Platform')",
      "description": "What it does in one sentence",
      "key_features": ["Specific feature 1", "Specific feature 2", "Specific feature 3"]
    }
  ],

  "unique_value_propositions": [
    "Specific differentiator 1 (e.g., '10x faster than competitors')",
    "Specific differentiator 2 (e.g., 'Only platform with X capability')",
    "Specific differentiator 3"
  ],

  "pain_points_solved": [
    "Specific problem (e.g., 'Manual data entry errors', not 'inefficiency')",
    "Another concrete pain point"
  ],

  "primary_use_cases": [
    "Specific scenario (e.g., 'Legal contract review', not 'document processing')",
    "Another concrete use case"
  ],

  "target_customer_types": [
    "Specific segment (e.g., 'Enterprise healthcare', not 'businesses')",
    "Another specific customer type"
  ],

  "competitors": [
    {
      "name": "Competitor company name",
      "main_product": "Their flagship product name",
      "company_stage": "startup|growth|enterprise|established",
      "estimated_size": "Similar size range to target company",
      "domain": "competitor-domain.com",
      "logo": "Full URL to competitor logo (try to find from their website or public sources)"
    }
  ],

  "key_features": [
    "Specific capability 1",
    "Specific capability 2",
    "Specific capability 3"
  ],

  "location": {
    "city": "HQ city",
    "state": "State/Province",
    "country": "Country"
  },

  "socialProfiles": {
    "linkedin": "URL or null",
    "twitter": "URL or null",
    "facebook": "URL or null"
  },

  "logo": "Full URL to company logo if you can find it (check their website, social media, or public sources)",

  "techStack": ["tech1", "tech2"],
  "fundingStage": "stage or null",
  "yearFounded": "year or null",

  "business_model": "B2C|B2B|B2B2C",
  "customer_type": {
    "primary": "individual_consumers|small_businesses|enterprises|developers|mixed",
    "description": "Detailed description of who actually pays for this company's products/services"
  },
  "transaction_type": "product_purchase|service_subscription|software_license|marketplace"
}

BUSINESS MODEL CLASSIFICATION GUIDE:

🎯 CRITICAL: Focus on WHO PAYS for the product/service, not what industry the company is in.

B2C (Business to Consumer):
✓ Sells to: Individual people, families, consumers
✓ Examples: Levi's (jeans), Nike (shoes), Starbucks (coffee), Netflix (streaming)
✓ Keywords: "consumers", "shoppers", "retail", "fashion", "personal use"
✓ Transaction: One-time product purchase or consumer subscription

B2B (Business to Business):
✓ Sells to: Companies, enterprises, organizations, developers
✓ Examples: Salesforce (CRM), Stripe (payments), Anthropic (AI), AWS (cloud)
✓ Keywords: "enterprise", "API", "platform", "developers", "businesses"
✓ Transaction: Software license, API access, service contract

B2B2C (Hybrid/Marketplace):
✓ Sells to: BOTH businesses AND consumers
✓ Examples: Shopify (merchants + shoppers), Uber (drivers + riders), Airbnb (hosts + guests)
✓ Keywords: "marketplace", "two-sided platform", "connects"
✓ Transaction: Mixed

🚨 CRITICAL WARNING - Don't confuse the company's INDUSTRY with their CUSTOMERS:
✅ "Apparel Manufacturing" company → Sells jeans to CONSUMERS = B2C
❌ "Apparel Manufacturing" company → Sells to manufacturers = WRONG
✅ "Manufacturing Software" company → Sells software to MANUFACTURERS = B2B
❌ "Manufacturing Software" company → Sells to consumers = WRONG

BUSINESS MODEL EXAMPLES:

✅ CORRECT B2C Classification:
{
  "name": "Levi Strauss & Co.",
  "industry": "Apparel and Denim Manufacturing",
  "business_model": "B2C",
  "customer_type": {
    "primary": "individual_consumers",
    "description": "Fashion-conscious consumers aged 18-65 shopping for durable denim and casual wear, including eco-conscious shoppers prioritizing sustainable apparel"
  },
  "transaction_type": "product_purchase"
}

❌ WRONG B2C Classification:
{
  "name": "Levi Strauss & Co.",
  "business_model": "B2B",  // WRONG!
  "customer_type": {
    "primary": "enterprises",  // WRONG!
    "description": "Manufacturing companies"  // Confused industry with customers!
  }
}

✅ CORRECT B2B Classification:
{
  "name": "Anthropic",
  "industry": "Enterprise AI",
  "business_model": "B2B",
  "customer_type": {
    "primary": "enterprises",
    "description": "Enterprise technology companies, developers, and businesses needing AI capabilities via API access"
  },
  "transaction_type": "software_license"
}

✅ CORRECT B2B2C Classification:
{
  "name": "Shopify",
  "industry": "E-commerce Platform",
  "business_model": "B2B2C",
  "customer_type": {
    "primary": "mixed",
    "description": "Small to medium businesses who use the platform to sell to individual consumers"
  },
  "transaction_type": "service_subscription"
}

QUALITY EXAMPLES:

✅ GOOD (Specific & Verifiable):
{
  "name": "Stripe",
  "industry": "Payment Processing Infrastructure",
  "what_they_do": "Stripe provides payment processing APIs for online businesses",
  "description": "Stripe is a payment infrastructure platform that enables businesses to accept payments, send payouts, and manage their online operations. Their core products include Stripe Payments for accepting cards and wallets globally, Stripe Connect for building marketplace payment flows, and Stripe Billing for subscription management. Used by companies ranging from startups to Fortune 500s, Stripe handles billions of dollars in transactions annually across 135+ currencies. They solve complex challenges like international payment processing, PCI compliance, fraud prevention, and financial reconciliation. Their API-first approach allows developers to integrate payment functionality in hours rather than months, while their built-in fraud detection (Radar) and automated compliance tools reduce operational overhead. Primary use cases include e-commerce checkout, subscription billing, multi-party marketplace payments, and global revenue optimization.",
  "products_services": [
    {
      "name": "Stripe Payments",
      "description": "Accept payments via cards, wallets, and local methods",
      "key_features": ["Global payment methods", "Instant payouts", "Fraud detection"]
    },
    {
      "name": "Stripe Connect",
      "description": "Payment infrastructure for platforms and marketplaces",
      "key_features": ["Multi-party payments", "Onboarding automation", "Compliance tools"]
    }
  ],
  "pain_points_solved": [
    "Complex international payment integration",
    "PCI compliance burden",
    "Payment fraud and chargebacks",
    "Reconciliation and reporting overhead"
  ],
  "competitors": [
    {"name": "Square", "main_product": "Square Payments", "company_stage": "established", "estimated_size": "5,000+ employees", "domain": "squareup.com", "logo": "https://squareup.com/favicon.ico"},
    {"name": "Adyen", "main_product": "Adyen Platform", "company_stage": "enterprise", "estimated_size": "3,000+ employees", "domain": "adyen.com", "logo": "https://adyen.com/favicon.ico"}
  ],
  "logo": "https://images.ctfassets.net/fzn2n1nzq965/HTTOloNPhisV9P4hlMPNA/cacf1bb88b9fc492dfad34378d844280/Stripe_icon_-_square.svg"
}

❌ BAD (Generic & Vague):
{
  "name": "Stripe",
  "industry": "Technology",  // Too broad
  "what_they_do": "Provides software solutions",  // Not specific
  "description": "Stripe is a leading technology company that provides innovative software solutions for businesses. They offer a platform that helps companies grow and succeed.",  // Only 25 words, too generic, no specifics
  "products_services": [
    {
      "name": "Payment Solution",  // Generic name
      "description": "Handles payments",  // Not useful
      "key_features": ["Fast", "Secure", "Easy"]  // Meaningless adjectives
    }
  ],
  "pain_points_solved": [
    "Business inefficiencies",  // Too vague
    "Technology challenges"  // Not specific
  ],
  "competitors": [
    {"name": "PayPal", "main_product": "Software"}  // Wrong - should be specific product
  ]
}

CRITICAL RULES:
1. ✅ Description must be 100-150 words with specific details about products, use cases, and value
2. ✅ Use actual product names found on their website
3. ✅ Pain points should be concrete problems, not adjectives
4. ✅ Features should be capabilities, not marketing fluff ("fast", "best")
5. ✅ Competitors should be at similar company stage and size
6. ✅ Industry should be 2-3 word specific category
7. ✅ List 5-10 pain points and use cases - More is better
8. ❌ Never use generic terms: "Software", "Solution", "Platform" alone
9. ❌ Never use vague adjectives: "leading", "innovative", "best"
10. ❌ Don't guess - if unsure about a field, omit it

Now analyze ${domain} following these quality standards.`;

      let content: string | null = null;

      // Use GPT-5 for company enrichment
      console.log('Using GPT-5 for company enrichment:', domain);
      try {
          const response = await this.getOpenAI().chat.completions.create({
            model: 'gpt-5-chat-latest',
            messages: [
              {
                role: 'system',
                content: 'You are a company data enrichment specialist. Provide comprehensive, specific, and accurate information. Always return valid JSON only, no markdown formatting.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 2500,  // Increased from 1500 to support richer, more detailed responses
            temperature: 0.3,  // Low temperature for factual accuracy
            response_format: { type: 'json_object' }  // Ensure JSON response
          });

          content = response.choices[0]?.message?.content;
          console.log('GPT-5 response for', domain, ':', JSON.stringify({
            hasContent: !!content,
            contentLength: content?.length || 0,
            finishReason: response.choices[0]?.finish_reason,
            usage: response.usage
          }));
          console.log('Raw content:', content);
        } catch (chatError: any) {
          console.error('GPT-5 enrichment error:', chatError);
          throw chatError;
        }

      if (!content) {
        console.error('No response content from OpenAI');
        return null;
      }

      // Parse the JSON response
      console.log('Parsing JSON from GPT-5...');
      const companyData = JSON.parse(content);

      // Calculate confidence based on data quality
      const qualityScore = this.calculateDataQuality(companyData, domain);

      // Log quality metrics
      console.log(`✅ Enrichment complete - Quality Score:`, {
        confidence: qualityScore.overallConfidence.toFixed(2),
        completeness: `${(qualityScore.completeness * 100).toFixed(0)}%`,
        specificity: `${(qualityScore.specificity * 100).toFixed(0)}%`,
        warnings: qualityScore.warnings.length
      });

      if (qualityScore.warnings.length > 0) {
        console.warn('⚠️  Quality warnings:', qualityScore.warnings);
      }

      console.log('Parsed company data:', JSON.stringify(companyData, null, 2));

      // Validate and fetch best available logo
      const validatedLogo = await this.validateAndFetchLogo(companyData.logo, domain);

      // Validate and fetch competitor logos
      const validatedCompetitors = await this.validateCompetitorLogos(companyData.competitors || []);

      // Add enrichment metadata with dynamic confidence
      return {
        ...companyData,
        enrichmentSource: 'openai-llm',
        confidence: qualityScore.overallConfidence,
        qualityMetrics: {
          completeness: qualityScore.completeness,
          specificity: qualityScore.specificity,
          warnings: qualityScore.warnings
        },
        logo: validatedLogo,
        competitors: validatedCompetitors
      } as CompanyEnrichment;

    } catch (error) {
      console.error('LLM enrichment failed:', error);
      return null;
    }
  }

  /**
   * Calculate data quality and confidence score
   * Returns honest confidence based on actual data quality
   */
  private calculateDataQuality(data: any, domain: string): {
    overallConfidence: number;
    completeness: number;
    specificity: number;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let completenessScore = 0;
    let specificityScore = 0;

    // 1. COMPLETENESS CHECK (40% of confidence)
    const criticalFields = [
      'name', 'industry', 'what_they_do', 'products_services',
      'pain_points_solved', 'primary_use_cases', 'competitors'
    ];

    const filledCritical = criticalFields.filter(field => {
      const value = data[field];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return value && Object.keys(value).length > 0;
      return value && value.trim && value.trim().length > 0;
    });

    completenessScore = filledCritical.length / criticalFields.length;

    if (completenessScore < 0.7) {
      warnings.push(`Only ${Math.round(completenessScore * 100)}% of critical fields filled`);
    }

    // 2. SPECIFICITY CHECK (40% of confidence)
    const genericTerms = [
      'software', 'solution', 'platform', 'system', 'tool',
      'service', 'product', 'technology', 'business'
    ];

    let genericCount = 0;
    let totalChecks = 0;

    // Check product names
    if (data.products_services && Array.isArray(data.products_services)) {
      data.products_services.forEach((product: any) => {
        totalChecks++;
        const name = (product.name || '').toLowerCase();
        if (genericTerms.some(term => name === term || name.endsWith(` ${term}`))) {
          genericCount++;
          warnings.push(`Generic product name: "${product.name}"`);
        }
      });
    }

    // Check industry
    if (data.industry) {
      totalChecks++;
      const industry = data.industry.toLowerCase();
      if (genericTerms.some(term => industry === term)) {
        genericCount++;
        warnings.push(`Industry too generic: "${data.industry}"`);
      }
    }

    // Check pain points for vague terms
    if (data.pain_points_solved && Array.isArray(data.pain_points_solved)) {
      data.pain_points_solved.forEach((pain: string) => {
        totalChecks++;
        const lowerPain = pain.toLowerCase();
        // Check for vague terms
        if (lowerPain.length < 15 ||
            ['inefficiency', 'challenges', 'issues', 'problems'].some(v => lowerPain === v)) {
          genericCount++;
          warnings.push(`Vague pain point: "${pain}"`);
        }
      });
    }

    specificityScore = totalChecks > 0 ? 1 - (genericCount / totalChecks) : 0.5;

    // 3. COMPETITOR QUALITY CHECK (20% of confidence)
    let competitorScore = 0;
    if (data.competitors && Array.isArray(data.competitors)) {
      const withProducts = data.competitors.filter((c: any) => c.main_product);
      const withStage = data.competitors.filter((c: any) => c.company_stage);

      competitorScore = (withProducts.length + withStage.length) / (data.competitors.length * 2);

      if (competitorScore < 0.5) {
        warnings.push('Competitor data incomplete (missing products or stages)');
      }
    } else {
      warnings.push('No competitors found');
    }

    // 4. CALCULATE OVERALL CONFIDENCE
    const overallConfidence = (
      completenessScore * 0.40 +
      specificityScore * 0.40 +
      competitorScore * 0.20
    );

    // Round to 2 decimals and cap at 0.95
    const finalConfidence = Math.min(0.95, Math.round(overallConfidence * 100) / 100);

    return {
      overallConfidence: finalConfidence,
      completeness: Math.round(completenessScore * 100) / 100,
      specificity: Math.round(specificityScore * 100) / 100,
      warnings
    };
  }

  /**
   * Validate and fetch logos for all competitors
   */
  private async validateCompetitorLogos(competitors: any[]): Promise<any[]> {
    if (!Array.isArray(competitors) || competitors.length === 0) {
      return [];
    }

    console.log(`Validating logos for ${competitors.length} competitors...`);

    // Process competitors in parallel for speed
    const validatedCompetitors = await Promise.all(
      competitors.map(async (competitor) => {
        // Handle both string and object formats
        if (typeof competitor === 'string') {
          return competitor; // Keep string format as-is
        }

        // Object format - validate logo
        const domain = competitor.domain;
        if (!domain) {
          console.warn(`No domain for competitor: ${competitor.name}`);
          return competitor;
        }

        try {
          const validatedLogo = await this.validateAndFetchLogo(competitor.logo, domain);
          console.log(`✅ Validated logo for ${competitor.name}: ${validatedLogo}`);

          return {
            ...competitor,
            logo: validatedLogo
          };
        } catch (error) {
          console.error(`Failed to validate logo for ${competitor.name}:`, error);
          // Return competitor without logo if validation fails
          return {
            ...competitor,
            logo: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
          };
        }
      })
    );

    return validatedCompetitors;
  }

  /**
   * Validate and fetch company logo with intelligent fallbacks
   * Tries: 1) GPT-provided URL, 2) Favicon, 3) Google favicon service, 4) Clearbit
   */
  private async validateAndFetchLogo(gptLogoUrl: string | undefined, domain: string): Promise<string> {
    // Strategy 1: Try GPT-provided logo URL
    if (gptLogoUrl && await this.isValidImageUrl(gptLogoUrl)) {
      console.log(`✅ Using GPT-provided logo: ${gptLogoUrl}`);
      return gptLogoUrl;
    }

    // Strategy 2: Try standard favicon.ico
    const faviconUrl = `https://${domain}/favicon.ico`;
    if (await this.isValidImageUrl(faviconUrl)) {
      console.log(`✅ Using favicon.ico: ${faviconUrl}`);
      return faviconUrl;
    }

    // Strategy 3: Try Google's favicon service (very reliable)
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    console.log(`✅ Using Google favicon service: ${googleFaviconUrl}`);
    return googleFaviconUrl;

    // Note: Google's favicon service always returns something (generic globe icon if no favicon),
    // so we don't need Strategy 4 (Clearbit) as fallback. But keeping code here for reference:
    // const clearbitUrl = `https://logo.clearbit.com/${domain}`;
  }

  /**
   * Check if a URL points to a valid, accessible image
   */
  private async isValidImageUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        return false;
      }

      const contentType = response.headers.get('content-type');
      return contentType !== null && contentType.startsWith('image/');
    } catch {
      return false;
    }
  }

  /**
   * Generate a professional company description
   */
  async generateDescription(companyName: string, domain: string, industry?: string): Promise<string> {
    try {
      // Use GPT-5 for description generation
      const response = await this.getOpenAI().chat.completions.create({
        model: 'gpt-5-chat-latest',
        messages: [
          {
            role: 'system',
            content: 'You are a professional copywriter specializing in company descriptions.'
          },
          {
            role: 'user',
            content: `Write a professional, engaging 2-3 sentence description for ${companyName} (${domain}) ${industry ? `in the ${industry} industry` : ''}. Focus on what they do, their value proposition, and what makes them unique. Be factual and specific.`
          }
        ],
        max_tokens: 200
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Failed to generate description:', error);
      return '';
    }
  }

  /**
   * Find competitors matched by size and stage
   * Returns relevant competitors, not just famous names
   */
  async findCompetitors(
    companyName: string,
    industry: string,
    companySize?: string,
    fundingStage?: string
  ): Promise<Array<{name: string; main_product: string; company_stage: string}>> {
    try {
      // Build context about the target company
      const sizeContext = companySize
        ? `Company size: ${companySize}. Find competitors of similar scale.`
        : '';

      const stageContext = fundingStage
        ? `Funding stage: ${fundingStage}. Focus on companies at similar stage.`
        : '';

      const response = await this.getOpenAI().chat.completions.create({
        model: 'gpt-5-chat-latest',
        messages: [
          {
            role: 'system',
            content: 'You are a market analyst. Find direct competitors at similar company stage and size, not just market leaders. Always return valid JSON.'
          },
          {
            role: 'user',
            content: `Find 5-7 direct competitors for ${companyName} in ${industry}.

${sizeContext}
${stageContext}

IMPORTANT RULES:
1. Match by size/stage - Don't suggest Google for a startup
2. Direct competitors only - Same market, not adjacent
3. Include their main product name
4. Estimate their company stage: startup/growth/enterprise/established
5. If ${companyName} is early-stage, suggest other early-stage companies
6. If ${companyName} is enterprise, suggest established players

Return JSON:
{
  "competitors": [
    {
      "name": "Company name",
      "main_product": "Their flagship product",
      "company_stage": "startup|growth|enterprise|established",
      "why_relevant": "Brief reason for this match"
    }
  ]
}

Example for an early-stage AI company:
{
  "competitors": [
    {"name": "Cohere", "main_product": "Cohere API", "company_stage": "growth", "why_relevant": "Similar AI API offering"},
    {"name": "AI21 Labs", "main_product": "Jurassic", "company_stage": "growth", "why_relevant": "Competing LLM provider"}
  ]
}

NOT this (wrong - too big for early stage):
{
  "competitors": [
    {"name": "Google", "main_product": "Google AI", "company_stage": "enterprise"}
  ]
}`
          }
        ],
        max_tokens: 400,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const result = JSON.parse(content);

        // Extract competitors array
        const competitors = result.competitors || [];

        // Filter out irrelevant matches
        const filtered = competitors.filter((comp: any) => {
          // If we have size context, filter out giant companies for small companies
          if (companySize && (companySize.includes('1-10') || companySize?.includes('11-50'))) {
            // Small company - filter out enterprises
            return comp.company_stage !== 'enterprise' && comp.company_stage !== 'established';
          }
          return true;
        });

        return filtered.map((comp: any) => ({
          name: comp.name,
          main_product: comp.main_product || comp.name,
          company_stage: comp.company_stage || 'unknown'
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to find competitors:', error);
      return [];
    }
  }

  /**
   * Analyze tech stack from domain
   */
  async analyzeTechStack(domain: string): Promise<string[]> {
    try {
      // First, try to fetch headers and basic info from the website
      const siteInfo = await this.fetchSiteInfo(domain);

      const response = await this.getOpenAI().chat.completions.create({
        model: 'gpt-5-chat-latest',
        messages: [
          {
            role: 'system',
            content: 'You are a technical analyst specializing in identifying technology stacks. Always return valid JSON.'
          },
          {
            role: 'user',
            content: `Based on the domain ${domain} ${siteInfo ? `and these technical indicators: ${JSON.stringify(siteInfo)}` : ''}, identify the likely technology stack. Return a valid JSON object with a techStack array: {"techStack": ["Tech1", "Tech2", ...]} (up to 10 technologies)`
          }
        ],
        max_tokens: 200,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const result = JSON.parse(content);
        return Array.isArray(result) ? result : result.techStack || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to analyze tech stack:', error);
      return [];
    }
  }

  /**
   * Fetch basic site information for better enrichment
   */
  private async fetchSiteInfo(domain: string): Promise<any> {
    try {
      const response = await fetch(`https://${domain}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });
      
      return {
        server: response.headers.get('server'),
        powered: response.headers.get('x-powered-by'),
        generator: response.headers.get('x-generator')
      };
    } catch {
      return null;
    }
  }
}

export const llmEnrichmentService = new LLMEnrichmentService();
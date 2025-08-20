/**
 * Prompt Builder Service
 * Constructs world-class prompts for AI query generation
 */

import { EnhancedCompanyContext, QueryCategory } from '../types/query-generation.types';

export class PromptBuilderService {
  /**
   * Build the complete prompt for query generation
   */
  public buildQueryGenerationPrompt(context: EnhancedCompanyContext): string {
    const prompt = `You are an expert search query architect specializing in brand visibility analysis across AI platforms (ChatGPT, Gemini, Claude, Perplexity). Your task is to generate 48 high-value search queries that comprehensively map how users search for products, services, and solutions in the ${context.company.industry} industry.

## Company Context:
- Company Name: ${context.company.name}
- Domain: ${context.company.domain}
- Industry: ${context.company.industry}${context.company.sub_industry ? ` / ${context.company.sub_industry}` : ''}
- Description: ${context.company.description}
- Company Size: ${context.company.company_size}
- Value Proposition: ${context.company.unique_value_proposition || 'Not specified'}

## Market Position:
- Market Position: ${this.getMarketPositionDescription(context.market_position)}
- Market Share: ${context.market_position.market_share_estimate || 'Not specified'}

## Target Audience:
- Primary Persona: ${context.target_audience.primary_persona}
- Secondary Personas: ${context.target_audience.secondary_personas.join(', ') || 'None specified'}
- Geographic Markets: ${context.target_audience.geographic_markets.join(', ') || 'Global'}
- Industry Verticals: ${context.target_audience.industry_verticals.join(', ') || 'Multiple'}
- Key Use Cases: ${context.target_audience.use_cases.join(', ') || 'Various'}

## Products & Services:
- Main Offerings: ${context.products_services.main_offerings.join(', ')}
- Key Features: ${context.products_services.key_features.join(', ')}
- Pricing Model: ${context.products_services.pricing_model}
- Delivery Model: ${context.products_services.delivery_model || 'Not specified'}

## Competitive Landscape:
- Direct Competitors: ${context.competitors.direct_competitors.join(', ')}
- Indirect Competitors: ${context.competitors.indirect_competitors.join(', ')}
- Key Advantages: ${context.competitors.competitive_advantages.join(', ')}
- Differentiators: ${context.competitors.market_differentiators.join(', ')}

## Search Landscape:
- Industry Search Volume: ${context.search_landscape.industry_search_volume}
- Trending Topics: ${context.search_landscape.trending_topics.join(', ')}
- Common Pain Points: ${context.search_landscape.common_pain_points.join(', ')}
- Industry Terminology: ${context.search_landscape.industry_jargon.join(', ')}

## Your Objective:
Generate queries that will reveal:
1. Whether ${context.company.name} appears in AI responses
2. Where it ranks against competitors (${context.competitors.direct_competitors.slice(0, 3).join(', ')})
3. What sentiment accompanies brand mentions
4. Which high-value searches the brand is missing from

## Query Generation Requirements:

### Category 1: Problem-Unaware Queries (8 queries)
Users experiencing problems but don't know solutions exist.
- Focus on: ${context.search_landscape.common_pain_points.slice(0, 3).join(', ')}
- Express frustrations and symptoms without mentioning solution categories
- Example format: "why does [problem occur]", "how to fix [issue]", "dealing with [challenge]"
- NO mention of ${context.company.name} or solution categories

### Category 2: Solution-Seeking Queries (10 queries)
Users know they need something but are researching options.
- Include "best ${context.products_services.main_offerings[0]}" type queries
- Add qualifiers: for ${context.target_audience.company_sizes[0]}, in ${context.company.industry}
- Feature-specific: with ${context.products_services.key_features.slice(0, 2).join(', ')}
- NO brand names except in "for users switching from X" contexts

### Category 3: Brand-Specific Queries (8 queries)
Users have heard of ${context.company.name} and want to learn more.
- Direct brand searches with ${context.company.name}
- ${context.company.name} + specific features (${context.products_services.key_features[0]})
- Reputation queries: "${context.company.name} reviews", "is ${context.company.name} worth it"
- Include investigative queries about limitations or concerns

### Category 4: Comparison & Alternative Queries (8 queries)
Users actively comparing options.
- At least 3 queries with: "${context.company.name} vs ${context.competitors.direct_competitors[0]}"
- Alternative seeking: "alternative to ${context.competitors.direct_competitors[0]}"
- Feature comparisons relevant to ${context.products_services.key_features[0]}
- Switching queries: "migrate from ${context.competitors.direct_competitors[0]} to"

### Category 5: Purchase-Intent Queries (8 queries)
Users ready to take action.
- ${context.products_services.pricing_model} pricing queries
- Implementation for ${context.company.company_size} companies
- ROI/value for ${context.target_audience.primary_persona}
- "How to get started with ${context.products_services.main_offerings[0]}"

### Category 6: Use-Case Specific Queries (6 queries)
Users with specific contexts.
- For ${context.target_audience.industry_verticals[0]} industry
- For ${context.target_audience.company_sizes[0]} companies
- Specific to ${context.target_audience.use_cases[0]}
- Integration with common tools in ${context.company.industry}

## Critical Requirements:

1. **Authenticity**: Queries must sound like real ${context.target_audience.primary_persona} would write them
2. **Coverage**: Together, these 48 queries must cover ALL important ways people search in ${context.company.industry}
3. **Specificity Mix**: 
   - 20% broad, high-volume queries
   - 50% medium-specificity queries
   - 30% long-tail, highly specific queries
4. **Natural Language**: Mix questions, statements, and conversational queries
5. **Commercial Value**: Each query should influence purchase decisions or build awareness

## Output Format:
Return EXACTLY 48 queries as a JSON array with this structure:

\`\`\`json
[
  {
    "query": "The exact search query",
    "category": "problem_unaware | solution_seeking | brand_specific | comparison | purchase_intent | use_case",
    "intent": "informational | commercial | transactional | navigational | investigational",
    "priority": [1-10 based on commercial value for ${context.company.name}],
    "persona": "decision_maker | end_user | technical_buyer | economic_buyer | influencer | researcher",
    "platform_optimization": "chatgpt | gemini | claude | perplexity | universal",
    "expected_serp_type": "list | comparison | explanation | recommendation | mixed",
    "specificity_level": "broad | medium | long_tail",
    "commercial_value": "high | medium | low"
  }
]
\`\`\`

Generate 48 strategic queries now. Ensure each is unique and valuable for tracking ${context.company.name}'s visibility.`;

    return prompt;
  }

  /**
   * Get market position description
   */
  private getMarketPositionDescription(position: any): string {
    if (position.is_market_leader) return 'Market Leader';
    if (position.is_challenger) return 'Market Challenger';
    if (position.is_disruptor) return 'Market Disruptor';
    if (position.is_niche_player) return 'Niche Player';
    return 'Emerging Player';
  }

  /**
   * Build context from basic company data
   */
  public buildEnhancedContext(companyData: any): EnhancedCompanyContext {
    // This builds a comprehensive context from basic company data
    // Can be enhanced with AI to infer missing data
    
    return {
      company: {
        id: companyData.id,
        name: companyData.name,
        domain: companyData.domain,
        industry: companyData.industry || 'Technology',
        sub_industry: companyData.sub_industry,
        description: companyData.description || '',
        company_size: this.inferCompanySize(companyData),
        years_in_business: companyData.years_in_business,
        unique_value_proposition: companyData.value_proposition || this.inferValueProp(companyData),
        headquarters_location: companyData.location
      },
      
      market_position: {
        is_market_leader: false,
        is_challenger: true,
        is_disruptor: false,
        is_niche_player: false,
        market_share_estimate: 'moderate',
        growth_trajectory: 'steady'
      },
      
      target_audience: {
        primary_persona: this.inferPrimaryPersona(companyData),
        secondary_personas: this.inferSecondaryPersonas(companyData),
        geographic_markets: ['United States', 'Europe'],
        industry_verticals: this.inferIndustryVerticals(companyData),
        company_sizes: ['smb', 'mid_market'],
        use_cases: this.inferUseCases(companyData)
      },
      
      products_services: {
        main_offerings: this.parseOfferings(companyData.products_services || []),
        key_features: this.inferKeyFeatures(companyData),
        key_benefits: this.inferKeyBenefits(companyData),
        pricing_model: this.inferPricingModel(companyData),
        price_range: 'mid_range',
        delivery_model: this.inferDeliveryModel(companyData)
      },
      
      competitors: {
        direct_competitors: companyData.competitors || [],
        indirect_competitors: [],
        competitive_advantages: this.inferAdvantages(companyData),
        competitive_weaknesses: [],
        market_differentiators: this.inferDifferentiators(companyData)
      },
      
      search_landscape: {
        industry_search_volume: 'medium',
        seasonality_factors: [],
        trending_topics: this.inferTrendingTopics(companyData),
        common_pain_points: this.inferPainPoints(companyData),
        regulatory_considerations: [],
        industry_jargon: this.inferIndustryJargon(companyData)
      }
    };
  }

  // Helper methods for inferring context
  private inferCompanySize(data: any): 'startup' | 'smb' | 'mid_market' | 'enterprise' {
    // Logic to infer company size from various signals
    return 'smb';
  }

  private inferValueProp(data: any): string {
    return `Leading ${data.industry || 'technology'} solutions provider`;
  }

  private inferPrimaryPersona(data: any): string {
    const industry = (data.industry || '').toLowerCase();
    if (industry.includes('b2b') || industry.includes('enterprise')) {
      return 'Business Decision Maker';
    }
    if (industry.includes('consumer') || industry.includes('retail')) {
      return 'End Consumer';
    }
    return 'Professional User';
  }

  private inferSecondaryPersonas(data: any): string[] {
    return ['Technical Evaluator', 'End User'];
  }

  private inferIndustryVerticals(data: any): string[] {
    const industry = (data.industry || 'General').toLowerCase();
    if (industry.includes('saas') || industry.includes('software')) {
      return ['Technology', 'Financial Services', 'Healthcare'];
    }
    return [data.industry || 'Multiple Industries'];
  }

  private inferUseCases(data: any): string[] {
    const description = (data.description || '').toLowerCase();
    const useCases: string[] = [];
    
    if (description.includes('automat')) useCases.push('Process Automation');
    if (description.includes('analyt')) useCases.push('Data Analytics');
    if (description.includes('collaborat')) useCases.push('Team Collaboration');
    if (description.includes('customer')) useCases.push('Customer Management');
    
    return useCases.length > 0 ? useCases : ['General Business Operations'];
  }

  private parseOfferings(offerings: any): string[] {
    if (Array.isArray(offerings)) {
      return offerings.map(o => typeof o === 'string' ? o : o.name);
    }
    return ['Core Product Suite'];
  }

  private inferKeyFeatures(data: any): string[] {
    const features: string[] = [];
    const description = (data.description || '').toLowerCase();
    
    if (description.includes('ai') || description.includes('intelligent')) {
      features.push('AI-Powered Intelligence');
    }
    if (description.includes('automat')) features.push('Automation');
    if (description.includes('integrat')) features.push('Third-party Integrations');
    if (description.includes('analytic') || description.includes('report')) {
      features.push('Advanced Analytics');
    }
    if (description.includes('secure') || description.includes('complian')) {
      features.push('Enterprise Security');
    }
    
    return features.length > 0 ? features : ['Core Functionality'];
  }

  private inferKeyBenefits(data: any): string[] {
    return [
      'Increased Efficiency',
      'Cost Reduction',
      'Better Decision Making'
    ];
  }

  private inferPricingModel(data: any): 'subscription' | 'one_time' | 'usage_based' | 'freemium' | 'custom' {
    const industry = (data.industry || '').toLowerCase();
    if (industry.includes('saas') || industry.includes('software')) {
      return 'subscription';
    }
    return 'custom';
  }

  private inferDeliveryModel(data: any): 'saas' | 'on_premise' | 'hybrid' | 'physical' | 'service' {
    const industry = (data.industry || '').toLowerCase();
    if (industry.includes('saas') || industry.includes('cloud')) {
      return 'saas';
    }
    if (industry.includes('consulting') || industry.includes('agency')) {
      return 'service';
    }
    return 'saas';
  }

  private inferAdvantages(data: any): string[] {
    return [
      'Industry Expertise',
      'Customer Support',
      'Competitive Pricing'
    ];
  }

  private inferDifferentiators(data: any): string[] {
    return [
      'Unique Technology',
      'Market Experience',
      'Customer Success Focus'
    ];
  }

  private inferTrendingTopics(data: any): string[] {
    const industry = (data.industry || '').toLowerCase();
    const topics: string[] = [];
    
    if (industry.includes('tech') || industry.includes('software')) {
      topics.push('AI Integration', 'Automation', 'Digital Transformation');
    }
    if (industry.includes('retail') || industry.includes('commerce')) {
      topics.push('Omnichannel', 'Customer Experience', 'Personalization');
    }
    
    return topics.length > 0 ? topics : ['Innovation', 'Efficiency', 'Growth'];
  }

  private inferPainPoints(data: any): string[] {
    const industry = (data.industry || '').toLowerCase();
    const painPoints: string[] = [];
    
    if (industry.includes('b2b') || industry.includes('enterprise')) {
      painPoints.push(
        'Manual processes taking too long',
        'Lack of visibility into operations',
        'Difficulty scaling operations'
      );
    }
    if (industry.includes('retail') || industry.includes('consumer')) {
      painPoints.push(
        'Poor customer experience',
        'Inventory management issues',
        'Competition from online retailers'
      );
    }
    
    return painPoints.length > 0 ? painPoints : [
      'Inefficient workflows',
      'High operational costs',
      'Limited growth potential'
    ];
  }

  private inferIndustryJargon(data: any): string[] {
    const industry = (data.industry || '').toLowerCase();
    const jargon: string[] = [];
    
    if (industry.includes('saas') || industry.includes('software')) {
      jargon.push('API', 'Integration', 'Workflow', 'Dashboard', 'Analytics');
    }
    if (industry.includes('marketing')) {
      jargon.push('ROI', 'Conversion', 'Funnel', 'Campaign', 'Engagement');
    }
    
    return jargon.length > 0 ? jargon : ['Solution', 'Platform', 'System'];
  }
}
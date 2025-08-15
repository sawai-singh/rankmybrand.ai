/**
 * LLM-based Company Enrichment Service
 * Uses OpenAI GPT-4 to gather company information
 */

import OpenAI from 'openai';
import { CompanyEnrichment } from './enrichment.service';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize OpenAI with API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class LLMEnrichmentService {
  /**
   * Enrich company data using GPT-5 or fallback models
   */
  async enrichWithLLM(domain: string): Promise<CompanyEnrichment | null> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.error('OpenAI API key not configured');
        return null;
      }

      const prompt = `Given the domain "${domain}", provide detailed company information.
        
        Return ONLY a valid JSON object with the following structure (no markdown, no code blocks, just JSON):
        {
          "name": "Official company name",
          "domain": "${domain}",
          "industry": "Primary industry/sector",
          "size": "Employee range (e.g., '1,001-5,000 employees')",
          "employeeCount": estimated number as integer,
          "description": "2-3 sentence company description focusing on what they do and their value proposition",
          "location": {
            "city": "Headquarters city",
            "state": "State/Province code",
            "country": "Country name"
          },
          "socialProfiles": {
            "linkedin": "LinkedIn company URL if known",
            "twitter": "Twitter/X handle URL if known",
            "facebook": "Facebook page URL if known"
          },
          "tags": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
          "techStack": ["tech1", "tech2", "tech3", "tech4", "tech5", "tech6"],
          "competitors": ["competitor1", "competitor2", "competitor3"],
          "fundingStage": "Latest funding stage if applicable",
          "yearFounded": "Year as string"
        }
        
        If you don't know specific information, omit that field rather than guessing.
        For the domain ${domain}, provide accurate, current information.`;

      let content: string | null = null;
      
      // Try GPT-5 Responses API first (for reasoning models)
      try {
        console.log('Attempting GPT-5 Responses API for domain:', domain);
        const responsesAPI = openai as any; // Type assertion for responses API
        
        if (responsesAPI.responses && typeof responsesAPI.responses.create === 'function') {
          const response = await responsesAPI.responses.create({
            model: 'gpt-5-nano',
            reasoning_effort: 'minimal', // Keep reasoning to minimum for quick responses
            verbosity: 'low', // Shorter, more concise answers
            input: prompt
          });
          
          content = response.output_text || response.output || response.text;
          console.log('GPT-5 Responses API success');
        }
      } catch (responsesError) {
        console.log('Responses API not available or failed, falling back to Chat Completions');
      }
      
      // Fallback to Chat Completions API with non-reasoning model
      if (!content) {
        console.log('Using Chat Completions API with gpt-5-chat-latest for domain:', domain);
        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-5-chat-latest', // Non-reasoning GPT-5 model
            messages: [
              {
                role: 'system',
                content: 'You are a company data enrichment specialist. Always return valid JSON only, no markdown formatting.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 1000
          });
          
          content = response.choices[0]?.message?.content;
        } catch (chatError: any) {
          // If gpt-5-chat-latest doesn't exist, fall back to gpt-4
          if (chatError?.status === 404 || chatError?.code === 'model_not_found') {
            console.log('GPT-5 models not available, falling back to GPT-4');
            const response = await openai.chat.completions.create({
              model: 'gpt-4-turbo-preview',
              messages: [
                {
                  role: 'system',
                  content: 'You are a company data enrichment specialist. Always return valid JSON only, no markdown formatting.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              max_tokens: 1000,
              response_format: { type: 'json_object' }
            });
            
            content = response.choices[0]?.message?.content;
          } else {
            throw chatError;
          }
        }
      }
      
      if (!content) {
        console.error('No response content from OpenAI');
        return null;
      }

      // Parse the JSON response
      const companyData = JSON.parse(content);
      
      // Add enrichment metadata
      return {
        ...companyData,
        enrichmentSource: 'openai-llm',
        confidence: 0.85,
        logo: `https://${domain}/favicon.ico`
      } as CompanyEnrichment;

    } catch (error) {
      console.error('LLM enrichment failed:', error);
      return null;
    }
  }

  /**
   * Generate a professional company description
   */
  async generateDescription(companyName: string, domain: string, industry?: string): Promise<string> {
    try {
      // Use non-reasoning model for simple generation tasks
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview', // Using GPT-4 for stability
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
   * Find competitors
   */
  async findCompetitors(companyName: string, industry: string): Promise<string[]> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview', // Using GPT-4 for stability
        messages: [
          {
            role: 'system',
            content: 'You are a market analyst specializing in competitive analysis. Always return valid JSON.'
          },
          {
            role: 'user',
            content: `List the top 5 direct competitors of ${companyName} in the ${industry} industry. Return only a valid JSON object with a competitors array: {"competitors": ["Company1", "Company2", ...]}`
          }
        ],
        max_tokens: 200,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const result = JSON.parse(content);
        return Array.isArray(result) ? result : result.competitors || [];
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
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview', // Using GPT-4 for stability
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
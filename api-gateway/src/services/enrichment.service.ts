/**
 * Company Enrichment Service
 * Handles email validation and company data enrichment from multiple sources
 */

import axios from 'axios';
import dns from 'dns/promises';
import { promisify } from 'util';

// Enrichment API configurations
const ENRICHMENT_APIS = {
  clearbit: {
    endpoint: 'https://company.clearbit.com/v2/companies/find',
    apiKey: process.env.CLEARBIT_API_KEY,
    fallback: 'hunter'
  },
  hunter: {
    endpoint: 'https://api.hunter.io/v2/domain-search',
    apiKey: process.env.HUNTER_API_KEY,
    fallback: 'apollo'
  },
  apollo: {
    endpoint: 'https://api.apollo.io/v1/organizations/enrich',
    apiKey: process.env.APOLLO_API_KEY,
    fallback: 'crawler'
  }
};

export interface CompanyEnrichment {
  name: string;
  domain: string;
  industry?: string;
  size?: string;
  employeeCount?: number;
  logo?: string;
  description?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
  tags?: string[];
  techStack?: string[];
  enrichmentSource: string;
  confidence: number;
}

export class EnrichmentService {
  /**
   * Validate corporate email address
   */
  async validateCorporateEmail(email: string): Promise<{ valid: boolean; domain: string; reason?: string }> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      return { valid: false, domain: '', reason: 'Invalid email format' };
    }

    const domain = email.split('@')[1];
    
    // For development/testing, allow all domains
    if (process.env.NODE_ENV === 'development' || process.env.ALLOW_ALL_EMAILS === 'true') {
      console.log('Development mode: Allowing all email domains');
      return { valid: true, domain };
    }
    
    // Check for common personal email providers (but with a softer approach)
    const personalProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com', 'protonmail.com'];
    
    // Allow personal emails if explicitly enabled (for testing or small businesses)
    if (personalProviders.includes(domain.toLowerCase())) {
      if (process.env.ALLOW_PERSONAL_EMAILS === 'true') {
        console.log('Personal email allowed by configuration');
        return { valid: true, domain };
      }
      
      // For now, let's just warn but still allow it (softer validation)
      console.warn(`Warning: Personal email domain detected (${domain}), but allowing for testing`);
      return { valid: true, domain };
      
      // Uncomment this to enforce strict validation in production:
      // return { valid: false, domain, reason: 'Please use your company email address' };
    }

    try {
      // Verify MX records exist
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        // Even if MX records fail, allow in development
        if (process.env.NODE_ENV === 'development') {
          console.warn('MX record check failed, but allowing in development mode');
          return { valid: true, domain };
        }
        return { valid: false, domain, reason: 'Invalid email domain - no mail server found' };
      }

      // Verify domain exists
      await dns.resolve4(domain).catch(() => dns.resolve6(domain));
      
      return { valid: true, domain };
    } catch (error) {
      // In development, be more lenient
      if (process.env.NODE_ENV === 'development') {
        console.warn('Domain verification failed, but allowing in development mode:', error);
        return { valid: true, domain };
      }
      return { valid: false, domain, reason: 'Domain verification failed' };
    }
  }

  /**
   * Enrich company data from email
   */
  async enrichFromEmail(email: string): Promise<CompanyEnrichment> {
    const domain = email.split('@')[1];
    
    // Try enrichment services in order
    let enrichmentData = await this.tryEnrichmentChain(domain);
    
    if (!enrichmentData) {
      // Fallback to web crawler
      enrichmentData = await this.crawlerEnrichment(domain);
    }

    return enrichmentData;
  }

  /**
   * Try enrichment services with fallback chain
   */
  private async tryEnrichmentChain(domain: string): Promise<CompanyEnrichment | null> {
    // Try Clearbit first
    try {
      if (ENRICHMENT_APIS.clearbit.apiKey) {
        return await this.clearbitEnrichment(domain);
      }
    } catch (error) {
      console.log('Clearbit enrichment failed, trying Hunter...');
    }

    // Try Hunter
    try {
      if (ENRICHMENT_APIS.hunter.apiKey) {
        return await this.hunterEnrichment(domain);
      }
    } catch (error) {
      console.log('Hunter enrichment failed, trying Apollo...');
    }

    // Try Apollo
    try {
      if (ENRICHMENT_APIS.apollo.apiKey) {
        return await this.apolloEnrichment(domain);
      }
    } catch (error) {
      console.log('Apollo enrichment failed, will use crawler...');
    }

    return null;
  }

  /**
   * Clearbit enrichment
   */
  private async clearbitEnrichment(domain: string): Promise<CompanyEnrichment> {
    const response = await axios.get(ENRICHMENT_APIS.clearbit.endpoint, {
      params: { domain },
      headers: {
        'Authorization': `Bearer ${ENRICHMENT_APIS.clearbit.apiKey}`
      }
    });

    const data = response.data;
    
    return {
      name: data.name,
      domain: data.domain,
      industry: data.category?.industry,
      size: data.metrics?.employeesRange,
      employeeCount: data.metrics?.employees,
      logo: data.logo,
      description: data.description,
      location: {
        city: data.geo?.city,
        state: data.geo?.stateCode,
        country: data.geo?.country
      },
      socialProfiles: {
        linkedin: data.linkedin?.handle ? `https://linkedin.com/company/${data.linkedin.handle}` : undefined,
        twitter: data.twitter?.handle ? `https://twitter.com/${data.twitter.handle}` : undefined,
        facebook: data.facebook?.handle ? `https://facebook.com/${data.facebook.handle}` : undefined
      },
      tags: data.tags || [],
      techStack: data.tech || [],
      enrichmentSource: 'clearbit',
      confidence: 0.95
    };
  }

  /**
   * Hunter.io enrichment
   */
  private async hunterEnrichment(domain: string): Promise<CompanyEnrichment> {
    const response = await axios.get(ENRICHMENT_APIS.hunter.endpoint, {
      params: { 
        domain,
        api_key: ENRICHMENT_APIS.hunter.apiKey
      }
    });

    const data = response.data.data;
    
    return {
      name: data.organization || domain,
      domain: data.domain,
      industry: data.industry,
      size: data.size,
      employeeCount: data.employees_count,
      logo: data.logo,
      description: data.description,
      location: {
        city: data.city,
        state: data.state,
        country: data.country
      },
      socialProfiles: {
        linkedin: data.linkedin,
        twitter: data.twitter,
        facebook: data.facebook
      },
      tags: [],
      techStack: data.technologies || [],
      enrichmentSource: 'hunter',
      confidence: 0.85
    };
  }

  /**
   * Apollo.io enrichment
   */
  private async apolloEnrichment(domain: string): Promise<CompanyEnrichment> {
    const response = await axios.post(
      ENRICHMENT_APIS.apollo.endpoint,
      { domain },
      {
        headers: {
          'X-API-Key': ENRICHMENT_APIS.apollo.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data.organization;
    
    return {
      name: data.name,
      domain: data.primary_domain,
      industry: data.industry,
      size: data.employee_count_range,
      employeeCount: data.employee_count,
      logo: data.logo_url,
      description: data.short_description,
      location: {
        city: data.city,
        state: data.state,
        country: data.country
      },
      socialProfiles: {
        linkedin: data.linkedin_url,
        twitter: data.twitter_url,
        facebook: data.facebook_url
      },
      tags: data.keywords || [],
      techStack: data.technologies || [],
      enrichmentSource: 'apollo',
      confidence: 0.80
    };
  }

  /**
   * Crawler-based enrichment (fallback)
   */
  private async crawlerEnrichment(domain: string): Promise<CompanyEnrichment> {
    try {
      // Use our web crawler service to get company info
      const crawlerUrl = process.env.CRAWLER_SERVICE || 'http://localhost:3002';
      const response = await axios.post(`${crawlerUrl}/api/crawl`, {
        url: `https://${domain}`,
        options: {
          maxPages: 5,
          extractMetadata: true
        }
      });

      const crawlData = response.data;
      
      // Extract company info from crawled data
      const companyName = this.extractCompanyName(crawlData) || domain;
      const description = this.extractDescription(crawlData);
      
      return {
        name: companyName,
        domain: domain,
        industry: this.inferIndustry(crawlData),
        description: description,
        logo: this.extractLogo(crawlData),
        socialProfiles: this.extractSocialLinks(crawlData),
        tags: this.extractKeywords(crawlData),
        enrichmentSource: 'crawler',
        confidence: 0.60
      };
    } catch (error) {
      // Last resort - return minimal data
      return {
        name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
        domain: domain,
        enrichmentSource: 'manual',
        confidence: 0.30
      };
    }
  }

  /**
   * Extract company name from crawled data
   */
  private extractCompanyName(crawlData: any): string | null {
    // Try to find company name from meta tags or page title
    const metadata = crawlData.metadata || {};
    return metadata.ogSiteName || 
           metadata.applicationName || 
           crawlData.title?.split(' - ')[0] || 
           null;
  }

  /**
   * Extract description from crawled data
   */
  private extractDescription(crawlData: any): string | undefined {
    const metadata = crawlData.metadata || {};
    return metadata.description || 
           metadata.ogDescription || 
           undefined;
  }

  /**
   * Extract logo from crawled data
   */
  private extractLogo(crawlData: any): string | undefined {
    const metadata = crawlData.metadata || {};
    return metadata.ogImage || 
           metadata.icon || 
           undefined;
  }

  /**
   * Extract social links from crawled data
   */
  private extractSocialLinks(crawlData: any): any {
    const links = crawlData.links || [];
    const social: any = {};
    
    links.forEach((link: string) => {
      if (link.includes('linkedin.com')) social.linkedin = link;
      if (link.includes('twitter.com') || link.includes('x.com')) social.twitter = link;
      if (link.includes('facebook.com')) social.facebook = link;
    });
    
    return social;
  }

  /**
   * Extract keywords from crawled data
   */
  private extractKeywords(crawlData: any): string[] {
    const metadata = crawlData.metadata || {};
    const keywords = metadata.keywords || '';
    return keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k);
  }

  /**
   * Infer industry from crawled content
   */
  private inferIndustry(crawlData: any): string | undefined {
    const content = crawlData.textContent || '';
    const industries = [
      { keywords: ['software', 'saas', 'cloud', 'api'], name: 'Software' },
      { keywords: ['finance', 'banking', 'payment', 'fintech'], name: 'Finance' },
      { keywords: ['health', 'medical', 'healthcare', 'patient'], name: 'Healthcare' },
      { keywords: ['retail', 'ecommerce', 'shop', 'product'], name: 'Retail' },
      { keywords: ['education', 'learning', 'course', 'student'], name: 'Education' },
      { keywords: ['marketing', 'advertising', 'campaign', 'brand'], name: 'Marketing' },
    ];

    const contentLower = content.toLowerCase();
    
    for (const industry of industries) {
      const matches = industry.keywords.filter(keyword => 
        contentLower.includes(keyword)
      ).length;
      
      if (matches >= 2) {
        return industry.name;
      }
    }
    
    return undefined;
  }

  /**
   * Generate AI description for company
   */
  async generateDescription(company: CompanyEnrichment, crawledContent?: any): Promise<string> {
    const geoService = process.env.GEO_SERVICE || 'http://localhost:8000';
    
    try {
      const response = await axios.post(`${geoService}/api/v1/geo/generate-description`, {
        companyName: company.name,
        website: company.domain,
        industry: company.industry,
        currentDescription: company.description,
        crawledContent: crawledContent,
        maxWords: 100
      });

      return response.data.description;
    } catch (error) {
      console.error('Failed to generate AI description:', error);
      // Fallback to existing description or generate a simple one
      return company.description || `${company.name} is a company in the ${company.industry || 'technology'} industry.`;
    }
  }

  /**
   * Find competitors using Search Intelligence
   */
  async findCompetitors(company: CompanyEnrichment): Promise<any[]> {
    const searchService = process.env.SEARCH_SERVICE || 'http://localhost:3002';
    
    try {
      const response = await axios.post(`${searchService}/api/search-intelligence/analyze`, {
        brand: company.name,
        domain: company.domain,
        industry: company.industry,
        options: {
          maxQueries: 20,
          includeCompetitors: true
        }
      });

      return response.data.competitors || [];
    } catch (error) {
      console.error('Failed to find competitors:', error);
      return [];
    }
  }
}

export const enrichmentService = new EnrichmentService();
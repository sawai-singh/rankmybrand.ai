/**
 * Company Repository
 * Handles all company-related database operations
 */

import { db, dbHelpers } from '../connection';
import { 
  Company,
  Competitor,
  CompanyWithCompetitors,
  CreateCompanyRequest,
  QueryResult,
  PaginationParams,
  FilterParams,
  isValidDomain,
  ANALYSIS_TYPES
} from '../models';

// Constants
const DEFAULT_PAGE_SIZE = 20;
const MAX_SEARCH_RESULTS = 100;
const HIGH_PERFORMER_THRESHOLD = 80;
const RECENT_ANALYSIS_DAYS = 7;

interface CreateCompanyData extends CreateCompanyRequest {
  logo_url?: string;
  sub_industry?: string;
  founded_year?: number;
  headquarters_city?: string;
  headquarters_state?: string;
  headquarters_country?: string;
  headquarters_address?: string;
  linkedin_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  youtube_url?: string;
  tech_stack?: string[];
  tags?: string[];
  keywords?: string[];
  enrichment_source?: string;
  enrichment_data?: Record<string, unknown>;
  enrichment_confidence?: number;
  enrichment_date?: Date;
}

interface CompanyStats {
  total_companies: number;
  unique_industries: number;
  avg_geo_score: number;
  high_performers: number;
  analyzed_week: number;
}

interface SearchCriteria {
  query?: string;
  industry?: string;
  minScore?: number;
  maxScore?: number;
  hasAnalysis?: boolean;
  techStack?: string[];
  companySize?: string;
  country?: string;
}

export class CompanyRepository {
  private readonly tableName = 'companies';
  /**
   * Create a new company
   */
  async create(data: CreateCompanyData): Promise<Company> {
    // Validate domain
    if (!isValidDomain(data.domain)) {
      throw new Error('Invalid domain format');
    }
    const query = `
      INSERT INTO companies (
        name, domain, logo_url, description,
        industry, sub_industry, company_size, employee_count, founded_year,
        headquarters_city, headquarters_state, headquarters_country, headquarters_address,
        linkedin_url, twitter_url, facebook_url, instagram_url, youtube_url,
        tech_stack, tags, keywords,
        enrichment_source, enrichment_data, enrichment_confidence, enrichment_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25
      )
      RETURNING *
    `;

    const values = [
      data.name,
      data.domain,
      data.logo_url || null,
      data.description || null,
      data.industry || null,
      data.sub_industry || null,
      data.company_size || null,
      data.employee_count || null,
      data.founded_year || null,
      data.headquarters_city || null,
      data.headquarters_state || null,
      data.headquarters_country || null,
      data.headquarters_address || null,
      data.linkedin_url || null,
      data.twitter_url || null,
      data.facebook_url || null,
      data.instagram_url || null,
      data.youtube_url || null,
      data.tech_stack || [],
      data.tags || [],
      data.keywords || [],
      data.enrichment_source || null,
      data.enrichment_data || null,
      data.enrichment_confidence || null,
      data.enrichment_date || null
    ];

    const result = await db.queryOne<Company>(query, values);
    if (!result) throw new Error('Failed to create company');
    
    return result;
  }

  /**
   * Find company by ID
   */
  async findById(id: number): Promise<Company | null> {
    const query = 'SELECT * FROM companies WHERE id = $1';
    return db.queryOne<Company>(query, [id]);
  }

  /**
   * Find company by domain
   */
  async findByDomain(domain: string): Promise<Company | null> {
    // Normalize domain for consistent lookups
    const normalizedDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    const query = 'SELECT * FROM companies WHERE LOWER(domain) = LOWER($1)';
    return db.queryOne<Company>(query, [normalizedDomain]);
  }

  /**
   * Update company
   */
  async update(id: number, data: Partial<Company>): Promise<Company> {
    // Filter out undefined values and system fields
    const updateData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, unknown>);

    if (Object.keys(updateData).length === 0) {
      throw new Error('No fields to update');
    }

    // Use helper function for building update query
    const { text, values } = dbHelpers.buildUpdateQuery(
      this.tableName,
      { ...updateData, updated_at: new Date() },
      { id },
      '*'
    );

    const result = await db.queryOne<Company>(text, values);
    if (!result) throw new Error('Company not found');
    
    return result;
  }

  /**
   * Update analysis scores
   */
  async updateAnalysisScores(
    id: number,
    geoScore: number,
    analysisId: number
  ): Promise<void> {
    const query = `
      UPDATE companies 
      SET latest_geo_score = $1,
          latest_geo_analysis_id = $2,
          latest_analysis_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `;
    
    await db.query(query, [geoScore, analysisId, id]);
  }

  /**
   * Add competitor
   */
  async addCompetitor(data: {
    company_id: number;
    competitor_name: string;
    competitor_domain: string;
    discovery_source?: string;
    discovery_reason?: string;
    similarity_score?: number;
    confidence_score?: number;
    added_by_user_id?: number;
  }): Promise<Competitor> {
    const query = `
      INSERT INTO competitors (
        company_id, competitor_name, competitor_domain,
        discovery_source, discovery_reason,
        similarity_score, confidence_score,
        added_by_user_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      ON CONFLICT (company_id, competitor_domain) 
      DO UPDATE SET
        discovery_reason = EXCLUDED.discovery_reason,
        similarity_score = EXCLUDED.similarity_score,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      data.company_id,
      data.competitor_name,
      data.competitor_domain,
      data.discovery_source || null,
      data.discovery_reason || null,
      data.similarity_score ? Math.min(9.99, Math.max(0, data.similarity_score)) : null,
      data.confidence_score ? Math.min(9.99, Math.max(0, data.confidence_score)) : null,
      data.added_by_user_id || null
    ];

    const result = await db.queryOne<Competitor>(query, values);
    if (!result) throw new Error('Failed to add competitor');
    
    return result;
  }

  /**
   * Get competitors for company
   */
  async getCompetitors(companyId: number): Promise<Competitor[]> {
    const query = `
      SELECT * FROM competitors 
      WHERE company_id = $1 AND is_active = true
      ORDER BY similarity_score DESC NULLS LAST
    `;
    
    return db.queryMany<Competitor>(query, [companyId]);
  }

  /**
   * Remove competitor
   */
  async removeCompetitor(companyId: number, competitorDomain: string): Promise<void> {
    const query = `
      UPDATE competitors 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE company_id = $1 AND competitor_domain = $2
    `;
    
    await db.query(query, [companyId, competitorDomain]);
  }

  /**
   * Get company with competitors
   */
  async findByIdWithCompetitors(id: number): Promise<CompanyWithCompetitors | null> {
    const company = await this.findById(id);
    if (!company) return null;

    const competitors = await this.getCompetitors(id);
    
    return {
      ...company,
      competitors
    };
  }

  /**
   * List companies with pagination
   */
  async list(
    params: PaginationParams & FilterParams & { industry?: string; techStack?: string[] }
  ): Promise<QueryResult<Company>> {
    const { 
      page = 1, 
      limit = DEFAULT_PAGE_SIZE, 
      sort_by = 'created_at', 
      sort_order = 'desc' 
    } = params;
    
    // Build filter conditions
    const filters: Record<string, unknown> = {};
    if (params.industry) {
      filters.industry = params.industry;
    }
    
    const { text: whereClause, values: whereValues } = dbHelpers.buildWhereClause(filters);
    
    // Add search condition
    let searchClause = '';
    const values = [...whereValues];
    let paramCount = whereValues.length + 1;

    if (params.search) {
      searchClause = whereClause ? ' AND ' : ' WHERE ';
      searchClause += `(name ILIKE $${paramCount} OR domain ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      values.push(`%${params.search}%`);
    }
    
    // Add tech stack filter if provided
    if (params.techStack && params.techStack.length > 0) {
      const techClause = whereClause || searchClause ? ' AND ' : ' WHERE ';
      searchClause += `${techClause}tech_stack && $${paramCount + 1}`;
      values.push(params.techStack);
    }

    // Count total
    const countQuery = `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}${searchClause}`;
    const countResult = await db.queryOne<{ count: string }>(countQuery, values);
    const total = parseInt(countResult?.count || '0');

    // Get paginated results
    const query = `
      SELECT * FROM ${this.tableName} 
      ${whereClause}${searchClause}
      ${dbHelpers.buildSortClause(sort_by, sort_order)}
      ${dbHelpers.buildPaginationClause(page, limit)}
    `;
    
    const data = await db.queryMany<Company>(query, values);
    
    return {
      data,
      total,
      page,
      limit,
      has_more: page * limit < total
    };
  }

  /**
   * Get company statistics
   */
  async getStats(): Promise<CompanyStats> {
    const query = `
      SELECT 
        COUNT(*) as total_companies,
        COUNT(DISTINCT industry) as unique_industries,
        AVG(latest_geo_score) as avg_geo_score,
        COUNT(CASE WHEN latest_geo_score > $1 THEN 1 END) as high_performers,
        COUNT(CASE WHEN latest_analysis_date > CURRENT_DATE - INTERVAL '${RECENT_ANALYSIS_DAYS} days' THEN 1 END) as analyzed_week
      FROM ${this.tableName}
    `;
    
    const result = await db.queryOne<{
      total_companies: string;
      unique_industries: string;
      avg_geo_score: string;
      high_performers: string;
      analyzed_week: string;
    }>(query, [HIGH_PERFORMER_THRESHOLD]);

    if (!result) {
      return {
        total_companies: 0,
        unique_industries: 0,
        avg_geo_score: 0,
        high_performers: 0,
        analyzed_week: 0
      };
    }

    return {
      total_companies: parseInt(result.total_companies, 10),
      unique_industries: parseInt(result.unique_industries, 10),
      avg_geo_score: parseFloat(result.avg_geo_score) || 0,
      high_performers: parseInt(result.high_performers, 10),
      analyzed_week: parseInt(result.analyzed_week, 10)
    };
  }

  /**
   * Search companies by various criteria
   */
  async search(criteria: SearchCriteria): Promise<Company[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (criteria.query) {
      conditions.push(`(
        name ILIKE $${paramCount} OR 
        domain ILIKE $${paramCount} OR 
        description ILIKE $${paramCount}
      )`);
      values.push(`%${criteria.query}%`);
      paramCount++;
    }

    if (criteria.industry) {
      conditions.push(`industry = $${paramCount}`);
      values.push(criteria.industry);
      paramCount++;
    }

    if (criteria.minScore !== undefined) {
      conditions.push(`latest_geo_score >= $${paramCount}`);
      values.push(criteria.minScore);
      paramCount++;
    }

    if (criteria.maxScore !== undefined) {
      conditions.push(`latest_geo_score <= $${paramCount}`);
      values.push(criteria.maxScore);
      paramCount++;
    }

    if (criteria.hasAnalysis) {
      conditions.push('latest_geo_score IS NOT NULL');
    }

    if (criteria.companySize) {
      conditions.push(`company_size = $${paramCount}`);
      values.push(criteria.companySize);
      paramCount++;
    }

    if (criteria.country) {
      conditions.push(`headquarters_country = $${paramCount}`);
      values.push(criteria.country);
      paramCount++;
    }

    if (criteria.techStack && criteria.techStack.length > 0) {
      conditions.push(`tech_stack && $${paramCount}`);
      values.push(criteria.techStack);
      paramCount++;
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT * FROM ${this.tableName} 
      ${whereClause}
      ORDER BY latest_geo_score DESC NULLS LAST
      LIMIT $${paramCount}
    `;
    
    values.push(MAX_SEARCH_RESULTS);
    return db.queryMany<Company>(query, values);
  }

  /**
   * Check if company exists by domain
   */
  async domainExists(domain: string): Promise<boolean> {
    const normalizedDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    const query = 'SELECT EXISTS(SELECT 1 FROM companies WHERE LOWER(domain) = LOWER($1))';
    const result = await db.queryOne<{ exists: boolean }>(query, [normalizedDomain]);
    return result?.exists || false;
  }

  /**
   * Batch create companies
   */
  async batchCreate(companies: CreateCompanyData[]): Promise<Company[]> {
    if (companies.length === 0) return [];

    const results: Company[] = [];
    
    // Use transaction for batch insert
    await db.transaction(async (client) => {
      for (const company of companies) {
        // Skip if domain already exists
        if (await this.domainExists(company.domain)) {
          continue;
        }
        
        const result = await this.create(company);
        results.push(result);
      }
    });
    
    return results;
  }

  /**
   * Update competitor scores
   */
  async updateCompetitorScore(
    companyId: number,
    competitorDomain: string,
    score: number,
    analysisDate: Date
  ): Promise<void> {
    const query = `
      UPDATE competitors 
      SET latest_geo_score = $1,
          latest_analysis_date = $2,
          score_difference = (
            SELECT c.latest_geo_score - $1 
            FROM companies c 
            WHERE c.id = $3
          ),
          updated_at = CURRENT_TIMESTAMP
      WHERE company_id = $3 AND competitor_domain = $4
    `;
    
    await db.query(query, [score, analysisDate, companyId, competitorDomain]);
  }

  /**
   * Get top performing companies
   */
  async getTopPerformers(limit: number = 10): Promise<Company[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE latest_geo_score IS NOT NULL
      ORDER BY latest_geo_score DESC
      LIMIT $1
    `;
    
    return db.queryMany<Company>(query, [limit]);
  }

  /**
   * Get companies needing analysis
   */
  async getCompaniesNeedingAnalysis(daysSinceLastAnalysis: number = 30): Promise<Company[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE latest_analysis_date IS NULL 
         OR latest_analysis_date < CURRENT_DATE - INTERVAL '${daysSinceLastAnalysis} days'
      ORDER BY latest_analysis_date ASC NULLS FIRST
      LIMIT 50
    `;
    
    return db.queryMany<Company>(query);
  }

  /**
   * Delete company (soft delete)
   */
  async delete(id: number, soft: boolean = true): Promise<void> {
    if (soft) {
      const query = `
        UPDATE ${this.tableName} 
        SET deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await db.query(query, [id]);
    } else {
      // Hard delete - also removes competitors
      await db.transaction(async (client) => {
        await client.query('DELETE FROM competitors WHERE company_id = $1', [id]);
        await client.query('DELETE FROM companies WHERE id = $1', [id]);
      });
    }
  }
}

// Export singleton instance
export const companyRepository = new CompanyRepository();
/**
 * Company Repository
 * Handles all company-related database operations
 */

import { db } from '../connection';
import { 
  Company,
  Competitor,
  CompanyWithCompetitors,
  QueryResult,
  PaginationParams
} from '../models';

export class CompanyRepository {
  /**
   * Create a new company
   */
  async create(data: any): Promise<Company> {
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
      data.enrichment_data ? JSON.stringify(data.enrichment_data) : null,
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
    const query = 'SELECT * FROM companies WHERE domain = $1';
    return db.queryOne<Company>(query, [domain]);
  }

  /**
   * Update company
   */
  async update(id: number, data: Partial<Company>): Promise<Company> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic update query
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const query = `
      UPDATE companies 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.queryOne<Company>(query, values);
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
      data.similarity_score || null,
      data.confidence_score || null,
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
    params: PaginationParams & { search?: string; industry?: string }
  ): Promise<QueryResult<Company>> {
    const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'desc' } = params;
    
    let whereClause = '';
    const whereConditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (params.search) {
      whereConditions.push(`(name ILIKE $${paramCount} OR domain ILIKE $${paramCount})`);
      values.push(`%${params.search}%`);
      paramCount++;
    }

    if (params.industry) {
      whereConditions.push(`industry = $${paramCount}`);
      values.push(params.industry);
      paramCount++;
    }

    if (whereConditions.length > 0) {
      whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    }

    // Count total
    const countQuery = `SELECT COUNT(*) FROM companies ${whereClause}`;
    const countResult = await db.queryOne<{ count: string }>(countQuery, values);
    const total = parseInt(countResult?.count || '0');

    // Get paginated results
    const offset = (page - 1) * limit;
    const query = `
      SELECT * FROM companies 
      ${whereClause}
      ORDER BY ${sort_by} ${sort_order.toUpperCase()}
      LIMIT ${limit} OFFSET ${offset}
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
  async getStats(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_companies,
        COUNT(DISTINCT industry) as unique_industries,
        AVG(latest_geo_score) as avg_geo_score,
        COUNT(CASE WHEN latest_geo_score > 80 THEN 1 END) as high_performers,
        COUNT(CASE WHEN latest_analysis_date > CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as analyzed_week
      FROM companies
    `;
    
    return db.queryOne(query);
  }

  /**
   * Search companies by various criteria
   */
  async search(criteria: {
    query?: string;
    industry?: string;
    minScore?: number;
    maxScore?: number;
    hasAnalysis?: boolean;
  }): Promise<Company[]> {
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

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT * FROM companies 
      ${whereClause}
      ORDER BY latest_geo_score DESC NULLS LAST
      LIMIT 100
    `;
    
    return db.queryMany<Company>(query, values);
  }
}

// Export singleton instance
export const companyRepository = new CompanyRepository();
/**
 * User Repository
 * Handles all user-related database operations
 */

import { db, dbHelpers } from '../connection';
import { 
  User, 
  CreateUserRequest, 
  UpdateUserRequest,
  UserWithCompany,
  QueryResult,
  PaginationParams,
  FilterParams
} from '../models';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export class UserRepository {
  /**
   * Create a new user
   */
  async create(data: CreateUserRequest): Promise<User> {
    const query = `
      INSERT INTO users (
        email, work_email, password_hash, first_name, last_name, 
        company_id, email_verification_token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    // Hash password if provided
    const passwordHash = data.password 
      ? await bcrypt.hash(data.password, 10)
      : null;

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const values = [
      data.email,
      data.work_email || null,
      passwordHash,
      data.first_name || null,
      data.last_name || null,
      data.company_id || null,
      verificationToken
    ];

    const result = await db.queryOne<User>(query, values);
    if (!result) throw new Error('Failed to create user');
    
    return result;
  }

  /**
   * Find user by ID
   */
  async findById(id: number): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    return db.queryOne<User>(query, [id]);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1 OR work_email = $1';
    return db.queryOne<User>(query, [email]);
  }

  /**
   * Find user by magic link token
   */
  async findByMagicLink(token: string): Promise<User | null> {
    const query = `
      SELECT * FROM users 
      WHERE magic_link_token = $1 
      AND magic_link_expires > NOW()
    `;
    return db.queryOne<User>(query, [token]);
  }

  /**
   * Find user by verification token
   */
  async findByVerificationToken(token: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email_verification_token = $1';
    return db.queryOne<User>(query, [token]);
  }

  /**
   * Update user
   */
  async update(id: number, data: UpdateUserRequest): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic update query
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
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
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.queryOne<User>(query, values);
    if (!result) throw new Error('User not found');
    
    return result;
  }

  /**
   * Verify user email
   */
  async verifyEmail(token: string): Promise<User> {
    const query = `
      UPDATE users 
      SET email_verified = true, 
          email_verification_token = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE email_verification_token = $1
      RETURNING *
    `;

    const result = await db.queryOne<User>(query, [token]);
    if (!result) throw new Error('Invalid verification token');
    
    return result;
  }

  /**
   * Generate magic link
   */
  async generateMagicLink(email: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const query = `
      UPDATE users 
      SET magic_link_token = $1,
          magic_link_expires = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE email = $3 OR work_email = $3
      RETURNING id
    `;

    const result = await db.queryOne<{ id: number }>(query, [token, expires, email]);
    if (!result) throw new Error('User not found');
    
    return token;
  }

  /**
   * Validate password
   */
  async validatePassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user || !user.password_hash) return null;

    const valid = await bcrypt.compare(password, user.password_hash);
    return valid ? user : null;
  }

  /**
   * Update last login
   */
  async updateLastLogin(id: number): Promise<void> {
    const query = `
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP,
          login_count = login_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    await db.query(query, [id]);
  }

  /**
   * Mark onboarding complete
   */
  async completeOnboarding(id: number): Promise<void> {
    const query = `
      UPDATE users 
      SET onboarding_completed = true,
          onboarding_completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    await db.query(query, [id]);
  }

  /**
   * Get user with company
   */
  async findByIdWithCompany(id: number): Promise<UserWithCompany | null> {
    const query = `
      SELECT 
        u.*,
        c.id as company_id,
        c.name as company_name,
        c.domain as company_domain,
        c.logo_url as company_logo,
        c.industry as company_industry
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1
    `;
    
    const result = await db.queryOne<any>(query, [id]);
    if (!result) return null;

    // Transform result
    const user: UserWithCompany = {
      ...result,
      company: result.company_id ? {
        id: result.company_id,
        name: result.company_name,
        domain: result.company_domain,
        logo_url: result.company_logo,
        industry: result.company_industry,
        created_at: result.created_at,
        updated_at: result.updated_at
      } as any : undefined
    };

    return user;
  }

  /**
   * List users with pagination
   */
  async list(
    params: PaginationParams & FilterParams
  ): Promise<QueryResult<User>> {
    const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'desc' } = params;
    
    // Build WHERE clause
    const filters: Record<string, any> = {};
    if (params.search) {
      // Search will be handled separately with ILIKE
    }
    if (params.status === 'verified') {
      filters.email_verified = true;
    }
    
    const { text: whereClause, values: whereValues } = dbHelpers.buildWhereClause(filters);
    
    // Add search condition if present
    let searchClause = '';
    if (params.search) {
      searchClause = whereClause ? ' AND ' : ' WHERE ';
      searchClause += `(email ILIKE $${whereValues.length + 1} OR first_name ILIKE $${whereValues.length + 1} OR last_name ILIKE $${whereValues.length + 1})`;
      whereValues.push(`%${params.search}%`);
    }
    
    // Count total
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}${searchClause}`;
    const countResult = await db.queryOne<{ count: string }>(countQuery, whereValues);
    const total = parseInt(countResult?.count || '0');
    
    // Get paginated results
    const query = `
      SELECT * FROM users 
      ${whereClause}${searchClause}
      ${dbHelpers.buildSortClause(sort_by, sort_order)}
      ${dbHelpers.buildPaginationClause(page, limit)}
    `;
    
    const data = await db.queryMany<User>(query, whereValues);
    
    return {
      data,
      total,
      page,
      limit,
      has_more: page * limit < total
    };
  }

  /**
   * Delete user
   */
  async delete(id: number): Promise<void> {
    const query = 'DELETE FROM users WHERE id = $1';
    await db.query(query, [id]);
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_users,
        COUNT(CASE WHEN onboarding_completed = true THEN 1 END) as onboarded_users,
        COUNT(CASE WHEN subscription_tier != 'free' THEN 1 END) as paid_users,
        COUNT(CASE WHEN last_login > CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as active_week,
        COUNT(CASE WHEN last_login > CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as active_month
      FROM users
    `;
    
    return db.queryOne(query);
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
/**
 * Authentication Service
 * Handles JWT tokens, sessions, and authentication logic
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { userRepository } from '../database/repositories/user.repository';
import { db } from '../database/connection';
import { 
  User, 
  UserSession, 
  LoginRequest, 
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse
} from '../database/models';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'rankmybrand-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: UserSession;
    }
  }
}

/**
 * JWT Payload interface
 */
interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  sessionId: number;
}

/**
 * Authentication Service Class
 */
export class AuthService {
  /**
   * Generate JWT token
   */
  generateToken(user: User, sessionId: number): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'rankmybrand.ai',
      audience: 'rankmybrand-users'
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: 'rankmybrand.ai',
        audience: 'rankmybrand-users'
      }) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Create user session
   */
  async createSession(
    user: User,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserSession> {
    const sessionToken = this.generateToken(user, 0); // Temporary ID
    const refreshToken = this.generateRefreshToken();
    
    // Parse user agent for device info
    const deviceInfo = this.parseUserAgent(userAgent);
    
    // Create session in database
    const query = `
      INSERT INTO user_sessions (
        user_id, session_token, refresh_token,
        ip_address, user_agent, device_type, browser, os
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      user.id,
      sessionToken,
      refreshToken,
      ipAddress || null,
      userAgent || null,
      deviceInfo.deviceType,
      deviceInfo.browser,
      deviceInfo.os
    ];
    
    const session = await db.queryOne<UserSession>(query, values);
    if (!session) throw new Error('Failed to create session');
    
    // Update token with actual session ID
    session.session_token = this.generateToken(user, session.id);
    
    // Update session with new token
    await db.query(
      'UPDATE user_sessions SET session_token = $1 WHERE id = $2',
      [session.session_token, session.id]
    );
    
    return session;
  }

  /**
   * Login with email and password
   */
  async loginWithPassword(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    // Validate credentials
    const user = await userRepository.validatePassword(email, password);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if email is verified
    if (!user.email_verified) {
      throw new Error('Please verify your email before logging in');
    }

    // Create session
    const session = await this.createSession(user, ipAddress, userAgent);
    
    // Update last login
    await userRepository.updateLastLogin(user.id);
    
    return {
      user,
      session_token: session.session_token,
      refresh_token: session.refresh_token!,
      expires_at: session.expires_at
    };
  }

  /**
   * Login with magic link
   */
  async loginWithMagicLink(
    token: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    // Find user by magic link token
    const user = await userRepository.findByMagicLink(token);
    if (!user) {
      throw new Error('Invalid or expired magic link');
    }

    // Mark email as verified if not already
    if (!user.email_verified) {
      await userRepository.update(user.id, { email_verified: true });
    }

    // Clear magic link token
    await db.query(
      'UPDATE users SET magic_link_token = NULL, magic_link_expires = NULL WHERE id = $1',
      [user.id]
    );

    // Create session
    const session = await this.createSession(user, ipAddress, userAgent);
    
    // Update last login
    await userRepository.updateLastLogin(user.id);
    
    return {
      user,
      session_token: session.session_token,
      refresh_token: session.refresh_token!,
      expires_at: session.expires_at
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    refreshToken: string
  ): Promise<RefreshTokenResponse> {
    // Find session by refresh token
    const query = `
      SELECT s.*, u.* 
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.refresh_token = $1
      AND s.is_active = true
      AND s.expires_at > NOW()
    `;
    
    const result = await db.queryOne<any>(query, [refreshToken]);
    if (!result) {
      throw new Error('Invalid or expired refresh token');
    }

    // Extract user and session
    const user: User = {
      id: result.user_id,
      email: result.email,
      role: result.role,
      // ... map other user fields
    } as User;
    
    const sessionId = result.id;

    // Generate new tokens
    const newSessionToken = this.generateToken(user, sessionId);
    const newRefreshToken = this.generateRefreshToken();
    
    // Update session
    await db.query(
      `UPDATE user_sessions 
       SET session_token = $1, refresh_token = $2, last_activity = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [newSessionToken, newRefreshToken, sessionId]
    );
    
    return {
      session_token: newSessionToken,
      refresh_token: newRefreshToken,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };
  }

  /**
   * Logout user
   */
  async logout(sessionToken: string): Promise<void> {
    await db.query(
      'UPDATE user_sessions SET is_active = false WHERE session_token = $1',
      [sessionToken]
    );
  }

  /**
   * Logout all sessions for user
   */
  async logoutAll(userId: number): Promise<void> {
    await db.query(
      'UPDATE user_sessions SET is_active = false WHERE user_id = $1',
      [userId]
    );
  }

  /**
   * Validate session
   */
  async validateSession(sessionToken: string): Promise<{ user: User; session: UserSession } | null> {
    try {
      // Verify JWT
      const payload = this.verifyToken(sessionToken);
      
      // For development mode without database, create user from JWT payload
      if (process.env.NODE_ENV === 'development' || process.env.SKIP_DB_CHECK === 'true') {
        const user: User = {
          id: payload.userId,
          email: payload.email,
          work_email: payload.email,
          email_verified: true,
          first_name: payload.company?.split(' ')[0],
          last_name: '',
          company_id: 1,
          role: payload.role || 'user',
          subscription_tier: 'free',
          onboarding_completed: true,
          settings: {},
          preferences: {},
          created_at: new Date(),
          updated_at: new Date()
        };
        
        const session: UserSession = {
          id: payload.sessionId || 1,
          user_id: payload.userId,
          session_token: sessionToken,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          is_active: true,
          created_at: new Date(),
          last_activity: new Date()
        };
        
        return { user, session };
      }
      
      // Get session from database
      const query = `
        SELECT s.*, u.*
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = $1
        AND s.user_id = $2
        AND s.is_active = true
        AND s.expires_at > NOW()
      `;
      
      const result = await db.queryOne<any>(query, [payload.sessionId, payload.userId]);
      if (!result) return null;
      
      // Update last activity
      await db.query(
        'UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = $1',
        [payload.sessionId]
      );
      
      // Parse result into user and session
      const user: User = {
        id: result.user_id,
        email: result.email,
        work_email: result.work_email,
        email_verified: result.email_verified,
        first_name: result.first_name,
        last_name: result.last_name,
        company_id: result.company_id,
        role: result.role,
        subscription_tier: result.subscription_tier,
        onboarding_completed: result.onboarding_completed,
        settings: result.settings,
        preferences: result.preferences,
        created_at: result.created_at,
        updated_at: result.updated_at,
        // ... map other fields
      } as User;
      
      const session: UserSession = {
        id: result.id,
        user_id: result.user_id,
        session_token: result.session_token,
        refresh_token: result.refresh_token,
        is_active: result.is_active,
        created_at: result.created_at,
        expires_at: result.expires_at,
        last_activity: result.last_activity,
        // ... map other fields
      } as UserSession;
      
      return { user, session };
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse user agent string
   */
  private parseUserAgent(userAgent?: string): {
    deviceType: string;
    browser: string;
    os: string;
  } {
    if (!userAgent) {
      return { deviceType: 'unknown', browser: 'unknown', os: 'unknown' };
    }

    // Simple parsing - in production use a library like 'useragent'
    let deviceType = 'desktop';
    if (/mobile/i.test(userAgent)) deviceType = 'mobile';
    else if (/tablet/i.test(userAgent)) deviceType = 'tablet';

    let browser = 'unknown';
    if (/chrome/i.test(userAgent)) browser = 'Chrome';
    else if (/firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/safari/i.test(userAgent)) browser = 'Safari';
    else if (/edge/i.test(userAgent)) browser = 'Edge';

    let os = 'unknown';
    if (/windows/i.test(userAgent)) os = 'Windows';
    else if (/mac/i.test(userAgent)) os = 'macOS';
    else if (/linux/i.test(userAgent)) os = 'Linux';
    else if (/android/i.test(userAgent)) os = 'Android';
    else if (/ios/i.test(userAgent)) os = 'iOS';

    return { deviceType, browser, os };
  }

  /**
   * Clean expired sessions
   */
  async cleanExpiredSessions(): Promise<void> {
    await db.query(
      'UPDATE user_sessions SET is_active = false WHERE expires_at < NOW()'
    );
  }
}

/**
 * Authentication Middleware
 */
export function authMiddleware(required: boolean = true) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get token from header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (required) {
          return res.status(401).json({ error: 'No token provided' });
        }
        return next();
      }

      const token = authHeader.substring(7);
      
      // Validate session
      const authService = new AuthService();
      const validation = await authService.validateSession(token);
      
      if (!validation) {
        if (required) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }
        return next();
      }

      // Attach user and session to request
      req.user = validation.user;
      req.session = validation.session;
      
      next();
    } catch (error: any) {
      if (required) {
        return res.status(401).json({ error: error.message || 'Authentication failed' });
      }
      next();
    }
  };
}

/**
 * Role-based access control middleware
 */
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Export singleton instance
export const authService = new AuthService();
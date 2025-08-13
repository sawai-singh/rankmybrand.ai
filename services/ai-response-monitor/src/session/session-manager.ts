import { Pool } from 'pg';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { SessionData } from '../types';

interface SessionConfig {
  maxAge?: number;           // Maximum session age in ms
  rotationInterval?: number; // How often to rotate sessions
  maxRetries?: number;       // Max retries for session creation
}

export class SessionManager {
  private dbPool: Pool;
  private redis: Redis;
  private sessions: Map<string, SessionData> = new Map();
  private config: SessionConfig;
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(dbPool: Pool, redis: Redis, config?: SessionConfig) {
    this.dbPool = dbPool;
    this.redis = redis;
    this.config = {
      maxAge: config?.maxAge || parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours
      rotationInterval: config?.rotationInterval || parseInt(process.env.SESSION_ROTATION_INTERVAL || '3600000'), // 1 hour
      maxRetries: config?.maxRetries || 3
    };
  }
  
  async initialize(): Promise<void> {
    // Load existing sessions from database
    await this.loadExistingSessions();
    
    // Start session rotation timers
    await this.startRotationTimers();
    
    // Clean up expired sessions
    await this.cleanupExpiredSessions();
    
    // Start periodic cleanup
    setInterval(() => this.cleanupExpiredSessions(), 3600000); // Every hour
  }
  
  private async loadExistingSessions(): Promise<void> {
    const client = await this.dbPool.connect();
    
    try {
      const result = await client.query(
        `SELECT * FROM ai_monitor.sessions 
         WHERE is_active = true 
         AND (expires_at IS NULL OR expires_at > NOW())`
      );
      
      for (const row of result.rows) {
        const sessionData: SessionData = {
          id: row.id,
          platform: row.platform_id,
          token: row.session_token,
          cookies: row.cookies,
          userAgent: row.user_agent,
          proxy: row.proxy_url,
          isActive: row.is_active,
          lastUsed: row.last_used,
          createdAt: row.created_at,
          expiresAt: row.expires_at
        };
        
        this.sessions.set(`${row.platform_id}:${row.id}`, sessionData);
        
        // Cache in Redis for fast access
        await this.cacheSession(sessionData);
      }
      
      console.log(`Loaded ${this.sessions.size} active sessions`);
    } finally {
      client.release();
    }
  }
  
  async getOrCreateSession(platform: string): Promise<SessionData> {
    // Check memory cache first
    const cachedSession = this.getFromCache(platform);
    if (cachedSession && this.isValidSession(cachedSession)) {
      await this.touchSession(cachedSession);
      return cachedSession;
    }
    
    // Check Redis cache
    const redisSession = await this.getFromRedis(platform);
    if (redisSession && this.isValidSession(redisSession)) {
      this.sessions.set(`${platform}:${redisSession.id}`, redisSession);
      await this.touchSession(redisSession);
      return redisSession;
    }
    
    // Create new session
    return this.createSession(platform);
  }
  
  private getFromCache(platform: string): SessionData | undefined {
    for (const [key, session] of this.sessions) {
      if (key.startsWith(`${platform}:`) && session.isActive) {
        return session;
      }
    }
    return undefined;
  }
  
  private async getFromRedis(platform: string): Promise<SessionData | null> {
    const key = `ai-monitor:session:${platform}`;
    const data = await this.redis.get(key);
    
    if (data) {
      try {
        return JSON.parse(data);
      } catch (error) {
        console.error('Failed to parse session from Redis:', error);
        return null;
      }
    }
    
    return null;
  }
  
  private async cacheSession(session: SessionData): Promise<void> {
    const key = `ai-monitor:session:${session.platform}`;
    const ttl = Math.floor((this.config.maxAge || 86400000) / 1000); // Convert to seconds
    
    await this.redis.setex(key, ttl, JSON.stringify(session));
  }
  
  private async createSession(platform: string): Promise<SessionData> {
    const sessionId = uuidv4();
    const session: SessionData = {
      id: sessionId,
      platform,
      token: this.generateSessionToken(),
      cookies: [],
      userAgent: this.generateUserAgent(),
      isActive: true,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (this.config.maxAge || 86400000))
    };
    
    // Store in database
    const client = await this.dbPool.connect();
    
    try {
      // Get platform ID
      const platformResult = await client.query(
        'SELECT id FROM ai_monitor.platforms WHERE name = $1',
        [platform]
      );
      
      if (platformResult.rowCount === 0) {
        throw new Error(`Platform ${platform} not found`);
      }
      
      const platformId = platformResult.rows[0].id;
      
      await client.query(
        `INSERT INTO ai_monitor.sessions 
         (id, platform_id, session_token, cookies, user_agent, proxy_url, is_active, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          session.id,
          platformId,
          session.token,
          JSON.stringify(session.cookies),
          session.userAgent,
          session.proxy,
          session.isActive,
          session.createdAt,
          session.expiresAt
        ]
      );
      
      // Store in memory cache
      this.sessions.set(`${platform}:${sessionId}`, session);
      
      // Store in Redis cache
      await this.cacheSession(session);
      
      console.log(`Created new session for ${platform}: ${sessionId}`);
      
      return session;
    } finally {
      client.release();
    }
  }
  
  async rotateSession(platform: string): Promise<SessionData> {
    console.log(`Rotating session for ${platform}`);
    
    // Invalidate current session
    const currentSession = this.getFromCache(platform);
    if (currentSession) {
      await this.invalidateSession(currentSession);
    }
    
    // Create new session
    return this.createSession(platform);
  }
  
  private async invalidateSession(session: SessionData): Promise<void> {
    session.isActive = false;
    
    // Update database
    await this.dbPool.query(
      'UPDATE ai_monitor.sessions SET is_active = false WHERE id = $1',
      [session.id]
    );
    
    // Remove from caches
    this.sessions.delete(`${session.platform}:${session.id}`);
    await this.redis.del(`ai-monitor:session:${session.platform}`);
    
    console.log(`Invalidated session ${session.id} for ${session.platform}`);
  }
  
  private async touchSession(session: SessionData): Promise<void> {
    session.lastUsed = new Date();
    
    // Update database
    await this.dbPool.query(
      'UPDATE ai_monitor.sessions SET last_used = NOW() WHERE id = $1',
      [session.id]
    );
    
    // Update Redis cache
    await this.cacheSession(session);
  }
  
  private isValidSession(session: SessionData): boolean {
    if (!session.isActive) {
      return false;
    }
    
    if (session.expiresAt && new Date() > session.expiresAt) {
      return false;
    }
    
    // Check if session has been used recently (within last hour)
    if (session.lastUsed) {
      const hourAgo = new Date(Date.now() - 3600000);
      if (session.lastUsed < hourAgo) {
        return true; // Still valid but might need refresh
      }
    }
    
    return true;
  }
  
  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  private generateUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }
  
  private async startRotationTimers(): Promise<void> {
    const platforms = await this.getActivePlatforms();
    
    for (const platform of platforms) {
      if (!this.rotationTimers.has(platform)) {
        const timer = setInterval(
          () => this.rotateSession(platform),
          this.config.rotationInterval || 3600000
        );
        
        this.rotationTimers.set(platform, timer);
      }
    }
  }
  
  private async getActivePlatforms(): Promise<string[]> {
    const result = await this.dbPool.query(
      'SELECT DISTINCT name FROM ai_monitor.platforms WHERE is_active = true'
    );
    
    return result.rows.map(row => row.name);
  }
  
  async getActiveSessions(): Promise<SessionData[]> {
    const activeSessions: SessionData[] = [];
    
    for (const session of this.sessions.values()) {
      if (this.isValidSession(session)) {
        activeSessions.push(session);
      }
    }
    
    return activeSessions;
  }
  
  async updateSessionCookies(sessionId: string, cookies: any[]): Promise<void> {
    // Find session
    let session: SessionData | undefined;
    for (const [key, s] of this.sessions) {
      if (s.id === sessionId) {
        session = s;
        break;
      }
    }
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Update cookies
    session.cookies = cookies;
    
    // Update database
    await this.dbPool.query(
      'UPDATE ai_monitor.sessions SET cookies = $1 WHERE id = $2',
      [JSON.stringify(cookies), sessionId]
    );
    
    // Update cache
    await this.cacheSession(session);
  }
  
  private async cleanupExpiredSessions(): Promise<void> {
    console.log('Cleaning up expired sessions...');
    
    // Clean database
    const result = await this.dbPool.query(
      `UPDATE ai_monitor.sessions 
       SET is_active = false 
       WHERE is_active = true 
       AND expires_at < NOW()
       RETURNING id`
    );
    
    console.log(`Cleaned up ${result.rowCount} expired sessions`);
    
    // Clean memory cache
    for (const [key, session] of this.sessions) {
      if (!this.isValidSession(session)) {
        this.sessions.delete(key);
      }
    }
  }
  
  async getSessionMetrics(): Promise<{
    total: number;
    active: number;
    expired: number;
    byPlatform: Record<string, number>;
  }> {
    const result = await this.dbPool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE is_active = true) as active,
         COUNT(*) FILTER (WHERE is_active = false) as expired
       FROM ai_monitor.sessions`
    );
    
    const platformResult = await this.dbPool.query(
      `SELECT p.name, COUNT(s.*) as count
       FROM ai_monitor.sessions s
       JOIN ai_monitor.platforms p ON s.platform_id = p.id
       WHERE s.is_active = true
       GROUP BY p.name`
    );
    
    const byPlatform: Record<string, number> = {};
    platformResult.rows.forEach(row => {
      byPlatform[row.name] = parseInt(row.count);
    });
    
    return {
      total: parseInt(result.rows[0].total),
      active: parseInt(result.rows[0].active),
      expired: parseInt(result.rows[0].expired),
      byPlatform
    };
  }
  
  async shutdown(): Promise<void> {
    // Clear rotation timers
    for (const timer of this.rotationTimers.values()) {
      clearInterval(timer);
    }
    this.rotationTimers.clear();
    
    // Clear sessions
    this.sessions.clear();
  }
}
/**
 * Authentication Routes
 * Handles login, logout, registration, and session management
 */

import { Router, Request, Response } from 'express';
import { authService, authMiddleware } from '../services/auth.service';
import { userRepository } from '../database/repositories/user.repository';
import { db } from '../database/connection';
import { z } from 'zod';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  magicLinkToken: z.string().optional()
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional()
});

const magicLinkSchema = z.object({
  email: z.string().email()
});

/**
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: validation.error.errors 
      });
    }

    const { email, password, magicLinkToken } = validation.data;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    let result;
    
    if (magicLinkToken) {
      // Login with magic link
      result = await authService.loginWithMagicLink(
        magicLinkToken,
        ipAddress,
        userAgent
      );
    } else if (password) {
      // Login with password
      result = await authService.loginWithPassword(
        email,
        password,
        ipAddress,
        userAgent
      );
    } else {
      return res.status(400).json({ 
        error: 'Either password or magic link token is required' 
      });
    }

    // Set secure cookie for refresh token
    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
        companyId: result.user.company_id,
        role: result.user.role,
        onboardingCompleted: result.user.onboarding_completed
      },
      token: result.session_token,
      expiresAt: result.expires_at
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message || 'Login failed' });
  }
});

/**
 * Register new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: validation.error.errors 
      });
    }

    const { email, password, firstName, lastName, companyName } = validation.data;

    // Check if user exists
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Create user
    const user = await userRepository.create({
      email,
      password,
      first_name: firstName,
      last_name: lastName
    });

    // Send verification email (implement email service)
    // await emailService.sendVerificationEmail(user.email, user.email_verification_token);

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      userId: user.id
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

/**
 * Request magic link
 */
router.post('/magic-link', async (req: Request, res: Response) => {
  try {
    const validation = magicLinkSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid email address' 
      });
    }

    const { email } = validation.data;

    // Check if user exists
    const user = await userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account exists, a magic link has been sent to your email.'
      });
    }

    // Generate magic link
    const token = await userRepository.generateMagicLink(email);
    
    // Create magic link URL
    const magicLinkUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/magic-link?token=${token}`;
    
    // Send email (implement email service)
    console.log('Magic link URL:', magicLinkUrl); // For development
    // await emailService.sendMagicLink(email, magicLinkUrl);

    res.json({
      success: true,
      message: 'If an account exists, a magic link has been sent to your email.'
    });
  } catch (error: any) {
    console.error('Magic link error:', error);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

/**
 * Verify email
 */
router.get('/verify-email/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const user = await userRepository.verifyEmail(token);
    
    // Redirect to frontend with success message
    res.redirect(`${process.env.FRONTEND_URL}/auth/verified?success=true`);
  } catch (error: any) {
    console.error('Email verification error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/auth/verified?success=false`);
  }
});

/**
 * Refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refresh_token || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const result = await authService.refreshToken(refreshToken);
    
    // Set new refresh token cookie
    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      success: true,
      token: result.session_token,
      expiresAt: result.expires_at
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

/**
 * Logout
 */
router.post('/logout', authMiddleware(), async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.substring(7);
    
    if (token) {
      await authService.logout(token);
    }
    
    // Clear refresh token cookie
    res.clearCookie('refresh_token');
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * Logout all sessions
 */
router.post('/logout-all', authMiddleware(), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await authService.logoutAll(req.user.id);
    
    // Clear refresh token cookie
    res.clearCookie('refresh_token');
    
    res.json({
      success: true,
      message: 'All sessions logged out successfully'
    });
  } catch (error: any) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * Get current user
 */
router.get('/me', authMiddleware(), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // For development, return user from JWT without database
    if (process.env.NODE_ENV === 'development' || process.env.SKIP_DB_CHECK === 'true') {
      return res.json({
        success: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          workEmail: req.user.work_email,
          firstName: req.user.first_name,
          lastName: req.user.last_name,
          role: req.user.role,
          subscriptionTier: req.user.subscription_tier,
          onboardingCompleted: req.user.onboarding_completed,
          company: req.user.company_id ? {
            id: req.user.company_id,
            name: req.user.first_name || 'Company',
            domain: req.user.email?.split('@')[1] || 'example.com'
          } : null
        }
      });
    }

    // Get user with company data
    const userWithCompany = await userRepository.findByIdWithCompany(req.user.id);
    
    res.json({
      success: true,
      user: {
        id: userWithCompany?.id,
        email: userWithCompany?.email,
        workEmail: userWithCompany?.work_email,
        firstName: userWithCompany?.first_name,
        lastName: userWithCompany?.last_name,
        avatarUrl: userWithCompany?.avatar_url,
        role: userWithCompany?.role,
        subscriptionTier: userWithCompany?.subscription_tier,
        onboardingCompleted: userWithCompany?.onboarding_completed,
        company: userWithCompany?.company ? {
          id: userWithCompany.company.id,
          name: userWithCompany.company.name,
          domain: userWithCompany.company.domain,
          logo: userWithCompany.company.logo_url,
          industry: userWithCompany.company.industry
        } : null
      }
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

/**
 * Update user profile
 */
router.patch('/me', authMiddleware(), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { firstName, lastName, phone, timezone, settings, preferences } = req.body;
    
    const updatedUser = await userRepository.update(req.user.id, {
      first_name: firstName,
      last_name: lastName,
      phone,
      timezone,
      settings,
      preferences
    });
    
    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phone: updatedUser.phone,
        timezone: updatedUser.timezone
      }
    });
  } catch (error: any) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * Get user sessions
 */
router.get('/sessions', authMiddleware(), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const query = `
      SELECT id, ip_address, user_agent, device_type, browser, os,
             is_active, created_at, last_activity
      FROM user_sessions
      WHERE user_id = $1
      ORDER BY last_activity DESC
    `;
    
    const sessions = await db.queryMany(query, [req.user.id]);
    
    res.json({
      success: true,
      sessions: sessions.map(s => ({
        id: s.id,
        ipAddress: s.ip_address,
        device: `${s.browser} on ${s.os}`,
        deviceType: s.device_type,
        isActive: s.is_active,
        isCurrent: s.id === req.session?.id,
        lastActivity: s.last_activity,
        createdAt: s.created_at
      }))
    });
  } catch (error: any) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

/**
 * Revoke specific session
 */
router.delete('/sessions/:sessionId', authMiddleware(), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { sessionId } = req.params;
    
    // Verify session belongs to user
    const query = `
      UPDATE user_sessions 
      SET is_active = false 
      WHERE id = $1 AND user_id = $2
    `;
    
    await db.query(query, [sessionId, req.user.id]);
    
    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error: any) {
    console.error('Revoke session error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

export default router;
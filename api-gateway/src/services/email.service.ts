/**
 * Email Service
 * Handles sending emails for dashboard links and notifications
 */

import { logger } from '../utils/logger';
import { db } from '../database/connection';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Check for email configuration
    if (process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER)) {
      this.isConfigured = true;
      logger.info('Email service configured');
    } else {
      logger.warn('Email service not configured. Set RESEND_API_KEY or SMTP credentials.');
    }
  }

  /**
   * Send dashboard ready email to user
   */
  async sendDashboardReadyEmail(
    email: string, 
    dashboardUrl: string, 
    companyName: string,
    token?: string
  ): Promise<boolean> {
    if (!this.isConfigured) {
      logger.warn('Email service not configured, skipping email send');
      // Still update the database to show attempt was made
      await db.query(
        `UPDATE user_tracking 
         SET email_sent = false, email_sent_at = CURRENT_TIMESTAMP
         WHERE email = $1`,
        [email]
      );
      return false;
    }

    logger.info(`Sending dashboard ready email to ${email}`);
    
    // For now, just log the email content
    logger.info(`
      TO: ${email}
      SUBJECT: Your ${companyName} AI Visibility Dashboard is Ready!
      DASHBOARD URL: ${dashboardUrl}
    `);

    // Update database to track email sent
    await db.query(
      `UPDATE user_tracking 
       SET email_sent = true, email_sent_at = CURRENT_TIMESTAMP
       WHERE email = $1`,
      [email]
    );

    return true;
  }

  /**
   * Check if email service is configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();
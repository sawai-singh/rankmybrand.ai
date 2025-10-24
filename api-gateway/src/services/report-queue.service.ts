import crypto from 'crypto';
import { db } from '../database/connection';
import { emailService } from './email.service';
import { config } from '../config';

interface QueueReportOptions {
  userId: string;
  companyId?: number;
  sessionId?: string;
  email: string;
  companyName: string;
  competitorCount?: number;
  auditId?: string;
  metadata?: any;
}

interface ReportRequest {
  id: number;
  user_id: string;
  company_id?: number;
  session_id?: string;
  email: string;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'sent';
  created_at: Date;
  eta_minutes: number;
  report_data?: any;
  email_token_hash?: string;
  token_expires_at?: Date;
}

class ReportQueueService {
  private pollInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private tokenSecret: string;
  private tokenExpiryHours: number;
  private defaultEtaMinutes: number;

  constructor() {
    this.tokenSecret = process.env.REPORT_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
    this.tokenExpiryHours = parseInt(process.env.REPORT_TOKEN_EXPIRY_HOURS || '72');
    this.defaultEtaMinutes = parseInt(process.env.REPORT_DEFAULT_ETA_MINUTES || '60');
    
    // Only start polling if feature flag is enabled
    if (process.env.ENABLE_QUEUED_REPORT === 'true') {
      this.startPolling();
    }
  }

  private startPolling() {
    const interval = parseInt(process.env.REPORT_QUEUE_POLL_INTERVAL || '60000');
    
    this.pollInterval = setInterval(() => {
      this.processQueue();
    }, interval);
    
    console.log(`✅ Report queue polling started (interval: ${interval}ms)`);
    
    // Process immediately on startup
    this.processQueue();
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('Report queue polling stopped');
    }
  }

  // Create idempotent report request
  async queueReport(options: QueueReportOptions): Promise<ReportRequest | null> {
    const { userId, companyId, sessionId, email, companyName, competitorCount, auditId, metadata } = options;
    
    // Generate idempotency key (user + company + day)
    const today = new Date().toISOString().split('T')[0];
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${userId}-${companyId || 'no-company'}-${today}`)
      .digest('hex');
    
    try {
      // Check if request already exists (idempotent)
      const existing = await db.query(
        `SELECT * FROM report_requests WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      
      if (existing.rows.length > 0) {
        console.log(`Report request already exists for key: ${idempotencyKey}`);
        return existing.rows[0];
      }
      
      // Create new request
      const result = await db.query(
        `INSERT INTO report_requests (
          user_id, company_id, session_id, email,
          status, eta_minutes, idempotency_key, metadata, audit_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          userId,
          companyId,
          sessionId,
          email,
          'queued',
          this.defaultEtaMinutes,
          idempotencyKey,
          JSON.stringify({ companyName, competitorCount, ...metadata }),
          auditId
        ]
      );
      
      const request = result.rows[0];
      
      // Log event
      await this.logEvent(request.id, 'queued', { email, companyName });
      
      console.log(`✅ Report queued: ${request.id} for ${email}`);
      return request;
    } catch (error) {
      console.error('Failed to queue report:', error);
      return null;
    }
  }

  // Process queued reports
  async processQueue() {
    if (this.isProcessing) {
      return; // Prevent concurrent processing
    }
    
    this.isProcessing = true;
    
    try {
      // Get next queued report
      const result = await db.query(
        `SELECT * FROM report_requests 
         WHERE status = 'queued' 
         ORDER BY created_at ASC 
         LIMIT 1 
         FOR UPDATE SKIP LOCKED`
      );
      
      if (result.rows.length === 0) {
        return; // No reports to process
      }
      
      const report = result.rows[0];
      
      // Mark as processing
      await db.query(
        `UPDATE report_requests 
         SET status = 'processing', processing_started_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [report.id]
      );
      
      await this.logEvent(report.id, 'processing_started');
      
      // Simulate report generation (in production, call actual services)
      await this.generateReport(report);
      
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Generate report (simulate or call actual services)
  private async generateReport(report: ReportRequest) {
    try {
      // In production, call actual analysis services here
      // For now, simulate with delay
      const processingTime = config.isDevelopment ? 5000 : 30000; // 5s dev, 30s prod
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      // Generate mock report data
      const reportData = {
        geoScore: 75 + Math.random() * 20,
        visibility: {
          chatgpt: 70 + Math.random() * 25,
          claude: 65 + Math.random() * 30,
          perplexity: 60 + Math.random() * 35,
          gemini: 55 + Math.random() * 40,
        },
        competitors: [],
        insights: [
          'Your brand visibility is strong in technical queries',
          'Consider improving content for comparison searches',
          'Authority score trending upward over past 30 days'
        ],
        generatedAt: new Date().toISOString()
      };
      
      // Generate signed token for email link
      const token = this.generateSignedToken(report.user_id, report.id);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const tokenExpiresAt = new Date(Date.now() + this.tokenExpiryHours * 60 * 60 * 1000);
      
      // Update report as ready
      await db.query(
        `UPDATE report_requests 
         SET status = 'ready', 
             completed_at = CURRENT_TIMESTAMP,
             report_data = $1,
             email_token_hash = $2,
             token_expires_at = $3
         WHERE id = $4`,
        [JSON.stringify(reportData), tokenHash, tokenExpiresAt, report.id]
      );
      
      await this.logEvent(report.id, 'completed', { hasData: true });
      
      // Send email
      await this.sendReportEmail(report, token);
      
    } catch (error) {
      console.error(`Failed to generate report ${report.id}:`, error);
      
      // Mark as failed
      await db.query(
        `UPDATE report_requests 
         SET status = 'failed', 
             error_message = $1,
             retry_count = retry_count + 1
         WHERE id = $2`,
        [(error as Error).message, report.id]
      );
      
      await this.logEvent(report.id, 'failed', { error: (error as Error).message });
    }
  }

  // Send report ready email
  private async sendReportEmail(report: any, token: string) {
    try {
      const metadata = report.metadata || {};
      const dashboardUrl = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3003';
      const signedUrl = `${dashboardUrl}/r/${token}`;
      
      // TODO: Implement sendReportReadyEmail in EmailService
      const success = await (emailService as any).sendReportReadyEmail?.(
        report.email,
        metadata.companyName || 'Your Company',
        signedUrl,
        metadata.competitorCount || 0
      ) || true;
      
      if (success) {
        await db.query(
          `UPDATE report_requests 
           SET status = 'sent', 
               email_sent = true, 
               email_sent_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [report.id]
        );
        
        await this.logEvent(report.id, 'email_sent', { to: report.email });
        console.log(`✅ Report email sent to ${report.email}`);
      } else {
        throw new Error('Email send failed');
      }
    } catch (error) {
      console.error(`Failed to send report email for ${report.id}:`, error);
      await this.logEvent(report.id, 'email_failed', { error: (error as Error).message });
    }
  }

  // Generate signed token for email links
  private generateSignedToken(userId: string, reportId: number): string {
    const payload = {
      userId,
      reportId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex')
    };
    
    const message = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', this.tokenSecret)
      .update(message)
      .digest('hex');
    
    // Combine payload and signature
    const token = Buffer.from(`${message}.${signature}`).toString('base64url');
    return token;
  }

  // Validate signed token
  async validateToken(token: string): Promise<{ valid: boolean; data?: any; error?: string }> {
    try {
      // Decode token
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const [message, signature] = decoded.split('.');
      
      if (!message || !signature) {
        return { valid: false };
      }
      
      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.tokenSecret)
        .update(message)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return { valid: false };
      }
      
      // Parse payload
      const payload = JSON.parse(message);
      
      // Check token hash in database
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const result = await db.query(
        `SELECT * FROM report_requests 
         WHERE email_token_hash = $1 
           AND token_expires_at > CURRENT_TIMESTAMP 
           AND token_used = false`,
        [tokenHash]
      );
      
      if (result.rows.length === 0) {
        return { valid: false };
      }
      
      const report = result.rows[0];
      
      // Mark token as used (single-use)
      await db.query(
        `UPDATE report_requests 
         SET token_used = true, 
             token_used_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [report.id]
      );
      
      await this.logEvent(report.id, 'link_clicked');
      
      return {
        valid: true,
        data: {
          userId: payload.userId,
          reportId: payload.reportId,
          companyId: report.company_id,
          email: report.email
        }
      };
    } catch (error) {
      console.error('Token validation error:', error);
      return { valid: false };
    }
  }

  // Log analytics event
  private async logEvent(
    reportRequestId: number,
    eventType: string,
    eventData?: any,
    userAgent?: string,
    ipAddress?: string
  ) {
    try {
      await db.query(
        `INSERT INTO report_events (
          report_request_id, event_type, event_data, user_agent, ip_address
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          reportRequestId,
          eventType,
          eventData ? JSON.stringify(eventData) : null,
          userAgent,
          ipAddress
        ]
      );
    } catch (error) {
      console.error('Failed to log report event:', error);
    }
  }

  // Get report status
  async getReportStatus(userId: string): Promise<any> {
    try {
      const result = await db.query(
        `SELECT status, eta_minutes, created_at, email_sent_at 
         FROM report_requests 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get report status:', error);
      return null;
    }
  }
}

// Export singleton instance
export const reportQueueService = new ReportQueueService();
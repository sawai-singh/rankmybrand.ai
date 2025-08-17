import nodemailer from 'nodemailer';
import { config } from '../config';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private useResend: boolean = false;
  private resendApiKey: string | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Check for Resend API key first (preferred)
    this.resendApiKey = process.env.RESEND_API_KEY || null;
    
    if (this.resendApiKey) {
      this.useResend = true;
      console.log('✅ Email service: Using Resend');
      return;
    }

    // Fall back to SMTP if configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      // Verify connection
      try {
        await this.transporter.verify();
        console.log('✅ Email service: SMTP connection verified');
      } catch (error) {
        console.error('❌ Email service: SMTP connection failed:', error);
        this.transporter = null;
      }
    } else {
      console.warn('⚠️ Email service: No email provider configured (set RESEND_API_KEY or SMTP_*)');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;
    const from = options.from || process.env.EMAIL_FROM || 'no-reply@rankmybrand.ai';
    const replyTo = options.replyTo || process.env.EMAIL_REPLY_TO || 'support@rankmybrand.ai';

    try {
      if (this.useResend && this.resendApiKey) {
        // Use Resend API
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [to],
            subject,
            html,
            text,
            reply_to: replyTo,
            tags: [
              { name: 'category', value: 'report' },
              { name: 'environment', value: config.env },
            ],
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Resend API error: ${error}`);
        }

        const data = await response.json();
        console.log(`✅ Email sent via Resend: ${data.id}`);
        return true;
      } else if (this.transporter) {
        // Use SMTP
        const info = await this.transporter.sendMail({
          from,
          to,
          subject,
          html,
          text,
          replyTo,
          headers: {
            'X-Category': 'report',
            'X-Environment': config.env,
          },
        });

        console.log(`✅ Email sent via SMTP: ${info.messageId}`);
        return true;
      } else {
        // No email provider available - log for development
        if (config.isDevelopment) {
          console.log('📧 Email (dev mode):');
          console.log(`  To: ${to}`);
          console.log(`  Subject: ${subject}`);
          console.log(`  From: ${from}`);
          console.log(`  Text preview: ${text.substring(0, 200)}...`);
          return true;
        }
        
        throw new Error('No email provider configured');
      }
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  }

  async sendReportReadyEmail(
    email: string,
    companyName: string,
    signedUrl: string,
    competitorCount: number = 0
  ): Promise<boolean> {
    const subject = 'Your RankMyBrand dashboard link is ready';
    
    // HTML template with inline styles for better email client support
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">RankMyBrand</h1>
              <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 14px;">AI Visibility Analytics</p>
            </td>
          </tr>
          
          <!-- Hero -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center;">
              <h2 style="margin: 0 0 10px; color: #1f2937; font-size: 28px; font-weight: 700;">
                Your AI Visibility Report is Ready!
              </h2>
              <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 24px;">
                We've completed the analysis for <strong>${companyName}</strong>
              </p>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 30px;" align="center">
              <a href="${signedUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                Open Dashboard →
              </a>
            </td>
          </tr>
          
          <!-- Details -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 0 12px;">
                          <strong style="color: #6b7280; font-size: 14px;">Company:</strong>
                          <span style="color: #1f2937; font-size: 14px; margin-left: 8px;">${companyName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 0 12px;">
                          <strong style="color: #6b7280; font-size: 14px;">Competitors Analyzed:</strong>
                          <span style="color: #1f2937; font-size: 14px; margin-left: 8px;">${competitorCount}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0;">
                          <strong style="color: #6b7280; font-size: 14px;">Report Generated:</strong>
                          <span style="color: #1f2937; font-size: 14px; margin-left: 8px;">${new Date().toLocaleString()}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 12px; text-align: center;">
                This secure link expires in 72 hours. Save your dashboard for permanent access.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Need help? Reply to this email or visit our <a href="https://rankmybrand.ai/support" style="color: #667eea;">support center</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Plain text version
    const text = `Your RankMyBrand AI Visibility Report is Ready!

We've completed the analysis for ${companyName}.

Open your dashboard: ${signedUrl}

Report Details:
- Company: ${companyName}
- Competitors Analyzed: ${competitorCount}
- Generated: ${new Date().toLocaleString()}

This secure link expires in 72 hours. Save your dashboard for permanent access.

Need help? Reply to this email or visit https://rankmybrand.ai/support

---
RankMyBrand - AI Visibility Analytics`;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  // Retry logic with exponential backoff
  async sendEmailWithRetry(
    options: EmailOptions,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const success = await this.sendEmail(options);
      
      if (success) {
        return true;
      }
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying email send in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return false;
  }
}

// Export singleton instance
export const emailService = new EmailService();
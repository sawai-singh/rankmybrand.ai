import nodemailer from 'nodemailer';
import { WebClient } from '@slack/web-api';
import axios from 'axios';
import { Recommendation, ApprovalRequest } from '../types';
import { logger } from './logger';

interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'teams';
  config: any;
}

interface NotificationTemplate {
  subject?: string;
  title: string;
  body: string;
  actionUrl?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export class NotificationService {
  private channels: NotificationChannel[] = [];
  private emailTransporter?: nodemailer.Transporter;
  private slackClient?: WebClient;

  constructor() {
    this.initializeChannels();
  }

  private initializeChannels(): void {
    // Email configuration
    if (process.env.SMTP_HOST) {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      
      this.channels.push({
        type: 'email',
        config: {
          from: process.env.SMTP_FROM || 'noreply@rankmybrand.ai',
          to: process.env.NOTIFICATION_EMAIL?.split(',') || []
        }
      });
    }

    // Slack configuration
    if (process.env.SLACK_BOT_TOKEN) {
      this.slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
      
      this.channels.push({
        type: 'slack',
        config: {
          channel: process.env.SLACK_CHANNEL || '#alerts'
        }
      });
    }

    // Webhook configuration
    if (process.env.WEBHOOK_URL) {
      this.channels.push({
        type: 'webhook',
        config: {
          url: process.env.WEBHOOK_URL,
          headers: process.env.WEBHOOK_HEADERS ? 
            JSON.parse(process.env.WEBHOOK_HEADERS) : {}
        }
      });
    }

    // Microsoft Teams configuration
    if (process.env.TEAMS_WEBHOOK_URL) {
      this.channels.push({
        type: 'teams',
        config: {
          url: process.env.TEAMS_WEBHOOK_URL
        }
      });
    }

    logger.info(`Initialized ${this.channels.length} notification channels`);
  }

  async notifyApprovalRequired(recommendation: Recommendation): Promise<void> {
    const template: NotificationTemplate = {
      subject: `[Action Required] New recommendation needs approval: ${recommendation.title}`,
      title: '🔔 Approval Required',
      body: this.formatRecommendationMessage(recommendation),
      actionUrl: `${process.env.DASHBOARD_URL}/recommendations/${recommendation.id}`,
      priority: this.getPriorityLevel(recommendation.priority)
    };

    await this.sendToAllChannels(template);
  }

  async notifyExecutionSuccess(recommendation: Recommendation, result: any): Promise<void> {
    const template: NotificationTemplate = {
      subject: `✅ Successfully executed: ${recommendation.title}`,
      title: 'Execution Success',
      body: `
**Recommendation:** ${recommendation.title}
**Type:** ${recommendation.type}
**Platform:** ${result.platform || 'N/A'}
**Execution Time:** ${result.executionTimeMs}ms

**Result:**
${result.message || 'Operation completed successfully'}

${result.url ? `**View Result:** ${result.url}` : ''}
      `.trim(),
      actionUrl: result.url,
      priority: 'low'
    };

    await this.sendToAllChannels(template);
  }

  async notifyExecutionFailure(recommendation: Recommendation, error: any): Promise<void> {
    const template: NotificationTemplate = {
      subject: `❌ Execution failed: ${recommendation.title}`,
      title: 'Execution Failure',
      body: `
**Recommendation:** ${recommendation.title}
**Type:** ${recommendation.type}
**Error:** ${error.message || 'Unknown error'}

**Stack Trace:**
\`\`\`
${error.stack || 'No stack trace available'}
\`\`\`

**Action Required:** Manual intervention may be needed.
      `.trim(),
      actionUrl: `${process.env.DASHBOARD_URL}/recommendations/${recommendation.id}`,
      priority: 'high'
    };

    await this.sendToAllChannels(template);
  }

  async notifyRollbackSuccess(recommendation: Recommendation): Promise<void> {
    const template: NotificationTemplate = {
      subject: `🔄 Rollback successful: ${recommendation.title}`,
      title: 'Rollback Complete',
      body: `
**Recommendation:** ${recommendation.title}
**Status:** Successfully rolled back to previous state

The changes have been reverted. Please review and adjust the recommendation before retrying.
      `.trim(),
      actionUrl: `${process.env.DASHBOARD_URL}/recommendations/${recommendation.id}`,
      priority: 'medium'
    };

    await this.sendToAllChannels(template);
  }

  async notifyHighPriorityRecommendation(recommendation: Recommendation): Promise<void> {
    const template: NotificationTemplate = {
      subject: `🚨 High Priority: ${recommendation.title}`,
      title: 'High Priority Recommendation',
      body: this.formatRecommendationMessage(recommendation),
      actionUrl: `${process.env.DASHBOARD_URL}/recommendations/${recommendation.id}`,
      priority: 'urgent'
    };

    await this.sendToAllChannels(template);
  }

  async notifyBatchComplete(brandId: string, count: number, summary: any): Promise<void> {
    const template: NotificationTemplate = {
      subject: `📊 Batch processing complete for brand ${brandId}`,
      title: 'Batch Processing Complete',
      body: `
**Brand:** ${brandId}
**Recommendations Generated:** ${count}

**Summary:**
- High Priority: ${summary.highPriority || 0}
- Medium Priority: ${summary.mediumPriority || 0}
- Low Priority: ${summary.lowPriority || 0}
- Auto-Executable: ${summary.autoExecutable || 0}

**Next Steps:**
Review and approve pending recommendations in the dashboard.
      `.trim(),
      actionUrl: `${process.env.DASHBOARD_URL}/brands/${brandId}/recommendations`,
      priority: 'medium'
    };

    await this.sendToAllChannels(template);
  }

  private async sendToAllChannels(template: NotificationTemplate): Promise<void> {
    const promises = this.channels.map(channel => 
      this.sendToChannel(channel, template).catch(error => {
        logger.error(`Failed to send to ${channel.type}:`, error);
      })
    );

    await Promise.all(promises);
  }

  private async sendToChannel(
    channel: NotificationChannel,
    template: NotificationTemplate
  ): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmail(channel.config, template);
        break;
      
      case 'slack':
        await this.sendSlack(channel.config, template);
        break;
      
      case 'webhook':
        await this.sendWebhook(channel.config, template);
        break;
      
      case 'teams':
        await this.sendTeams(channel.config, template);
        break;
    }
  }

  private async sendEmail(config: any, template: NotificationTemplate): Promise<void> {
    if (!this.emailTransporter || !config.to?.length) {
      return;
    }

    const mailOptions = {
      from: config.from,
      to: config.to.join(','),
      subject: template.subject || template.title,
      text: this.stripMarkdown(template.body),
      html: this.markdownToHtml(template.body)
    };

    await this.emailTransporter.sendMail(mailOptions);
    logger.info(`Email sent to ${config.to.length} recipients`);
  }

  private async sendSlack(config: any, template: NotificationTemplate): Promise<void> {
    if (!this.slackClient) {
      return;
    }

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: template.title,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: template.body
        }
      }
    ];

    if (template.actionUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details',
              emoji: true
            },
            url: template.actionUrl,
            style: template.priority === 'urgent' ? 'danger' : 'primary'
          }
        ]
      });
    }

    await this.slackClient.chat.postMessage({
      channel: config.channel,
      blocks,
      text: template.title // Fallback text
    });

    logger.info(`Slack message sent to ${config.channel}`);
  }

  private async sendWebhook(config: any, template: NotificationTemplate): Promise<void> {
    const payload = {
      title: template.title,
      body: template.body,
      priority: template.priority,
      actionUrl: template.actionUrl,
      timestamp: new Date().toISOString()
    };

    await axios.post(config.url, payload, {
      headers: config.headers,
      timeout: 10000
    });

    logger.info(`Webhook sent to ${config.url}`);
  }

  private async sendTeams(config: any, template: NotificationTemplate): Promise<void> {
    const card = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: this.getThemeColor(template.priority),
      summary: template.title,
      sections: [
        {
          activityTitle: template.title,
          text: template.body,
          markdown: true
        }
      ],
      potentialAction: template.actionUrl ? [
        {
          '@type': 'OpenUri',
          name: 'View Details',
          targets: [
            {
              os: 'default',
              uri: template.actionUrl
            }
          ]
        }
      ] : []
    };

    await axios.post(config.url, card, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    logger.info('Teams notification sent');
  }

  private formatRecommendationMessage(recommendation: Recommendation): string {
    return `
**Title:** ${recommendation.title}
**Type:** ${recommendation.type}${recommendation.subtype ? ` / ${recommendation.subtype}` : ''}
**Priority:** ${recommendation.priority}/100
**Estimated Impact:** ${recommendation.estimatedImpact || 'N/A'}
**Implementation Effort:** ${recommendation.implementationEffort || 'N/A'}
**Auto-Executable:** ${recommendation.autoExecutable ? 'Yes' : 'No'}

**Description:**
${recommendation.description || 'No description provided'}

${recommendation.metadata?.reason ? `**Reason:** ${recommendation.metadata.reason}` : ''}
    `.trim();
  }

  private getPriorityLevel(priority: number): 'low' | 'medium' | 'high' | 'urgent' {
    if (priority >= 90) return 'urgent';
    if (priority >= 70) return 'high';
    if (priority >= 40) return 'medium';
    return 'low';
  }

  private getThemeColor(priority?: string): string {
    switch (priority) {
      case 'urgent': return 'FF0000';
      case 'high': return 'FF9900';
      case 'medium': return 'FFCC00';
      case 'low': return '00CC00';
      default: return '0078D4';
    }
  }

  private stripMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }

  private markdownToHtml(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\n/g, '<br>');
  }
}
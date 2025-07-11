'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.emailService = exports.EmailService = void 0;
const nodemailer = __importStar(require('nodemailer'));
const v2_1 = require('firebase-functions/v2');
class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    // Don't initialize immediately to avoid startup failures
    // Initialize lazily when first used
  }
  getEnvironment() {
    return process.env.NODE_ENV === 'production' ? 'production' : 'development';
  }
  formatSubjectWithEnvironment(subject) {
    const environment = this.getEnvironment();
    if (environment === 'production') {
      return subject; // No prefix for production
    }
    return `[DEV] ${subject}`;
  }
  initializeTransporter() {
    if (this.initialized) return;
    try {
      // Use environment variables for Firebase Functions v2
      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = process.env.SMTP_PORT || '587';
      const smtpUser = process.env.SMTP_USER || 'status@aistatusdashboard.com';
      const smtpPass = process.env.SMTP_PASS || 'your-app-password';
      const environment = this.getEnvironment();
      // Skip initialization if using placeholder credentials
      if (
        !smtpUser ||
        !smtpPass ||
        smtpPass.includes('placeholder') ||
        smtpUser.includes('placeholder') ||
        smtpPass === 'your-app-password'
      ) {
        v2_1.logger.warn('SMTP using placeholder credentials - email service disabled', {
          environment,
        });
        this.initialized = true;
        return;
      }
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpPort === '465',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      // Only verify if we have real credentials - don't block startup
      if (this.transporter) {
        this.transporter.verify((error, success) => {
          if (error) {
            v2_1.logger.error('SMTP configuration error (non-blocking)', {
              error: error.message,
              environment,
            });
            // Don't throw - just log the error
          } else {
            v2_1.logger.info('SMTP server is ready to send emails', {
              environment,
              host: smtpHost,
              user: smtpUser,
            });
          }
        });
      }
      this.initialized = true;
    } catch (error) {
      v2_1.logger.error('Failed to initialize email transporter (non-blocking)', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.initialized = true; // Mark as initialized even if failed to prevent retry loops
    }
  }
  async sendEmail(options) {
    try {
      // Initialize on first use
      this.initializeTransporter();
      const enableRealMonitoring = process.env.APP_ENABLE_REAL_MONITORING || 'true';
      const environment = this.getEnvironment();
      const smtpFrom =
        process.env.SMTP_FROM || 'AI Status Dashboard <status@aistatusdashboard.com>';
      // Check if email sending is enabled
      if (enableRealMonitoring !== 'true') {
        v2_1.logger.warn(
          'Real email sending is disabled in config. Set APP_ENABLE_REAL_MONITORING=true to send actual emails.',
          {
            to: options.to,
            subject: options.subject,
            environment,
          }
        );
        return false;
      }
      // Check if transporter is available
      if (!this.transporter) {
        v2_1.logger.error('Email service not available. Please configure real SMTP credentials.');
        return false;
      }
      // Format subject with environment prefix
      const formattedSubject = this.formatSubjectWithEnvironment(options.subject);
      const mailOptions = {
        from: smtpFrom,
        to: options.to,
        subject: formattedSubject,
        text: options.text,
        html: options.html,
      };
      const result = await this.transporter.sendMail(mailOptions);
      v2_1.logger.info('REAL email sent successfully', {
        messageId: result.messageId,
        to: options.to,
        subject: formattedSubject,
        from: mailOptions.from,
        environment,
      });
      return true;
    } catch (error) {
      v2_1.logger.error('Failed to send REAL email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to: options.to,
        subject: options.subject,
      });
      return false;
    }
  }
  async sendStatusAlert(email, providerName, status) {
    const subject = `🚨 AI Status Alert: ${providerName} is ${status}`;
    const environment = this.getEnvironment();
    const siteUrl =
      process.env.APP_BASE_URL ||
      (environment === 'production' ? 'https://aistatusdashboard.com' : 'http://localhost:3000');
    const environmentBadge =
      environment === 'production' ? '' : `<span class="env-badge">DEV</span>`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>AI Status Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .alert { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin: 20px 0; }
          .status-${status} { color: ${status === 'operational' ? '#28a745' : status === 'degraded' ? '#ffc107' : '#dc3545'}; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .env-badge { background: #17a2b8; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; margin-left: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🤖 AI Service Status Alert ${environmentBadge}</h1>
          
          <div class="alert">
            <h2><strong>${providerName}</strong> status has changed to: <span class="status-${status}">${status.toUpperCase()}</span></h2>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Provider:</strong> ${providerName}</p>
            <p><strong>New Status:</strong> ${status}</p>
            <p><strong>Environment:</strong> ${environment}</p>
          </div>
          
          <p>Check the <a href="${siteUrl}" style="color: #007bff;">AI Status Dashboard</a> for more details and real-time updates.</p>
          
          <div class="footer">
            <p>You're receiving this because you subscribed to notifications for AI service status changes.</p>
            <p>To unsubscribe, visit <a href="${siteUrl}/unsubscribe">AI Status Dashboard</a></p>
            <p><small>Environment: ${environment}</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `${providerName} status has changed to: ${status}. Check ${siteUrl} for details. (Environment: ${environment})`,
    });
  }
  async sendIncidentAlert(email, incident) {
    const subject = `🚨 AI Status Incident: ${incident.title}`;
    const environment = this.getEnvironment();
    const siteUrl =
      process.env.APP_BASE_URL ||
      (environment === 'production' ? 'https://aistatusdashboard.com' : 'http://localhost:3000');
    const environmentBadge =
      environment === 'production' ? '' : `<span class="env-badge">DEV</span>`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>AI Status Incident</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .incident { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 20px; margin: 20px 0; }
          .incident h2 { color: #721c24; margin-top: 0; }
          .status { font-weight: bold; color: #dc3545; }
          .impact { font-weight: bold; color: #856404; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .env-badge { background: #17a2b8; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; margin-left: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚨 AI Service Incident Alert ${environmentBadge}</h1>
          
          <div class="incident">
            <h2>${incident.title}</h2>
            <p><strong>Status:</strong> <span class="status">${incident.status.toUpperCase()}</span></p>
            <p><strong>Impact:</strong> <span class="impact">${incident.impact.toUpperCase()}</span></p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Environment:</strong> ${environment}</p>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #f5c6cb;">
              <p>${incident.body}</p>
            </div>
          </div>
          
          <p>Check the <a href="${siteUrl}" style="color: #007bff;">AI Status Dashboard</a> for updates and resolution progress.</p>
          
          <div class="footer">
            <p>You're receiving this because you subscribed to incident notifications.</p>
            <p>To unsubscribe, visit <a href="${siteUrl}/unsubscribe">AI Status Dashboard</a></p>
            <p><small>Environment: ${environment}</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `${incident.title} - Status: ${incident.status}. Impact: ${incident.impact}. ${incident.body}. Check ${siteUrl} for updates. (Environment: ${environment})`,
    });
  }
}
exports.EmailService = EmailService;
exports.emailService = new EmailService();
//# sourceMappingURL=emailService.js.map

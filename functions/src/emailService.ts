import * as nodemailer from 'nodemailer';
import { logger } from 'firebase-functions/v2';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // For now, we'll use a simple configuration
    // In production, you would use proper SMTP credentials
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'noreply@yourdomain.com',
        pass: process.env.SMTP_PASSWORD || 'your-app-password'
      }
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.SMTP_USER || 'noreply@yourdomain.com',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', { messageId: result.messageId, to: options.to });
      return true;
    } catch (error) {
      logger.error('Failed to send email', { error, to: options.to });
      return false;
    }
  }

  async sendStatusAlert(email: string, providerName: string, status: string): Promise<boolean> {
    const subject = `AI Status Alert: ${providerName} is ${status}`;
    const html = `
      <h2>AI Service Status Alert</h2>
      <p><strong>${providerName}</strong> status has changed to: <strong>${status}</strong></p>
      <p>Check the <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'}">AI Status Dashboard</a> for more details.</p>
      <hr>
      <p><small>You're receiving this because you subscribed to notifications for AI service status changes.</small></p>
    `;
    
    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `${providerName} status has changed to: ${status}. Check ${process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'} for details.`
    });
  }

  async sendIncidentAlert(email: string, incident: any): Promise<boolean> {
    const subject = `AI Status Incident: ${incident.title}`;
    const html = `
      <h2>AI Service Incident Alert</h2>
      <h3>${incident.title}</h3>
      <p><strong>Status:</strong> ${incident.status}</p>
      <p><strong>Impact:</strong> ${incident.impact}</p>
      <p>${incident.body}</p>
      <p>Check the <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'}">AI Status Dashboard</a> for updates.</p>
      <hr>
      <p><small>You're receiving this because you subscribed to incident notifications.</small></p>
    `;
    
    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `${incident.title} - Status: ${incident.status}. ${incident.body}`
    });
  }
}

export const emailService = new EmailService(); 
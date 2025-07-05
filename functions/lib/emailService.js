"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = exports.EmailService = void 0;
const nodemailer = __importStar(require("nodemailer"));
const v2_1 = require("firebase-functions/v2");
class EmailService {
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
    async sendEmail(options) {
        try {
            const mailOptions = {
                from: process.env.SMTP_USER || 'noreply@yourdomain.com',
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html
            };
            const result = await this.transporter.sendMail(mailOptions);
            v2_1.logger.info('Email sent successfully', { messageId: result.messageId, to: options.to });
            return true;
        }
        catch (error) {
            v2_1.logger.error('Failed to send email', { error, to: options.to });
            return false;
        }
    }
    async sendStatusAlert(email, providerName, status) {
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
    async sendIncidentAlert(email, incident) {
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
exports.EmailService = EmailService;
exports.emailService = new EmailService();
//# sourceMappingURL=emailService.js.map
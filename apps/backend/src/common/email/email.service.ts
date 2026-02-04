/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EMAIL SERVICE — Nodemailer Integration for Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Centralized email sending service using Nodemailer.
 * Supports SMTP, Gmail, and other providers.
 *
 * CONFIGURATION (.env):
 * - SMTP_ENABLED=true
 * - SMTP_HOST=smtp.gmail.com
 * - SMTP_PORT=587
 * - SMTP_SECURE=false (true for port 465)
 * - SMTP_USER=your-email@gmail.com
 * - SMTP_PASS=your-app-password
 * - SMTP_FROM=noreply@manchengo.dz
 * - SMTP_FROM_NAME=Manchengo Smart ERP
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private isEnabled = false;
  private fromAddress = '';
  private fromName = 'Manchengo Smart ERP';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.isEnabled = this.configService.get<string>('SMTP_ENABLED', 'false') === 'true';
    this.fromAddress = this.configService.get<string>('SMTP_FROM', 'noreply@manchengo.dz');
    this.fromName = this.configService.get<string>('SMTP_FROM_NAME', 'Manchengo Smart ERP');

    if (!this.isEnabled) {
      this.logger.warn('SMTP is disabled. Emails will be logged but not sent.');
      return;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure = this.configService.get<string>('SMTP_SECURE', 'false') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host) {
      this.logger.warn('SMTP_HOST not configured. Email service disabled.');
      this.isEnabled = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
        tls: {
          rejectUnauthorized: false, // For self-signed certs in dev
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 10, // Max 10 emails per second
      });

      // Verify connection
      await this.transporter.verify();
      this.logger.log(`Email service initialized: ${host}:${port} (secure: ${secure})`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to initialize email service: ${errMsg}`);
      this.isEnabled = false;
      this.transporter = null;
    }
  }

  /**
   * Check if email service is available
   */
  isAvailable(): boolean {
    return this.isEnabled && this.transporter !== null;
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    // If not enabled, simulate
    if (!this.isAvailable()) {
      this.logger.debug(
        `[SIMULATION] Email to: ${recipients.join(', ')} | Subject: ${options.subject}`,
      );
      return {
        success: true,
        messageId: `simulated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const info = await this.transporter!.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: recipients.join(', '),
        cc: options.cc
          ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc)
          : undefined,
        bcc: options.bcc
          ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc)
          : undefined,
        subject: options.subject,
        html: this.wrapInTemplate(options.html),
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });

      this.logger.log(`Email sent successfully: ${info.messageId} to ${recipients.join(', ')}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send email to ${recipients.join(', ')}: ${errMsg}`);

      return {
        success: false,
        error: errMsg,
      };
    }
  }

  /**
   * Send email with an attachment (e.g., report PDF/Excel)
   */
  async sendEmailWithAttachment(
    to: string | string[],
    subject: string,
    html: string,
    attachment: {
      filename: string;
      content: Buffer;
      contentType: string;
    },
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject,
      html,
      attachments: [attachment],
    });
  }

  /**
   * Wrap email body in a professional HTML template
   */
  private wrapInTemplate(body: string): string {
    return `
<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 0;
      background-color: #f4f4f4;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .email-header {
      background: linear-gradient(135deg, #1a5276, #2980b9);
      color: white;
      padding: 20px 30px;
      text-align: center;
    }
    .email-header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
    .email-header p {
      margin: 5px 0 0;
      font-size: 12px;
      opacity: 0.9;
    }
    .email-body {
      padding: 30px;
    }
    .email-body h2 {
      color: #1a5276;
      margin-top: 0;
    }
    .email-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .email-body th, .email-body td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    .email-body th {
      background-color: #f8f9fa;
      font-weight: 600;
    }
    .email-body ul {
      padding-left: 20px;
    }
    .email-body li {
      margin-bottom: 5px;
    }
    .email-footer {
      background-color: #f8f9fa;
      padding: 15px 30px;
      text-align: center;
      font-size: 12px;
      color: #777;
      border-top: 1px solid #eee;
    }
    hr {
      border: none;
      border-top: 1px solid #eee;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>EURL MANCHENGO</h1>
      <p>Smart ERP - Gestion Intelligente</p>
    </div>
    <div class="email-body">
      ${body}
    </div>
    <div class="email-footer">
      <p>Ce message a ete envoye automatiquement par Manchengo Smart ERP.</p>
      <p>EURL MANCHENGO - Ouled Chbel, Alger | contact@manchengo.dz</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}

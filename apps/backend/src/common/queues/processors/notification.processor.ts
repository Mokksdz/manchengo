/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NOTIFICATION PROCESSOR — Envoi asynchrone de notifications
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Traite les jobs d'envoi de notifications (email, push, SMS).
 * Utilise le EmailService (Nodemailer) pour l'envoi d'emails.
 *
 * TEMPLATES DISPONIBLES:
 * - alert-critical: Alerte critique APPRO
 * - report-ready: Rapport pret au telechargement
 * - stock-warning: Avertissement stock bas
 * - production-blocked: Production bloquee
 * - supplier-grade-change: Changement de grade fournisseur
 * - daily-recap: Recapitulatif quotidien
 *
 * @version 2.0.0 — Nodemailer integration
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueService, QueueName, NotificationJobData } from '../queue.service';
import { LoggerService } from '../../logger';
import { EmailService } from '../../email';

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  recipients?: number;
}

interface EmailTemplate {
  subject: string;
  body: string;
}

@Injectable()
export class NotificationProcessor implements OnModuleInit {
  private readonly emailTemplates: Map<string, (data: Record<string, unknown>) => EmailTemplate> = new Map();

  constructor(
    private readonly queueService: QueueService,
    private readonly logger: LoggerService,
    private readonly emailService: EmailService,
  ) {
    this.logger.setContext('NotificationProcessor');
    this.initializeTemplates();
  }

  onModuleInit() {
    this.queueService.registerProcessor(QueueName.NOTIFICATIONS, this.process.bind(this));
    this.logger.info('Notification processor registered', 'NotificationProcessor');
  }

  /**
   * Initialise les templates d'email
   */
  private initializeTemplates(): void {
    // Template: Alerte critique
    this.emailTemplates.set('alert-critical', (data) => ({
      subject: `ALERTE CRITIQUE: ${data.alertType || 'Systeme'}`,
      body: `
        <h2>Alerte Critique - Manchengo Smart ERP</h2>
        <p><strong>Type:</strong> ${data.alertType}</p>
        <p><strong>Message:</strong> ${data.message}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>
        <hr>
        <p>Connectez-vous au systeme pour gerer cette alerte.</p>
      `,
    }));

    // Template: Rapport pret
    this.emailTemplates.set('report-ready', (data) => ({
      subject: `Rapport "${data.reportType}" pret`,
      body: `
        <h2>Votre rapport est pret</h2>
        <p><strong>Type de rapport:</strong> ${data.reportType}</p>
        <p><strong>Fichier:</strong> ${data.fileName}</p>
        <p><strong>Genere le:</strong> ${new Date().toLocaleString('fr-FR')}</p>
        <hr>
        <p>Connectez-vous au systeme pour telecharger votre rapport.</p>
      `,
    }));

    // Template: Avertissement stock
    this.emailTemplates.set('stock-warning', (data) => ({
      subject: `Stock bas: ${data.productName}`,
      body: `
        <h2>Avertissement Stock</h2>
        <p><strong>Produit:</strong> ${data.productName} (${data.productCode})</p>
        <p><strong>Stock actuel:</strong> ${data.currentStock} ${data.unit}</p>
        <p><strong>Stock minimum:</strong> ${data.minStock} ${data.unit}</p>
        <hr>
        <p>Action recommandee: Planifier un approvisionnement.</p>
      `,
    }));

    // Template: Production bloquee
    this.emailTemplates.set('production-blocked', (data) => ({
      subject: `Production bloquee: ${data.recipeName}`,
      body: `
        <h2>Production Bloquee</h2>
        <p><strong>Recette:</strong> ${data.recipeName}</p>
        <p><strong>Raison:</strong> ${data.reason}</p>
        <p><strong>MP manquantes:</strong></p>
        <ul>
          ${(data.missingMp as Array<{ name: string; missing: number }>)?.map((mp) => `<li>${mp.name}: manque ${mp.missing}</li>`).join('') || '<li>Non specifie</li>'}
        </ul>
        <hr>
        <p>Action requise: Approvisionner les MP manquantes.</p>
      `,
    }));

    // Template: Changement grade fournisseur
    this.emailTemplates.set('supplier-grade-change', (data) => ({
      subject: `Changement de grade: ${data.supplierName}`,
      body: `
        <h2>Changement de Grade Fournisseur</h2>
        <p><strong>Fournisseur:</strong> ${data.supplierName} (${data.supplierCode})</p>
        <p><strong>Ancien grade:</strong> ${data.oldGrade}</p>
        <p><strong>Nouveau grade:</strong> ${data.newGrade}</p>
        <p><strong>Taux de retard:</strong> ${data.tauxRetard}%</p>
        <hr>
        <p>Veuillez evaluer vos relations avec ce fournisseur.</p>
      `,
    }));

    // Template: Recap quotidien
    this.emailTemplates.set('daily-recap', (data) => ({
      subject: `Recapitulatif du ${new Date().toLocaleDateString('fr-FR')}`,
      body: `
        <h2>Recapitulatif Journalier - Manchengo Smart ERP</h2>
        <h3>Alertes</h3>
        <ul>
          <li>Critiques: ${data.criticalAlerts}</li>
          <li>Warnings: ${data.warningAlerts}</li>
        </ul>
        <h3>Production</h3>
        <ul>
          <li>Ordres completes: ${data.completedOrders}</li>
          <li>Ordres en cours: ${data.activeOrders}</li>
        </ul>
        <h3>Stock</h3>
        <ul>
          <li>MP en rupture: ${data.mpRupture}</li>
          <li>MP en alerte: ${data.mpAlerte}</li>
        </ul>
      `,
    }));

    this.logger.info(`${this.emailTemplates.size} email templates initialized`, 'NotificationProcessor');
  }

  /**
   * Traite un job de notification
   */
  async process(job: Job<NotificationJobData>): Promise<NotificationResult> {
    const { type, to, template, data } = job.data;

    this.logger.info(`Processing notification job: ${template} (${type})`, 'NotificationProcessor', {
      jobId: job.id,
      template,
      type,
      recipientCount: Array.isArray(to) ? to.length : 1,
    });

    try {
      switch (type) {
        case 'email':
          return await this.sendEmail(to, template, data, job);
        case 'push':
          return await this.sendPush(to, template, data, job);
        case 'sms':
          return await this.sendSms(to, template, data, job);
        default:
          throw new Error(`Unknown notification type: ${type}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
        'NotificationProcessor',
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Envoie un email via EmailService (Nodemailer)
   */
  private async sendEmail(
    to: string | string[],
    template: string,
    data: Record<string, unknown>,
    job: Job,
  ): Promise<NotificationResult> {
    await job.updateProgress(20);

    // Recuperer le template
    const templateFn = this.emailTemplates.get(template);
    if (!templateFn) {
      throw new Error(`Email template "${template}" not found`);
    }

    const { subject, body } = templateFn(data);
    const recipients = Array.isArray(to) ? to : [to];

    await job.updateProgress(40);

    // Envoyer via EmailService (Nodemailer)
    const result = await this.emailService.sendEmail({
      to: recipients,
      subject,
      html: body,
    });

    await job.updateProgress(100);

    if (result.success) {
      this.logger.info(`Email sent to ${recipients.length} recipients`, 'NotificationProcessor', {
        messageId: result.messageId,
        template,
      });
    } else {
      this.logger.error(`Email failed: ${result.error}`, undefined, 'NotificationProcessor');
    }

    return {
      success: result.success,
      messageId: result.messageId,
      recipients: recipients.length,
      error: result.error,
    };
  }

  /**
   * Envoie une notification push
   */
  private async sendPush(
    to: string | string[],
    template: string,
    data: Record<string, unknown>,
    job: Job,
  ): Promise<NotificationResult> {
    await job.updateProgress(20);

    const recipients = Array.isArray(to) ? to : [to];

    // Construire le message push
    const pushMessage = this.buildPushMessage(template, data);

    await job.updateProgress(50);

    // TODO: Integrer avec Firebase Cloud Messaging ou autre
    await this.simulatePushSend(recipients, pushMessage);

    await job.updateProgress(100);

    return {
      success: true,
      messageId: `push-${Date.now()}`,
      recipients: recipients.length,
    };
  }

  /**
   * Construit un message push
   */
  private buildPushMessage(template: string, data: Record<string, unknown>): { title: string; body: string } {
    switch (template) {
      case 'alert-critical':
        return {
          title: 'Alerte Critique',
          body: String(data.message || 'Nouvelle alerte critique'),
        };
      case 'stock-warning':
        return {
          title: 'Stock Bas',
          body: `${data.productName}: ${data.currentStock} ${data.unit}`,
        };
      default:
        return {
          title: 'Manchengo ERP',
          body: String(data.message || 'Nouvelle notification'),
        };
    }
  }

  /**
   * Simule l'envoi de push
   */
  private async simulatePushSend(
    recipients: string[],
    message: { title: string; body: string },
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.logger.debug('Simulated push notification', 'NotificationProcessor', {
      recipients: recipients.length,
      title: message.title,
    });
  }

  /**
   * Envoie un SMS
   */
  private async sendSms(
    to: string | string[],
    template: string,
    data: Record<string, unknown>,
    job: Job,
  ): Promise<NotificationResult> {
    await job.updateProgress(20);

    const recipients = Array.isArray(to) ? to : [to];
    const smsText = this.buildSmsText(template, data);

    await job.updateProgress(50);

    // TODO: Integrer avec Twilio ou autre service SMS
    await this.simulateSmsSend(recipients, smsText);

    await job.updateProgress(100);

    return {
      success: true,
      messageId: `sms-${Date.now()}`,
      recipients: recipients.length,
    };
  }

  /**
   * Construit le texte SMS
   */
  private buildSmsText(template: string, data: Record<string, unknown>): string {
    switch (template) {
      case 'alert-critical':
        return `ALERTE CRITIQUE Manchengo: ${data.message}`;
      case 'stock-warning':
        return `Stock bas: ${data.productName} (${data.currentStock} ${data.unit})`;
      default:
        return `Manchengo ERP: ${data.message || 'Notification'}`;
    }
  }

  /**
   * Simule l'envoi SMS
   */
  private async simulateSmsSend(recipients: string[], text: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.logger.debug('Simulated SMS send', 'NotificationProcessor', {
      recipients: recipients.length,
      textLength: text.length,
    });
  }
}

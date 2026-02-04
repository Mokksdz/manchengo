import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EMAIL MODULE — Global Email Service
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Provides EmailService globally across the application.
 * Uses Nodemailer for SMTP email delivery.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

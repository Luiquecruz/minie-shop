import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  renderAlreadyRegisteredEmail,
  renderPasswordChangedEmail,
  renderResetPasswordEmail,
  renderVerifyEmail,
} from '@minieshop/email';
import { loadEnv } from '../../config/env.js';
import { DatabaseService } from '../../database/database.service.js';
import { customers } from '../../database/schema/identity.js';
import type { IdentityEmailKind, OutboxRecord } from '../platform/index.js';
import { EmailTokenService } from './email-token.service.js';
import { MAIL_TRANSPORT_TOKEN, type MailTransport } from './mail-transport.js';

@Injectable()
export class MailerOutboxHandler {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(EmailTokenService)
    private readonly emailTokenService: EmailTokenService,
    @Inject(MAIL_TRANSPORT_TOKEN)
    private readonly mailTransport: MailTransport,
  ) {}

  async handle(event: OutboxRecord): Promise<{ skipped: boolean; messageId?: string }> {
    const kind = event.payload.kind as IdentityEmailKind | undefined;
    const customerId =
      typeof event.payload.customerId === 'string' ? event.payload.customerId : event.aggregateId;
    const emailTokenId =
      typeof event.payload.emailTokenId === 'string' ? event.payload.emailTokenId : undefined;

    if (!kind || !customerId) {
      return { skipped: true };
    }

    // State-based: read current customer state from Postgres
    const [customer] = await this.databaseService.db
      .select({
        id: customers.id,
        email: customers.email,
        fullName: customers.fullName,
        emailVerifiedAt: customers.emailVerifiedAt,
        isActive: customers.isActive,
      })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (!customer || !customer.isActive) {
      return { skipped: true };
    }

    const storefrontBase = loadEnv().STOREFRONT_URL.replace(/\/+$/, '');

    if (kind === 'verify_email') {
      if (customer.emailVerifiedAt !== null || !emailTokenId) {
        return { skipped: true };
      }
      const activeToken = await this.emailTokenService.getActiveTokenForMailer(emailTokenId);
      if (!activeToken || activeToken.purpose !== 'verify_email' || activeToken.customerId !== customer.id) {
        return { skipped: true };
      }
      const verifyUrl = `${storefrontBase}/verify-email?token=${encodeURIComponent(activeToken.signedToken)}`;
      const rendered = await renderVerifyEmail({
        fullName: customer.fullName,
        verifyUrl,
        expiresHours: 24,
      });
      const result = await this.mailTransport.send({
        to: customer.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      return { skipped: false, messageId: result.messageId };
    }

    if (kind === 'reset_password') {
      if (!emailTokenId) {
        return { skipped: true };
      }
      const activeToken = await this.emailTokenService.getActiveTokenForMailer(emailTokenId);
      if (!activeToken || activeToken.purpose !== 'reset_password' || activeToken.customerId !== customer.id) {
        return { skipped: true };
      }
      const resetUrl = `${storefrontBase}/reset-password?token=${encodeURIComponent(activeToken.signedToken)}`;
      const rendered = await renderResetPasswordEmail({
        fullName: customer.fullName,
        resetUrl,
        expiresMinutes: 60,
      });
      const result = await this.mailTransport.send({
        to: customer.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      return { skipped: false, messageId: result.messageId };
    }

    if (kind === 'already_registered') {
      const rendered = await renderAlreadyRegisteredEmail({
        fullName: customer.fullName,
        loginUrl: `${storefrontBase}/login`,
        resetUrl: `${storefrontBase}/forgot-password`,
      });
      const result = await this.mailTransport.send({
        to: customer.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      return { skipped: false, messageId: result.messageId };
    }

    if (kind === 'password_changed') {
      const rendered = await renderPasswordChangedEmail({
        fullName: customer.fullName,
      });
      const result = await this.mailTransport.send({
        to: customer.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      return { skipped: false, messageId: result.messageId };
    }

    return { skipped: true };
  }
}

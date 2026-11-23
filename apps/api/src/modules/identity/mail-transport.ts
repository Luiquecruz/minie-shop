import { randomUUID } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.js';

export const MAIL_TRANSPORT_TOKEN = Symbol('MAIL_TRANSPORT_TOKEN');

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SentMailRecord extends MailMessage {
  from: string;
  messageId: string;
  sentAt: Date;
}

export interface MailTransport {
  send(message: MailMessage): Promise<{ messageId: string }>;
}

export class SmtpMailTransport implements MailTransport {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(options: {
    host: string;
    port: number;
    from: string;
    user?: string;
    pass?: string;
  }) {
    this.from = options.from;
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.port === 465,
      ...(options.user && options.pass
        ? { auth: { user: options.user, pass: options.pass } }
        : {}),
    });
  }

  async send(message: MailMessage): Promise<{ messageId: string }> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { messageId: info.messageId ?? randomUUID() };
  }
}

export class ResendMailTransport implements MailTransport {
  private readonly apiKey: string;
  private readonly from: string;
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: {
    apiKey: string;
    from: string;
    endpoint?: string;
    fetchFn?: typeof fetch;
  }) {
    this.apiKey = options.apiKey;
    this.from = options.from;
    this.endpoint = options.endpoint ?? 'https://api.resend.com/emails';
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async send(message: MailMessage): Promise<{ messageId: string }> {
    const response = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Resend API error (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const data = (await response.json()) as { id?: string };
    return { messageId: data.id ?? randomUUID() };
  }
}

export class InMemoryMailTransport implements MailTransport {
  private readonly sent: SentMailRecord[] = [];
  private readonly from: string;

  constructor(from = 'Progressive Minie Shop <no-reply@minieshop.local>') {
    this.from = from;
  }

  async send(message: MailMessage): Promise<{ messageId: string }> {
    const messageId = `mem-${randomUUID()}`;
    this.sent.push({
      ...message,
      from: this.from,
      messageId,
      sentAt: new Date(),
    });
    return { messageId };
  }

  getSent(): readonly SentMailRecord[] {
    return this.sent;
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export function createMailTransport(
  env: Pick<
    Env,
    'MAIL_TRANSPORT' | 'MAIL_FROM' | 'SMTP_HOST' | 'SMTP_PORT' | 'SMTP_USER' | 'SMTP_PASS' | 'RESEND_API_KEY'
  >,
): MailTransport {
  if (env.MAIL_TRANSPORT === 'memory') {
    return new InMemoryMailTransport(env.MAIL_FROM);
  }
  if (env.MAIL_TRANSPORT === 'resend') {
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is required when MAIL_TRANSPORT=resend');
    }
    return new ResendMailTransport({
      apiKey: env.RESEND_API_KEY,
      from: env.MAIL_FROM,
    });
  }
  return new SmtpMailTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    from: env.MAIL_FROM,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  });
}

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CLOCK_TOKEN, SystemClock } from '../../common/clock.js';
import { loadEnv } from '../../config/env.js';
import { CsrfService } from './csrf.service.js';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { EmailTokenService } from './email-token.service.js';
import { IdentityGuard } from './identity.guard.js';
import { createMailTransport, MAIL_TRANSPORT_TOKEN } from './mail-transport.js';
import { MailerOutboxHandler } from './mailer.handler.js';
import { PasswordService } from './password.service.js';
import { InMemoryRateLimiter, RATE_LIMITER_TOKEN } from './rate-limiter.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [CustomerAuthController],
  providers: [
    {
      provide: CLOCK_TOKEN,
      useClass: SystemClock,
    },
    {
      provide: RATE_LIMITER_TOKEN,
      useClass: InMemoryRateLimiter,
    },
    {
      provide: MAIL_TRANSPORT_TOKEN,
      useFactory: () => createMailTransport(loadEnv()),
    },
    PasswordService,
    SessionService,
    CsrfService,
    EmailTokenService,
    MailerOutboxHandler,
    CustomerAuthService,
    IdentityGuard,
    {
      provide: APP_GUARD,
      useExisting: IdentityGuard,
    },
  ],
  exports: [
    CLOCK_TOKEN,
    RATE_LIMITER_TOKEN,
    MAIL_TRANSPORT_TOKEN,
    PasswordService,
    SessionService,
    CsrfService,
    EmailTokenService,
    MailerOutboxHandler,
    CustomerAuthService,
    IdentityGuard,
  ],
})
export class IdentityModule {}

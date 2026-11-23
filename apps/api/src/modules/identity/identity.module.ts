import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CLOCK_TOKEN, SystemClock } from '../../common/clock.js';
import { loadEnv } from '../../config/env.js';
import { CatalogModule } from '../catalog/index.js';
import { CsrfService } from './csrf.service.js';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { CustomerProfileController } from './customer-profile.controller.js';
import { CustomerProfileService } from './customer-profile.service.js';
import { EmailTokenService } from './email-token.service.js';
import { IdentityGuard } from './identity.guard.js';
import { createMailTransport, MAIL_TRANSPORT_TOKEN } from './mail-transport.js';
import { MailerOutboxHandler } from './mailer.handler.js';
import { PasswordService } from './password.service.js';
import { InMemoryRateLimiter, RATE_LIMITER_TOKEN } from './rate-limiter.js';
import { RbacSeedService } from './rbac-seed.service.js';
import { SessionService } from './session.service.js';
import { StaffAdminController } from './staff-admin.controller.js';
import { StaffAdminService } from './staff-admin.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [CustomerAuthController, CustomerProfileController, StaffAdminController],
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
    CustomerProfileService,
    RbacSeedService,
    StaffAdminService,
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
    CustomerProfileService,
    RbacSeedService,
    StaffAdminService,
    IdentityGuard,
  ],
})
export class IdentityModule {}

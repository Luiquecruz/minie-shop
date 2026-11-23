import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CLOCK_TOKEN, SystemClock } from '../../common/clock.js';
import { CsrfService } from './csrf.service.js';
import { IdentityGuard } from './identity.guard.js';
import { PasswordService } from './password.service.js';
import { InMemoryRateLimiter, RATE_LIMITER_TOKEN } from './rate-limiter.js';
import { SessionService } from './session.service.js';

@Module({
  providers: [
    {
      provide: CLOCK_TOKEN,
      useClass: SystemClock,
    },
    {
      provide: RATE_LIMITER_TOKEN,
      useClass: InMemoryRateLimiter,
    },
    PasswordService,
    SessionService,
    CsrfService,
    IdentityGuard,
    {
      provide: APP_GUARD,
      useExisting: IdentityGuard,
    },
  ],
  exports: [
    CLOCK_TOKEN,
    RATE_LIMITER_TOKEN,
    PasswordService,
    SessionService,
    CsrfService,
    IdentityGuard,
  ],
})
export class IdentityModule {}

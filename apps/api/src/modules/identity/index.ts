export { IdentityModule } from './identity.module.js';
export { PasswordService, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from './password.service.js';
export { EmailTokenService, type EmailTokenPurpose } from './email-token.service.js';
export {
  MAIL_TRANSPORT_TOKEN,
  SmtpMailTransport,
  ResendMailTransport,
  InMemoryMailTransport,
  createMailTransport,
  type MailMessage,
  type SentMailRecord,
  type MailTransport,
} from './mail-transport.js';
export { MailerOutboxHandler } from './mailer.handler.js';
export { RbacSeedService } from './rbac-seed.service.js';
export { StaffAdminService } from './staff-admin.service.js';
export {
  CustomerAuthService,
  GENERIC_REGISTER_MESSAGE,
  normalizeEmail,
  toCustomerProfileDto,
} from './customer-auth.service.js';
export {
  SessionService,
  CUSTOMER_COOKIE_BASE,
  STAFF_COOKIE_BASE,
  getSessionCookieName,
  hashSessionToken,
  generateSessionToken,
  type CreateSessionInput,
  type CreatedSession,
} from './session.service.js';
export { CsrfService, CSRF_HEADER_NAME } from './csrf.service.js';
export {
  RATE_LIMITER_TOKEN,
  RATE_LIMIT_RULES,
  InMemoryRateLimiter,
  enforceRateLimit,
  type RateLimiter,
  type RateLimitRule,
  type RateLimitDecision,
} from './rate-limiter.js';
export { IdentityGuard } from './identity.guard.js';
export {
  RequireCustomer,
  RequirePermission,
  AllowAnyStaff,
  PublicAdminRoute,
  SkipCsrf,
  CurrentCustomer,
  CurrentStaff,
  REQUIRE_CUSTOMER_KEY,
  REQUIRE_PERMISSIONS_KEY,
  ALLOW_ANY_STAFF_KEY,
  PUBLIC_ADMIN_ROUTE_KEY,
  SKIP_CSRF_KEY,
} from './decorators.js';
export {
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  type SubjectType,
  type PermissionCode,
  type RoleDefinition,
  type CustomerPrincipal,
  type StaffPrincipal,
  type RequestPrincipal,
  type RequestWithIdentity,
} from './types.js';

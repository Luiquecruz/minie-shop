import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  csrfInvalidError,
  forbiddenError,
  unauthenticatedError,
} from '../../common/errors.js';
import { loadEnv } from '../../config/env.js';
import { CSRF_HEADER_NAME, CsrfService } from './csrf.service.js';
import {
  ALLOW_ANY_STAFF_KEY,
  PUBLIC_ADMIN_ROUTE_KEY,
  REQUIRE_CUSTOMER_KEY,
  REQUIRE_PERMISSIONS_KEY,
  SKIP_CSRF_KEY,
} from './decorators.js';
import { getSessionCookieName, SessionService } from './session.service.js';
import type { PermissionCode, RequestWithIdentity } from './types.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(SessionService)
    private readonly sessionService: SessionService,
    @Inject(CsrfService)
    private readonly csrfService: CsrfService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithIdentity>();
    const env = loadEnv();
    const urlPath = request.url.split('?')[0] ?? request.url;
    const isAdminRoute = urlPath === '/admin' || urlPath.startsWith('/admin/');

    // 1. Resolve principals from separate storefront / backoffice cookies
    const customerCookieName = getSessionCookieName('customer', env.COOKIE_SECURE);
    const staffCookieName = getSessionCookieName('staff', env.COOKIE_SECURE);

    const rawCustomerToken = request.cookies?.[customerCookieName];
    if (typeof rawCustomerToken === 'string' && rawCustomerToken.length > 0) {
      const customerPrincipal = await this.sessionService.resolveCustomerSession(rawCustomerToken);
      if (customerPrincipal) {
        request.customerPrincipal = customerPrincipal;
      }
    }

    const rawStaffToken = request.cookies?.[staffCookieName];
    if (typeof rawStaffToken === 'string' && rawStaffToken.length > 0) {
      const staffPrincipal = await this.sessionService.resolveStaffSession(rawStaffToken);
      if (staffPrincipal) {
        request.staffPrincipal = staffPrincipal;
      }
    }

    const targets = [context.getHandler(), context.getClass()];

    // 2. Enforce CSRF on state-changing HTTP methods
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, targets) === true;
    if (!skipCsrf && STATE_CHANGING_METHODS.has(request.method.toUpperCase())) {
      const originHeader =
        typeof request.headers.origin === 'string' ? request.headers.origin : undefined;

      if (!this.csrfService.isOriginAllowed(originHeader)) {
        throw csrfInvalidError();
      }

      const activeSessionId = isAdminRoute
        ? request.staffPrincipal?.sessionId
        : request.customerPrincipal?.sessionId;

      if (activeSessionId) {
        const rawCsrfHeader = request.headers[CSRF_HEADER_NAME];
        const candidateToken =
          typeof rawCsrfHeader === 'string' ? rawCsrfHeader.trim() : undefined;
        if (!this.csrfService.verifyToken(activeSessionId, candidateToken)) {
          throw csrfInvalidError();
        }
      }
    }

    // 3. Enforce customer authentication when required
    const requireCustomer =
      this.reflector.getAllAndOverride<boolean>(REQUIRE_CUSTOMER_KEY, targets) === true;
    if (requireCustomer && !request.customerPrincipal) {
      throw unauthenticatedError();
    }

    // 4. Enforce staff authentication & RBAC (deny-by-default under /admin/*)
    const publicAdmin =
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ADMIN_ROUTE_KEY, targets) === true;
    const allowAnyStaff =
      this.reflector.getAllAndOverride<boolean>(ALLOW_ANY_STAFF_KEY, targets) === true;
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionCode[] | undefined>(
      REQUIRE_PERMISSIONS_KEY,
      targets,
    );

    if (isAdminRoute && !publicAdmin) {
      if (!allowAnyStaff && (!requiredPermissions || requiredPermissions.length === 0)) {
        // Deny by default for any /admin/* route missing explicit authorization decorator
        throw forbiddenError();
      }
    }

    if (allowAnyStaff || (requiredPermissions && requiredPermissions.length > 0)) {
      if (!request.staffPrincipal) {
        throw unauthenticatedError();
      }
      if (requiredPermissions && requiredPermissions.length > 0) {
        const granted = new Set(request.staffPrincipal.permissions);
        const hasAll = requiredPermissions.every((perm) => granted.has(perm));
        if (!hasAll) {
          throw forbiddenError();
        }
      }
    }

    return true;
  }
}

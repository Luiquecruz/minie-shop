import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type {
  CustomerPrincipal,
  PermissionCode,
  RequestWithIdentity,
  StaffPrincipal,
} from './types.js';

export const REQUIRE_CUSTOMER_KEY = 'identity:require_customer';
export const REQUIRE_PERMISSIONS_KEY = 'identity:require_permissions';
export const ALLOW_ANY_STAFF_KEY = 'identity:allow_any_staff';
export const PUBLIC_ADMIN_ROUTE_KEY = 'identity:public_admin_route';
export const SKIP_CSRF_KEY = 'identity:skip_csrf';

export const RequireCustomer = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_CUSTOMER_KEY, true);

export const RequirePermission = (
  ...permissions: PermissionCode[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);

export const AllowAnyStaff = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_ANY_STAFF_KEY, true);

export const PublicAdminRoute = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PUBLIC_ADMIN_ROUTE_KEY, true);

export const SkipCsrf = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_CSRF_KEY, true);

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CustomerPrincipal | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithIdentity>();
    return request.customerPrincipal;
  },
);

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffPrincipal | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithIdentity>();
    return request.staffPrincipal;
  },
);

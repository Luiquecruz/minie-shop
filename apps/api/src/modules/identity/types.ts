import type { FastifyRequest } from 'fastify';

export type SubjectType = 'customer' | 'staff';

export const ALL_PERMISSIONS = [
  'catalog:read',
  'catalog:write',
  'media:write',
  'inventory:write',
  'customers:read',
  'orders:read',
  'staff:manage',
  'audit:read',
] as const;

export type PermissionCode = (typeof ALL_PERMISSIONS)[number];

export interface RoleDefinition {
  code: 'admin' | 'catalog_manager' | 'support';
  name: string;
  description: string;
  permissions: readonly PermissionCode[];
}

export const DEFAULT_ROLES: readonly RoleDefinition[] = [
  {
    code: 'admin',
    name: 'Administrator',
    description: 'Full administrative access across all modules',
    permissions: ALL_PERMISSIONS,
  },
  {
    code: 'catalog_manager',
    name: 'Catalog Manager',
    description: 'Manage catalog, media assets, and inventory',
    permissions: ['catalog:read', 'catalog:write', 'media:write', 'inventory:write'],
  },
  {
    code: 'support',
    name: 'Customer Support',
    description: 'Read-only access to customer accounts and orders',
    permissions: ['customers:read', 'orders:read'],
  },
] as const;

export interface CustomerPrincipal {
  type: 'customer';
  sessionId: string;
  customerId: string;
  email: string;
  fullName: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
}

export interface StaffPrincipal {
  type: 'staff';
  sessionId: string;
  staffUserId: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: PermissionCode[];
}

export type RequestPrincipal = CustomerPrincipal | StaffPrincipal;

export interface RequestWithIdentity extends FastifyRequest {
  customerPrincipal?: CustomerPrincipal;
  staffPrincipal?: StaffPrincipal;
}

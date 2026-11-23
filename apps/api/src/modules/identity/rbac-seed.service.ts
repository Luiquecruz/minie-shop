import { Inject, Injectable } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import { loadEnv, type Env } from '../../config/env.js';
import { DatabaseService } from '../../database/database.service.js';
import {
  permissions,
  rolePermissions,
  roles,
  staffUserRoles,
  staffUsers,
} from '../../database/schema/index.js';
import { normalizeEmail } from './customer-auth.service.js';
import { PasswordService } from './password.service.js';
import { ALL_PERMISSIONS, DEFAULT_ROLES } from './types.js';

const PERMISSION_LABELS: Record<(typeof ALL_PERMISSIONS)[number], string> = {
  'catalog:read': 'Read catalog items',
  'catalog:write': 'Create and update catalog items',
  'media:write': 'Upload and manage media assets',
  'inventory:write': 'Update inventory stock levels',
  'customers:read': 'List and view customer accounts',
  'orders:read': 'List and view customer orders',
  'staff:manage': 'Manage staff users and role assignments',
  'audit:read': 'Read staff audit logs',
};

@Injectable()
export class RbacSeedService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
  ) {}

  async seedRolesAndPermissions(): Promise<{
    permissionsCount: number;
    rolesCount: number;
  }> {
    const db = this.databaseService.db;

    const permissionIdByCode = new Map<string, string>();
    for (const code of ALL_PERMISSIONS) {
      const [row] = await db
        .insert(permissions)
        .values({
          code,
          name: PERMISSION_LABELS[code],
          description: PERMISSION_LABELS[code],
        })
        .onConflictDoUpdate({
          target: permissions.code,
          set: {
            name: PERMISSION_LABELS[code],
            description: PERMISSION_LABELS[code],
          },
        })
        .returning({ id: permissions.id, code: permissions.code });

      if (row) {
        permissionIdByCode.set(row.code, row.id);
      }
    }

    for (const roleDef of DEFAULT_ROLES) {
      const [roleRow] = await db
        .insert(roles)
        .values({
          code: roleDef.code,
          name: roleDef.name,
          description: roleDef.description,
        })
        .onConflictDoUpdate({
          target: roles.code,
          set: {
            name: roleDef.name,
            description: roleDef.description,
          },
        })
        .returning({ id: roles.id });

      if (!roleRow) {
        continue;
      }

      for (const permCode of roleDef.permissions) {
        const permId = permissionIdByCode.get(permCode);
        if (!permId) {
          continue;
        }
        await db
          .insert(rolePermissions)
          .values({ roleId: roleRow.id, permissionId: permId })
          .onConflictDoNothing();
      }
    }

    return {
      permissionsCount: ALL_PERMISSIONS.length,
      rolesCount: DEFAULT_ROLES.length,
    };
  }

  async seedInitialAdminIfEmpty(
    envOverride?: Pick<Env, 'ADMIN_EMAIL' | 'ADMIN_PASSWORD'>,
  ): Promise<{ created: boolean; email?: string }> {
    const db = this.databaseService.db;
    await this.seedRolesAndPermissions();

    const [existingCountRow] = await db.select({ total: count() }).from(staffUsers);
    if ((existingCountRow?.total ?? 0) > 0) {
      return { created: false };
    }

    const env = envOverride ?? loadEnv();
    const email = normalizeEmail(env.ADMIN_EMAIL);
    const normalizedPwd = this.passwordService.validatePolicy(env.ADMIN_PASSWORD, email);
    const passwordHash = await this.passwordService.hash(normalizedPwd);

    const [adminRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, 'admin'))
      .limit(1);

    if (!adminRole) {
      throw new Error('Admin role missing after RBAC seed');
    }

    await db.transaction(async (tx) => {
      const [createdAdmin] = await tx
        .insert(staffUsers)
        .values({
          email,
          passwordHash,
          fullName: 'Initial Administrator',
          isActive: true,
        })
        .onConflictDoNothing({ target: staffUsers.email })
        .returning({ id: staffUsers.id });

      if (createdAdmin) {
        await tx
          .insert(staffUserRoles)
          .values({
            staffUserId: createdAdmin.id,
            roleId: adminRole.id,
          })
          .onConflictDoNothing();
      }
    });

    return { created: true, email };
  }
}

import { Inject, Injectable, Optional } from '@nestjs/common';
import { asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import type {
  AdminCustomerListItemDTO,
  AdminCustomerListQuery,
  AdminCustomerListResponseDTO,
  AdminStaffListItemDTO,
  StaffProfileDTO,
  StaffRoleCode,
} from '@minieshop/contracts';
import {
  conflictError,
  invalidCredentialsError,
  notFoundError,
  unauthenticatedError,
  validationError,
} from '../../common/errors.js';
import { DatabaseService } from '../../database/database.service.js';
import {
  customers,
  permissions,
  rolePermissions,
  roles,
  staffUserRoles,
  staffUsers,
} from '../../database/schema/index.js';
import { AuditService, type AuditContext } from '../platform/index.js';
import { normalizeEmail } from './customer-auth.service.js';
import { PasswordService } from './password.service.js';
import {
  enforceRateLimit,
  RATE_LIMIT_RULES,
  RATE_LIMITER_TOKEN,
  type RateLimiter,
} from './rate-limiter.js';
import { SessionService } from './session.service.js';

@Injectable()
export class StaffAdminService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(SessionService)
    private readonly sessionService: SessionService,
    @Inject(RATE_LIMITER_TOKEN)
    private readonly rateLimiter: RateLimiter,
    @Optional()
    @Inject(AuditService)
    private readonly auditService?: AuditService,
  ) {}

  async login(input: {
    email: string;
    password: string;
    ipAddress: string;
    userAgent: string | null;
    requestId?: string | null;
    existingRawToken?: string;
  }): Promise<{ staff: StaffProfileDTO; rawToken: string; sessionId: string }> {
    const email = normalizeEmail(input.email);
    const context: AuditContext = {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId ?? null,
    };

    await enforceRateLimit(this.rateLimiter, [
      { key: `staff-login:ip:${input.ipAddress}`, rule: RATE_LIMIT_RULES.STAFF_LOGIN_IP },
      { key: `staff-login:account:${email}`, rule: RATE_LIMIT_RULES.STAFF_LOGIN_ACCOUNT },
    ]);

    const [staff] = await this.databaseService.db
      .select()
      .from(staffUsers)
      .where(eq(staffUsers.email, email))
      .limit(1);

    if (!staff || !staff.isActive) {
      await this.passwordService.verifyDummy(input.password);
      if (this.auditService) {
        await this.auditService.recordStandalone({
          actorType: 'staff',
          actorId: staff?.id ?? null,
          action: 'staff.login_failed',
          entityType: 'staff_user',
          entityId: staff?.id ?? email,
          metadata: { email, reason: !staff ? 'unknown_account' : 'inactive_account' },
          context,
        });
      }
      throw invalidCredentialsError();
    }

    const passwordValid = await this.passwordService.verify(staff.passwordHash, input.password);
    if (!passwordValid) {
      if (this.auditService) {
        await this.auditService.recordStandalone({
          actorType: 'staff',
          actorId: staff.id,
          action: 'staff.login_failed',
          entityType: 'staff_user',
          entityId: staff.id,
          metadata: { email, reason: 'invalid_password' },
          context,
        });
      }
      throw invalidCredentialsError();
    }

    if (this.passwordService.needsRehash(staff.passwordHash)) {
      const upgradedHash = await this.passwordService.hash(input.password);
      await this.databaseService.db
        .update(staffUsers)
        .set({ passwordHash: upgradedHash, updatedAt: new Date() })
        .where(eq(staffUsers.id, staff.id));
    }

    const createdSession = await this.databaseService.db.transaction(async (tx) => {
      if (input.existingRawToken) {
        await this.sessionService.revokeSessionByRawToken(input.existingRawToken, 'staff', tx);
      }
      const sess = await this.sessionService.createSession({
        subjectType: 'staff',
        subjectId: staff.id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        tx,
      });
      if (this.auditService) {
        await this.auditService.record(tx, {
          actorType: 'staff',
          actorId: staff.id,
          action: 'staff.login_succeeded',
          entityType: 'staff_user',
          entityId: staff.id,
          metadata: { sessionId: sess.sessionId },
          context,
        });
      }
      return sess;
    });

    await this.rateLimiter.reset(`staff-login:account:${email}`);
    const profile = await this.getMe(staff.id);

    return {
      staff: profile,
      rawToken: createdSession.rawToken,
      sessionId: createdSession.sessionId,
    };
  }

  async logout(
    sessionId: string,
    actorStaffId?: string,
    context?: AuditContext,
  ): Promise<void> {
    await this.databaseService.db.transaction(async (tx) => {
      await this.sessionService.revokeSession(sessionId, tx);
      if (this.auditService && actorStaffId) {
        await this.auditService.record(tx, {
          actorType: 'staff',
          actorId: actorStaffId,
          action: 'staff.logout',
          entityType: 'session',
          entityId: sessionId,
          context,
        });
      }
    });
  }

  async logoutAll(staffUserId: string, context?: AuditContext): Promise<void> {
    await this.databaseService.db.transaction(async (tx) => {
      await this.sessionService.revokeAllStaffSessions(staffUserId, tx);
      if (this.auditService) {
        await this.auditService.record(tx, {
          actorType: 'staff',
          actorId: staffUserId,
          action: 'staff.logout_all',
          entityType: 'staff_user',
          entityId: staffUserId,
          context,
        });
      }
    });
  }

  async getMe(staffUserId: string): Promise<StaffProfileDTO> {
    const [staff] = await this.databaseService.db
      .select()
      .from(staffUsers)
      .where(eq(staffUsers.id, staffUserId))
      .limit(1);

    if (!staff || !staff.isActive) {
      throw unauthenticatedError();
    }

    const rolePermRows = await this.databaseService.db
      .select({
        roleCode: roles.code,
        permissionCode: permissions.code,
      })
      .from(staffUserRoles)
      .innerJoin(roles, eq(staffUserRoles.roleId, roles.id))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(staffUserRoles.staffUserId, staff.id));

    const roleSet = new Set<string>();
    const permSet = new Set<string>();
    for (const row of rolePermRows) {
      roleSet.add(row.roleCode);
      if (row.permissionCode) {
        permSet.add(row.permissionCode);
      }
    }

    return {
      id: staff.id,
      email: staff.email,
      fullName: staff.fullName,
      isActive: staff.isActive,
      roles: [...roleSet].sort(),
      permissions: [...permSet].sort(),
      createdAt: staff.createdAt.toISOString(),
    };
  }

  async listCustomers(
    query: AdminCustomerListQuery,
    audit?: { actorStaffId: string; context?: AuditContext },
  ): Promise<AdminCustomerListResponseDTO> {
    const whereClause =
      query.q && query.q.length > 0
        ? or(ilike(customers.email, `%${query.q}%`), ilike(customers.fullName, `%${query.q}%`))
        : undefined;

    const [totalRow] = await this.databaseService.db
      .select({ total: count() })
      .from(customers)
      .where(whereClause);

    // Principle of least privilege: select ONLY minimal columns (no phone, no addresses, no passwordHash)
    const rows = await this.databaseService.db
      .select({
        id: customers.id,
        email: customers.email,
        fullName: customers.fullName,
        emailVerifiedAt: customers.emailVerifiedAt,
        isActive: customers.isActive,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(whereClause)
      .orderBy(desc(customers.createdAt), asc(customers.id))
      .limit(query.limit)
      .offset(query.offset);

    if (this.auditService && audit) {
      // Record read audit without customer payload content
      await this.auditService.recordStandalone({
        actorType: 'staff',
        actorId: audit.actorStaffId,
        action: 'customers.listed',
        entityType: 'customer',
        entityId: 'list',
        metadata: {
          limit: query.limit,
          offset: query.offset,
          hasQuery: Boolean(query.q && query.q.length > 0),
          returnedCount: rows.length,
        },
        context: audit.context,
      });
    }

    const items: AdminCustomerListItemDTO[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      emailVerified: row.emailVerifiedAt !== null,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      items,
      total: totalRow?.total ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async listStaff(): Promise<AdminStaffListItemDTO[]> {
    const staffRows = await this.databaseService.db
      .select({
        id: staffUsers.id,
        email: staffUsers.email,
        fullName: staffUsers.fullName,
        isActive: staffUsers.isActive,
        createdAt: staffUsers.createdAt,
      })
      .from(staffUsers)
      .orderBy(asc(staffUsers.email));

    if (staffRows.length === 0) {
      return [];
    }

    const staffIds = staffRows.map((s) => s.id);
    const assignedRoles = await this.databaseService.db
      .select({
        staffUserId: staffUserRoles.staffUserId,
        roleCode: roles.code,
      })
      .from(staffUserRoles)
      .innerJoin(roles, eq(staffUserRoles.roleId, roles.id))
      .where(inArray(staffUserRoles.staffUserId, staffIds));

    const rolesByStaff = new Map<string, string[]>();
    for (const row of assignedRoles) {
      const list = rolesByStaff.get(row.staffUserId) ?? [];
      list.push(row.roleCode);
      rolesByStaff.set(row.staffUserId, list);
    }

    return staffRows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      isActive: row.isActive,
      roles: (rolesByStaff.get(row.id) ?? []).sort(),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async updateStaffRoles(input: {
    actorStaffId: string;
    targetStaffId: string;
    roleCodes: StaffRoleCode[];
    context?: AuditContext;
  }): Promise<{
    staff: AdminStaffListItemDTO;
    beforeRoles: string[];
    afterRoles: string[];
  }> {
    const uniqueRoleCodes = [...new Set(input.roleCodes)].sort() as StaffRoleCode[];

    return this.databaseService.db.transaction(async (tx) => {
      const [target] = await tx
        .select({
          id: staffUsers.id,
          email: staffUsers.email,
          fullName: staffUsers.fullName,
          isActive: staffUsers.isActive,
          createdAt: staffUsers.createdAt,
        })
        .from(staffUsers)
        .where(eq(staffUsers.id, input.targetStaffId))
        .limit(1);

      if (!target) {
        throw notFoundError('Staff user not found');
      }

      const roleRows = await tx
        .select({ id: roles.id, code: roles.code })
        .from(roles)
        .where(inArray(roles.code, uniqueRoleCodes));

      if (roleRows.length !== uniqueRoleCodes.length) {
        throw validationError([{ path: 'roles', message: 'One or more roles do not exist' }]);
      }

      const currentRoleRows = await tx
        .select({ roleCode: roles.code })
        .from(staffUserRoles)
        .innerJoin(roles, eq(staffUserRoles.roleId, roles.id))
        .where(eq(staffUserRoles.staffUserId, target.id));

      const beforeRoles = currentRoleRows.map((r) => r.roleCode).sort();
      const hadAdmin = beforeRoles.includes('admin');
      const willHaveAdmin = uniqueRoleCodes.includes('admin');

      if (hadAdmin && !willHaveAdmin) {
        // Count active staff users who currently have the 'admin' role
        const adminRows = await tx
          .select({ staffUserId: staffUserRoles.staffUserId })
          .from(staffUserRoles)
          .innerJoin(roles, eq(staffUserRoles.roleId, roles.id))
          .innerJoin(staffUsers, eq(staffUserRoles.staffUserId, staffUsers.id))
          .where(eq(roles.code, 'admin'));

        const activeAdminIds = new Set(adminRows.map((r) => r.staffUserId));
        if (activeAdminIds.size <= 1 && activeAdminIds.has(target.id)) {
          throw conflictError('Cannot remove the admin role from the last administrator');
        }
      }

      // Also guard against removing staff:manage from the sole holder (including self)
      const staffManageHolders = await tx
        .select({ staffUserId: staffUserRoles.staffUserId })
        .from(staffUserRoles)
        .innerJoin(rolePermissions, eq(rolePermissions.roleId, staffUserRoles.roleId))
        .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
        .where(eq(permissions.code, 'staff:manage'));

      const targetNewPerms = await tx
        .select({ code: permissions.code })
        .from(rolePermissions)
        .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
        .where(
          inArray(
            rolePermissions.roleId,
            roleRows.map((r) => r.id),
          ),
        );

      const willKeepStaffManage = targetNewPerms.some((p) => p.code === 'staff:manage');
      const holderIds = new Set(staffManageHolders.map((h) => h.staffUserId));
      if (holderIds.has(target.id) && holderIds.size <= 1 && !willKeepStaffManage) {
        throw conflictError('Cannot remove staff:manage from the only staff user who holds it');
      }

      await tx.delete(staffUserRoles).where(eq(staffUserRoles.staffUserId, target.id));
      await tx.insert(staffUserRoles).values(
        roleRows.map((r) => ({
          staffUserId: target.id,
          roleId: r.id,
        })),
      );

      if (this.auditService) {
        await this.auditService.record(tx, {
          actorType: 'staff',
          actorId: input.actorStaffId,
          action: 'staff.roles_updated',
          entityType: 'staff_user',
          entityId: target.id,
          before: { roles: beforeRoles },
          after: { roles: uniqueRoleCodes },
          context: input.context,
        });
      }

      const staffDto: AdminStaffListItemDTO = {
        id: target.id,
        email: target.email,
        fullName: target.fullName,
        isActive: target.isActive,
        roles: uniqueRoleCodes,
        createdAt: target.createdAt.toISOString(),
      };

      return {
        staff: staffDto,
        beforeRoles,
        afterRoles: uniqueRoleCodes,
      };
    });
  }

  async createStaffUser(input: {
    email: string;
    password: string;
    fullName: string;
    roleCodes: StaffRoleCode[];
    actorStaffId?: string | null;
    context?: AuditContext;
  }): Promise<AdminStaffListItemDTO> {
    const email = normalizeEmail(input.email);
    const normalizedPassword = this.passwordService.validatePolicy(input.password, email);
    const passwordHash = await this.passwordService.hash(normalizedPassword);
    const uniqueRoles = [...new Set(input.roleCodes)].sort() as StaffRoleCode[];

    return this.databaseService.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: staffUsers.id })
        .from(staffUsers)
        .where(eq(staffUsers.email, email))
        .limit(1);

      if (existing) {
        throw conflictError('A staff user with this email already exists');
      }

      const roleRows = await tx
        .select({ id: roles.id, code: roles.code })
        .from(roles)
        .where(inArray(roles.code, uniqueRoles));

      if (roleRows.length !== uniqueRoles.length) {
        throw validationError([{ path: 'roles', message: 'Invalid role code provided' }]);
      }

      const [created] = await tx
        .insert(staffUsers)
        .values({
          email,
          passwordHash,
          fullName: input.fullName.trim(),
          isActive: true,
        })
        .returning({
          id: staffUsers.id,
          email: staffUsers.email,
          fullName: staffUsers.fullName,
          isActive: staffUsers.isActive,
          createdAt: staffUsers.createdAt,
        });

      if (!created) {
        throw new Error('Failed to create staff user');
      }

      await tx.insert(staffUserRoles).values(
        roleRows.map((r) => ({
          staffUserId: created.id,
          roleId: r.id,
        })),
      );

      if (this.auditService) {
        await this.auditService.record(tx, {
          actorType: input.actorStaffId ? 'staff' : 'system',
          actorId: input.actorStaffId ?? null,
          action: 'staff.created',
          entityType: 'staff_user',
          entityId: created.id,
          before: null,
          after: {
            email: created.email,
            fullName: created.fullName,
            roles: uniqueRoles,
          },
          context: input.context,
        });
      }

      return {
        id: created.id,
        email: created.email,
        fullName: created.fullName,
        isActive: created.isActive,
        roles: uniqueRoles,
        createdAt: created.createdAt.toISOString(),
      };
    });
  }
}

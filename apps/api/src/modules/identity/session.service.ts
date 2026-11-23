import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, eq, isNull, lte, ne, or, sql } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';
import { CLOCK_TOKEN, SystemClock, type Clock } from '../../common/clock.js';
import { loadEnv, type Env } from '../../config/env.js';
import { DatabaseService } from '../../database/database.service.js';
import {
  customers,
  permissions,
  rolePermissions,
  roles,
  sessions,
  staffUserRoles,
  staffUsers,
} from '../../database/schema/index.js';
import type { DbOrTx } from '../platform/index.js';
import type { CustomerPrincipal, PermissionCode, StaffPrincipal, SubjectType } from './types.js';

const SESSION_CLEANUP_LOCK_KEY = 842_910_371;

export const CUSTOMER_COOKIE_BASE = 'sid_customer';
export const STAFF_COOKIE_BASE = 'sid_staff';

export function getSessionCookieName(subjectType: SubjectType, cookieSecure: boolean): string {
  const base = subjectType === 'customer' ? CUSTOMER_COOKIE_BASE : STAFF_COOKIE_BASE;
  return cookieSecure ? `__Host-${base}` : base;
}

export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface CreateSessionInput {
  subjectType: SubjectType;
  subjectId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: DbOrTx;
}

export interface CreatedSession {
  sessionId: string;
  rawToken: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

@Injectable()
export class SessionService {
  private readonly clock: Clock;

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Optional()
    @Inject(CLOCK_TOKEN)
    clock?: Clock,
  ) {
    this.clock = clock ?? new SystemClock();
  }

  private getTtls(
    subjectType: SubjectType,
    env: Pick<
      Env,
      | 'CUSTOMER_SESSION_IDLE_TTL_SECONDS'
      | 'CUSTOMER_SESSION_ABSOLUTE_TTL_SECONDS'
      | 'STAFF_SESSION_IDLE_TTL_SECONDS'
      | 'STAFF_SESSION_ABSOLUTE_TTL_SECONDS'
    > = loadEnv(),
  ): { idleMs: number; absoluteMs: number } {
    if (subjectType === 'staff') {
      return {
        idleMs: env.STAFF_SESSION_IDLE_TTL_SECONDS * 1000,
        absoluteMs: env.STAFF_SESSION_ABSOLUTE_TTL_SECONDS * 1000,
      };
    }
    return {
      idleMs: env.CUSTOMER_SESSION_IDLE_TTL_SECONDS * 1000,
      absoluteMs: env.CUSTOMER_SESSION_ABSOLUTE_TTL_SECONDS * 1000,
    };
  }

  async createSession(input: CreateSessionInput): Promise<CreatedSession> {
    const now = this.clock.now();
    const { idleMs, absoluteMs } = this.getTtls(input.subjectType);
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const absoluteExpiresAt = new Date(now.getTime() + absoluteMs);
    const expiresAt = new Date(Math.min(now.getTime() + idleMs, absoluteExpiresAt.getTime()));

    const executor = input.tx ?? this.databaseService.db;

    const [created] = await executor
      .insert(sessions)
      .values({
        tokenHash,
        subjectType: input.subjectType,
        customerId: input.subjectType === 'customer' ? input.subjectId : null,
        staffUserId: input.subjectType === 'staff' ? input.subjectId : null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        lastSeenAt: now,
        expiresAt,
        absoluteExpiresAt,
      })
      .returning({
        id: sessions.id,
        expiresAt: sessions.expiresAt,
        absoluteExpiresAt: sessions.absoluteExpiresAt,
      });

    if (!created) {
      throw new Error('Failed to persist session');
    }

    return {
      sessionId: created.id,
      rawToken,
      expiresAt: created.expiresAt,
      absoluteExpiresAt: created.absoluteExpiresAt,
    };
  }

  async resolveCustomerSession(rawToken: string): Promise<CustomerPrincipal | null> {
    if (!rawToken || rawToken.length === 0) {
      return null;
    }

    const tokenHash = hashSessionToken(rawToken);
    const now = this.clock.now();

    const [row] = await this.databaseService.db
      .select({
        sessionId: sessions.id,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
        absoluteExpiresAt: sessions.absoluteExpiresAt,
        revokedAt: sessions.revokedAt,
        customerId: customers.id,
        email: customers.email,
        fullName: customers.fullName,
        phone: customers.phone,
        emailVerifiedAt: customers.emailVerifiedAt,
        isActive: customers.isActive,
      })
      .from(sessions)
      .innerJoin(customers, eq(sessions.customerId, customers.id))
      .where(and(eq(sessions.tokenHash, tokenHash), eq(sessions.subjectType, 'customer')))
      .limit(1);

    if (!row || !row.isActive || row.revokedAt !== null) {
      return null;
    }

    if (now.getTime() >= row.expiresAt.getTime() || now.getTime() >= row.absoluteExpiresAt.getTime()) {
      return null;
    }

    await this.maybeSlideSession(row.sessionId, 'customer', row.lastSeenAt, row.absoluteExpiresAt, now);

    return {
      type: 'customer',
      sessionId: row.sessionId,
      customerId: row.customerId,
      email: row.email,
      fullName: row.fullName,
      phone: row.phone,
      emailVerifiedAt: row.emailVerifiedAt,
    };
  }

  async resolveStaffSession(rawToken: string): Promise<StaffPrincipal | null> {
    if (!rawToken || rawToken.length === 0) {
      return null;
    }

    const tokenHash = hashSessionToken(rawToken);
    const now = this.clock.now();

    const [row] = await this.databaseService.db
      .select({
        sessionId: sessions.id,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
        absoluteExpiresAt: sessions.absoluteExpiresAt,
        revokedAt: sessions.revokedAt,
        staffUserId: staffUsers.id,
        email: staffUsers.email,
        fullName: staffUsers.fullName,
        isActive: staffUsers.isActive,
      })
      .from(sessions)
      .innerJoin(staffUsers, eq(sessions.staffUserId, staffUsers.id))
      .where(and(eq(sessions.tokenHash, tokenHash), eq(sessions.subjectType, 'staff')))
      .limit(1);

    if (!row || !row.isActive || row.revokedAt !== null) {
      return null;
    }

    if (now.getTime() >= row.expiresAt.getTime() || now.getTime() >= row.absoluteExpiresAt.getTime()) {
      return null;
    }

    await this.maybeSlideSession(row.sessionId, 'staff', row.lastSeenAt, row.absoluteExpiresAt, now);

    const roleRows = await this.databaseService.db
      .select({
        roleCode: roles.code,
        permissionCode: permissions.code,
      })
      .from(staffUserRoles)
      .innerJoin(roles, eq(staffUserRoles.roleId, roles.id))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(staffUserRoles.staffUserId, row.staffUserId));

    const roleSet = new Set<string>();
    const permSet = new Set<PermissionCode>();
    for (const entry of roleRows) {
      roleSet.add(entry.roleCode);
      if (entry.permissionCode) {
        permSet.add(entry.permissionCode as PermissionCode);
      }
    }

    return {
      type: 'staff',
      sessionId: row.sessionId,
      staffUserId: row.staffUserId,
      email: row.email,
      fullName: row.fullName,
      roles: [...roleSet].sort(),
      permissions: [...permSet].sort() as PermissionCode[],
    };
  }

  private async maybeSlideSession(
    sessionId: string,
    subjectType: SubjectType,
    lastSeenAt: Date,
    absoluteExpiresAt: Date,
    now: Date,
  ): Promise<void> {
    const env = loadEnv();
    const thresholdMs = env.SESSION_TOUCH_THRESHOLD_SECONDS * 1000;
    if (now.getTime() - lastSeenAt.getTime() < thresholdMs) {
      return;
    }
    const { idleMs } = this.getTtls(subjectType, env);
    const nextIdleExpiresAt = new Date(Math.min(now.getTime() + idleMs, absoluteExpiresAt.getTime()));

    await this.databaseService.db
      .update(sessions)
      .set({
        lastSeenAt: now,
        expiresAt: nextIdleExpiresAt,
      })
      .where(eq(sessions.id, sessionId));
  }

  async revokeSession(sessionId: string, tx?: DbOrTx): Promise<void> {
    const executor = tx ?? this.databaseService.db;
    const now = this.clock.now();
    await executor
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
  }

  async revokeSessionByRawToken(rawToken: string, subjectType: SubjectType, tx?: DbOrTx): Promise<void> {
    const executor = tx ?? this.databaseService.db;
    const tokenHash = hashSessionToken(rawToken);
    const now = this.clock.now();
    await executor
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          eq(sessions.subjectType, subjectType),
          isNull(sessions.revokedAt),
        ),
      );
  }

  async revokeAllCustomerSessions(customerId: string, tx?: DbOrTx): Promise<void> {
    const executor = tx ?? this.databaseService.db;
    const now = this.clock.now();
    await executor
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.customerId, customerId), isNull(sessions.revokedAt)));
  }

  async revokeOtherCustomerSessions(
    customerId: string,
    keepSessionId: string,
    tx?: DbOrTx,
  ): Promise<void> {
    const executor = tx ?? this.databaseService.db;
    const now = this.clock.now();
    await executor
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.customerId, customerId),
          ne(sessions.id, keepSessionId),
          isNull(sessions.revokedAt),
        ),
      );
  }

  async revokeAllStaffSessions(staffUserId: string, tx?: DbOrTx): Promise<void> {
    const executor = tx ?? this.databaseService.db;
    const now = this.clock.now();
    await executor
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.staffUserId, staffUserId), isNull(sessions.revokedAt)));
  }

  async revokeOtherStaffSessions(
    staffUserId: string,
    keepSessionId: string,
    tx?: DbOrTx,
  ): Promise<void> {
    const executor = tx ?? this.databaseService.db;
    const now = this.clock.now();
    await executor
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.staffUserId, staffUserId),
          ne(sessions.id, keepSessionId),
          isNull(sessions.revokedAt),
        ),
      );
  }

  async cleanupExpiredSessions(): Promise<{ skipped: boolean; deleted: number }> {
    const now = this.clock.now();
    return this.databaseService.db.transaction(async (tx) => {
      const lockResult = await tx.execute<{ locked: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(${SESSION_CLEANUP_LOCK_KEY}) AS locked`,
      );
      const locked = lockResult.rows[0]?.locked === true;
      if (!locked) {
        return { skipped: true, deleted: 0 };
      }

      const deletedRows = await tx
        .delete(sessions)
        .where(
          or(
            lte(sessions.expiresAt, now),
            lte(sessions.absoluteExpiresAt, now),
            sql`${sessions.revokedAt} IS NOT NULL`,
          ),
        )
        .returning({ id: sessions.id });

      return { skipped: false, deleted: deletedRows.length };
    });
  }

  setSessionCookie(
    reply: FastifyReply,
    subjectType: SubjectType,
    rawToken: string,
    envOverride?: Pick<
      Env,
      'COOKIE_SECURE' | 'CUSTOMER_SESSION_ABSOLUTE_TTL_SECONDS' | 'STAFF_SESSION_ABSOLUTE_TTL_SECONDS'
    >,
  ): void {
    const env = envOverride ?? loadEnv();
    const cookieName = getSessionCookieName(subjectType, env.COOKIE_SECURE);
    const maxAge =
      subjectType === 'staff'
        ? env.STAFF_SESSION_ABSOLUTE_TTL_SECONDS
        : env.CUSTOMER_SESSION_ABSOLUTE_TTL_SECONDS;

    void reply.setCookie(cookieName, rawToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      path: '/',
      maxAge,
    });
  }

  clearSessionCookie(
    reply: FastifyReply,
    subjectType: SubjectType,
    envOverride?: Pick<Env, 'COOKIE_SECURE'>,
  ): void {
    const env = envOverride ?? loadEnv();
    const cookieName = getSessionCookieName(subjectType, env.COOKIE_SECURE);
    void reply.clearCookie(cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      path: '/',
    });
  }
}

import {
  pgSchema,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  primaryKey,
  check,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const identitySchema = pgSchema('identity');

export const customers = identitySchema.table('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customerAddresses = identitySchema.table(
  'customer_addresses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    recipientName: text('recipient_name').notNull(),
    street: text('street').notNull(),
    number: text('number').notNull(),
    complement: text('complement'),
    neighborhood: text('neighborhood').notNull(),
    city: text('city').notNull(),
    state: varchar('state', { length: 2 }).notNull(),
    postalCode: varchar('postal_code', { length: 20 }).notNull(),
    country: varchar('country', { length: 2 }).notNull().default('BR'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('customer_addresses_customer_idx').on(table.customerId)],
);

export const staffUsers = identitySchema.table('staff_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roles = identitySchema.table('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = identitySchema.table('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = identitySchema.table(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const staffUserRoles = identitySchema.table(
  'staff_user_roles',
  {
    staffUserId: uuid('staff_user_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.staffUserId, table.roleId] })],
);

export const sessions = identitySchema.table(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    subjectType: text('subject_type').notNull(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
    staffUserId: uuid('staff_user_id').references(() => staffUsers.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'sessions_subject_consistent',
      sql`(${table.subjectType} = 'customer' AND ${table.customerId} IS NOT NULL AND ${table.staffUserId} IS NULL) OR (${table.subjectType} = 'staff' AND ${table.staffUserId} IS NOT NULL AND ${table.customerId} IS NULL)`,
    ),
    index('sessions_expires_idx').on(table.expiresAt),
  ],
);

export const emailTokens = identitySchema.table(
  'email_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    purpose: text('purpose').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'email_tokens_purpose_valid',
      sql`${table.purpose} IN ('verify_email', 'reset_password')`,
    ),
    index('email_tokens_customer_idx').on(table.customerId),
  ],
);

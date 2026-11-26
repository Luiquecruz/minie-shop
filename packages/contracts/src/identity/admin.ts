import { z } from 'zod';

export const staffRoleCodeSchema = z.enum(['admin', 'catalog_manager', 'support']);
export type StaffRoleCode = z.infer<typeof staffRoleCodeSchema>;

export const staffLoginRequestSchema = z
  .object({
    email: z.string().trim().email('Invalid email address').max(254),
    password: z.string().min(1, 'Password is required').max(256),
  })
  .strict();

export type StaffLoginRequest = z.infer<typeof staffLoginRequestSchema>;

export const staffProfileDtoSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string().min(1),
    isActive: z.boolean(),
    roles: z.array(z.string()),
    permissions: z.array(z.string()),
    createdAt: z.string().datetime(),
  })
  .strict();

export type StaffProfileDTO = z.infer<typeof staffProfileDtoSchema>;

export const adminMeResponseSchema = z
  .object({
    staff: staffProfileDtoSchema,
  })
  .strict();

export type AdminMeResponseDTO = z.infer<typeof adminMeResponseSchema>;

export const adminCustomerListItemSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string().min(1),
    emailVerified: z.boolean(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type AdminCustomerListItemDTO = z.infer<typeof adminCustomerListItemSchema>;

export const adminCustomerListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    q: z.string().trim().max(120).optional(),
  })
  .strict();

export type AdminCustomerListQuery = z.infer<typeof adminCustomerListQuerySchema>;

export const adminCustomerListResponseSchema = z
  .object({
    items: z.array(adminCustomerListItemSchema),
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
  })
  .strict();

export type AdminCustomerListResponseDTO = z.infer<typeof adminCustomerListResponseSchema>;

export const adminStaffListItemSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string().min(1),
    isActive: z.boolean(),
    roles: z.array(z.string()),
    createdAt: z.string().datetime(),
  })
  .strict();

export type AdminStaffListItemDTO = z.infer<typeof adminStaffListItemSchema>;

export const adminStaffListResponseSchema = z
  .object({
    items: z.array(adminStaffListItemSchema),
  })
  .strict();

export type AdminStaffListResponseDTO = z.infer<typeof adminStaffListResponseSchema>;

export const updateStaffRolesRequestSchema = z
  .object({
    roles: z.array(staffRoleCodeSchema).min(1, 'At least one role is required'),
  })
  .strict();

export type UpdateStaffRolesRequest = z.infer<typeof updateStaffRolesRequestSchema>;

export const updateStaffRolesResponseSchema = z
  .object({
    staff: adminStaffListItemSchema,
  })
  .strict();

export type UpdateStaffRolesResponseDTO = z.infer<typeof updateStaffRolesResponseSchema>;

export const auditActorTypeSchema = z.enum(['system', 'customer', 'staff']);
export type AuditActorTypeDTO = z.infer<typeof auditActorTypeSchema>;

export const auditLogEntryDtoSchema = z
  .object({
    id: z.string().uuid(),
    actorType: auditActorTypeSchema,
    actorId: z.string().uuid().nullable(),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    before: z.record(z.string(), z.unknown()).nullable(),
    after: z.record(z.string(), z.unknown()).nullable(),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    requestId: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),
    createdAt: z.string().datetime(),
  })
  .strict();

export type AuditLogEntryDTO = z.infer<typeof auditLogEntryDtoSchema>;

export const auditLogQuerySchema = z
  .object({
    actorType: auditActorTypeSchema.optional(),
    actorId: z.string().uuid().optional(),
    action: z.string().trim().min(1).max(120).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().min(1).max(512).optional(),
  })
  .strict();

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const auditLogResponseSchema = z
  .object({
    items: z.array(auditLogEntryDtoSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();

export type AuditLogResponseDTO = z.infer<typeof auditLogResponseSchema>;

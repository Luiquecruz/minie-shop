import { z } from 'zod';

export const customerProfileDtoSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string().min(1),
    phone: z.string().nullable(),
    emailVerified: z.boolean(),
    emailVerifiedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type CustomerProfileDTO = z.infer<typeof customerProfileDtoSchema>;

export const registerRequestSchema = z
  .object({
    email: z.string().trim().email('Invalid email address').max(254),
    password: z.string().min(1, 'Password is required').max(256),
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  })
  .strict();

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const genericAcceptedResponseSchema = z
  .object({
    accepted: z.literal(true),
    message: z.string(),
  })
  .strict();

export type GenericAcceptedResponseDTO = z.infer<typeof genericAcceptedResponseSchema>;

export const loginRequestSchema = z
  .object({
    email: z.string().trim().email('Invalid email address').max(254),
    password: z.string().min(1, 'Password is required').max(256),
  })
  .strict();

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authCustomerResponseSchema = z
  .object({
    customer: customerProfileDtoSchema,
  })
  .strict();

export type AuthCustomerResponseDTO = z.infer<typeof authCustomerResponseSchema>;

export const csrfTokenResponseSchema = z
  .object({
    csrfToken: z.string().min(1),
  })
  .strict();

export type CsrfTokenResponseDTO = z.infer<typeof csrfTokenResponseSchema>;

export const verifyEmailRequestSchema = z
  .object({
    token: z.string().min(1, 'Verification token is required').max(512),
  })
  .strict();

export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const verifyEmailResponseSchema = z
  .object({
    verified: z.literal(true),
  })
  .strict();

export type VerifyEmailResponseDTO = z.infer<typeof verifyEmailResponseSchema>;

export const resendVerificationRequestSchema = z
  .object({
    email: z.string().trim().email('Invalid email address').max(254),
  })
  .strict();

export type ResendVerificationRequest = z.infer<typeof resendVerificationRequestSchema>;

export const forgotPasswordRequestSchema = z
  .object({
    email: z.string().trim().email('Invalid email address').max(254),
  })
  .strict();

export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required').max(512),
    newPassword: z.string().min(1, 'New password is required').max(256),
  })
  .strict();

export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const resetPasswordResponseSchema = z
  .object({
    reset: z.literal(true),
  })
  .strict();

export type ResetPasswordResponseDTO = z.infer<typeof resetPasswordResponseSchema>;

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(256),
    newPassword: z.string().min(1, 'New password is required').max(256),
  })
  .strict();

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const changePasswordResponseSchema = z
  .object({
    changed: z.literal(true),
  })
  .strict();

export type ChangePasswordResponseDTO = z.infer<typeof changePasswordResponseSchema>;

export const BRAZIL_UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

export const brazilUfSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
  z.enum(BRAZIL_UFS),
);

export type BrazilUF = z.infer<typeof brazilUfSchema>;

export const brazilPostalCodeSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/\D/g, ''))
  .refine((digits) => /^\d{8}$/.test(digits), {
    message: 'CEP must contain exactly 8 digits',
  });

export const brazilPhoneSchema = z
  .string()
  .trim()
  .transform((val) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) {
      return `+55${digits}`;
    }
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
      return `+${digits}`;
    }
    return digits;
  })
  .refine((normalized) => /^\+55\d{10,11}$/.test(normalized), {
    message: 'Phone must be a valid Brazilian phone number (10 or 11 digits with DDD)',
  });

export const updateMeRequestSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120).optional(),
    phone: brazilPhoneSchema.nullable().optional(),
  })
  .strict()
  .refine((val) => val.fullName !== undefined || val.phone !== undefined, {
    message: 'At least one field (fullName or phone) must be provided',
  });

export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;

export const customerAddressDtoSchema = z
  .object({
    id: z.string().uuid(),
    label: z.string().nullable(),
    recipientName: z.string().min(1),
    phone: z.string().nullable(),
    postalCode: z.string().regex(/^\d{8}$/),
    street: z.string().min(1),
    number: z.string().min(1),
    complement: z.string().nullable(),
    neighborhood: z.string().min(1),
    city: z.string().min(1),
    state: z.enum(BRAZIL_UFS),
    country: z.literal('BR'),
    isDefault: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type CustomerAddressDTO = z.infer<typeof customerAddressDtoSchema>;

export const createAddressRequestSchema = z
  .object({
    label: z.string().trim().min(1).max(60).nullable().optional(),
    recipientName: z.string().trim().min(2, 'Recipient name is required').max(120),
    phone: brazilPhoneSchema,
    postalCode: brazilPostalCodeSchema,
    street: z.string().trim().min(2, 'Street is required').max(160),
    number: z.string().trim().min(1, 'Number is required').max(30),
    complement: z.string().trim().max(120).nullable().optional(),
    neighborhood: z.string().trim().min(2, 'Neighborhood is required').max(120),
    city: z.string().trim().min(2, 'City is required').max(120),
    state: brazilUfSchema,
    country: z.literal('BR').default('BR'),
    isDefault: z.boolean().optional(),
  })
  .strict();

export type CreateAddressRequest = z.infer<typeof createAddressRequestSchema>;

export const updateAddressRequestSchema = z
  .object({
    label: z.string().trim().min(1).max(60).nullable().optional(),
    recipientName: z.string().trim().min(2).max(120).optional(),
    phone: brazilPhoneSchema.optional(),
    postalCode: brazilPostalCodeSchema.optional(),
    street: z.string().trim().min(2).max(160).optional(),
    number: z.string().trim().min(1).max(30).optional(),
    complement: z.string().trim().max(120).nullable().optional(),
    neighborhood: z.string().trim().min(2).max(120).optional(),
    city: z.string().trim().min(2).max(120).optional(),
    state: brazilUfSchema.optional(),
    country: z.literal('BR').optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();

export type UpdateAddressRequest = z.infer<typeof updateAddressRequestSchema>;

export const addressResponseSchema = z
  .object({
    address: customerAddressDtoSchema,
  })
  .strict();

export type AddressResponseDTO = z.infer<typeof addressResponseSchema>;

export const addressListResponseSchema = z
  .object({
    items: z.array(customerAddressDtoSchema),
  })
  .strict();

export type AddressListResponseDTO = z.infer<typeof addressListResponseSchema>;

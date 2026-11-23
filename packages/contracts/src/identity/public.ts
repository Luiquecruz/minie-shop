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

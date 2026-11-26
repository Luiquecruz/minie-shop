import { z } from 'zod';
import {
  BRAZIL_UFS,
  type AddressListResponseDTO,
  type AddressResponseDTO,
  type AuthCustomerResponseDTO,
  type ChangePasswordResponseDTO,
  type CsrfTokenResponseDTO,
  type CustomerAddressDTO,
  type CustomerProfileDTO,
  type GenericAcceptedResponseDTO,
  type ResetPasswordResponseDTO,
  type VerifyEmailResponseDTO,
} from './public.js';

/**
 * Tolerant client-side identity schemas (.strip()) sharing exact DTO types from
 * server-side .strict() contracts so additive API fields never break the UI.
 */

export const clientCustomerProfileDtoSchema: z.ZodType<CustomerProfileDTO> = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string().min(1),
    phone: z.string().nullable(),
    emailVerified: z.boolean(),
    emailVerifiedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strip();

export const clientGenericAcceptedResponseSchema: z.ZodType<GenericAcceptedResponseDTO> = z
  .object({
    accepted: z.literal(true),
    message: z.string(),
  })
  .strip();

export const clientAuthCustomerResponseSchema: z.ZodType<AuthCustomerResponseDTO> = z
  .object({
    customer: clientCustomerProfileDtoSchema,
  })
  .strip();

export const clientCsrfTokenResponseSchema: z.ZodType<CsrfTokenResponseDTO> = z
  .object({
    csrfToken: z.string().min(1),
  })
  .strip();

export const clientVerifyEmailResponseSchema: z.ZodType<VerifyEmailResponseDTO> = z
  .object({
    verified: z.literal(true),
  })
  .strip();

export const clientResetPasswordResponseSchema: z.ZodType<ResetPasswordResponseDTO> = z
  .object({
    reset: z.literal(true),
  })
  .strip();

export const clientChangePasswordResponseSchema: z.ZodType<ChangePasswordResponseDTO> = z
  .object({
    changed: z.literal(true),
  })
  .strip();

export const clientCustomerAddressDtoSchema: z.ZodType<CustomerAddressDTO> = z
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
  .strip();

export const clientAddressResponseSchema: z.ZodType<AddressResponseDTO> = z
  .object({
    address: clientCustomerAddressDtoSchema,
  })
  .strip();

export const clientAddressListResponseSchema: z.ZodType<AddressListResponseDTO> = z
  .object({
    items: z.array(clientCustomerAddressDtoSchema),
  })
  .strip();

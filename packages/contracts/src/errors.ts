import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'INTERNAL_ERROR',
  'RATE_LIMITED',
  'CHAOS_FAILURE',
  'BAD_REQUEST',
  'CONFLICT',
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'CSRF_INVALID',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorDetailSchema = z
  .object({
    path: z.string(),
    message: z.string(),
  })
  .strict();

export type ErrorDetail = z.infer<typeof errorDetailSchema>;

export const apiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: errorCodeSchema,
        message: z.string(),
        details: z.array(errorDetailSchema).optional(),
        requestId: z.string(),
      })
      .strict(),
  })
  .strict();

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

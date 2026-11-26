import type { ErrorCode, ErrorDetail } from '@minieshop/contracts';
import type { ZodError } from 'zod';

export class AppHttpError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ErrorDetail[];
  public readonly headers?: Record<string, string>;
  public readonly internalMessage?: string;

  constructor(params: {
    statusCode: number;
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    headers?: Record<string, string>;
    internalMessage?: string;
  }) {
    super(params.message);
    this.name = 'AppHttpError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
    this.headers = params.headers;
    this.internalMessage = params.internalMessage;
  }
}

export function zodErrorToDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '_root',
    message: issue.message,
  }));
}

export function validationError(
  details: ErrorDetail[],
  message = 'Validation failed',
): AppHttpError {
  return new AppHttpError({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message,
    details,
  });
}

export function notFoundError(message = 'Resource not found'): AppHttpError {
  return new AppHttpError({
    statusCode: 404,
    code: 'NOT_FOUND',
    message,
  });
}

export function conflictError(message = 'Resource conflict'): AppHttpError {
  return new AppHttpError({
    statusCode: 409,
    code: 'CONFLICT',
    message,
  });
}

export function unauthenticatedError(message = 'Authentication required'): AppHttpError {
  return new AppHttpError({
    statusCode: 401,
    code: 'UNAUTHENTICATED',
    message,
  });
}

export function invalidCredentialsError(): AppHttpError {
  return new AppHttpError({
    statusCode: 401,
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  });
}

export function emailNotVerifiedError(): AppHttpError {
  return new AppHttpError({
    statusCode: 403,
    code: 'EMAIL_NOT_VERIFIED',
    message: 'Email address must be verified before signing in',
  });
}

export function forbiddenError(message = 'Insufficient permissions'): AppHttpError {
  return new AppHttpError({
    statusCode: 403,
    code: 'FORBIDDEN',
    message,
  });
}

export function csrfInvalidError(): AppHttpError {
  return new AppHttpError({
    statusCode: 403,
    code: 'CSRF_INVALID',
    message: 'CSRF validation failed',
  });
}

export function rateLimitedError(retryAfterSeconds: number): AppHttpError {
  const retry = Math.max(1, Math.ceil(retryAfterSeconds));
  return new AppHttpError({
    statusCode: 429,
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
    headers: { 'retry-after': String(retry) },
  });
}

export function chaosFailureError(message = 'Simulated chaos failure'): AppHttpError {
  return new AppHttpError({
    statusCode: 503,
    code: 'CHAOS_FAILURE',
    message,
  });
}

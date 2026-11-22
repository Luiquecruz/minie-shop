import type { ErrorCode, ErrorDetail } from '@minieshop/contracts';
import type { ZodError } from 'zod';

export class AppHttpError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ErrorDetail[];

  constructor(params: {
    statusCode: number;
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  }) {
    super(params.message);
    this.name = 'AppHttpError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
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

export function chaosFailureError(message = 'Simulated chaos failure'): AppHttpError {
  return new AppHttpError({
    statusCode: 503,
    code: 'CHAOS_FAILURE',
    message,
  });
}

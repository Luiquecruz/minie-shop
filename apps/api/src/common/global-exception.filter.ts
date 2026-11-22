import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  apiErrorResponseSchema,
  type ApiErrorResponse,
  type ErrorCode,
  type ErrorDetail,
} from '@minieshop/contracts';
import { ZodError, type ZodIssue } from 'zod';
import { AppHttpError, zodErrorToDetails } from './errors.js';

function isZodError(value: unknown): value is ZodError {
  if (value instanceof ZodError) {
    return true;
  }
  return (
    value instanceof Error &&
    value.name === 'ZodError' &&
    Array.isArray((value as { issues?: unknown }).issues)
  );
}

function extractZodDetails(error: { issues: ZodIssue[] }): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '_root',
    message: issue.message,
  }));
}

export function buildErrorResponse(params: {
  code: ErrorCode;
  message: string;
  requestId: string;
  details?: ErrorDetail[];
}): ApiErrorResponse {
  return apiErrorResponseSchema.parse({
    error: {
      code: params.code,
      message: params.message,
      ...(params.details && params.details.length > 0 ? { details: params.details } : {}),
      requestId: params.requestId,
    },
  });
}

function mapHttpStatusToErrorCode(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
      return 'VALIDATION_ERROR';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMITED';
    default:
      return statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  }
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();
    const requestId = typeof request.id === 'string' ? request.id : String(request.id ?? 'unknown');

    if (exception instanceof AppHttpError) {
      const payload = buildErrorResponse({
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId,
      });
      void reply.code(exception.statusCode).send(payload);
      return;
    }

    if (isZodError(exception)) {
      const payload = buildErrorResponse({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details:
          exception instanceof ZodError
            ? zodErrorToDetails(exception)
            : extractZodDetails(exception),
        requestId,
      });
      void reply.code(400).send(payload);
      return;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : typeof response === 'object' &&
              response !== null &&
              'message' in response &&
              typeof (response as { message?: unknown }).message === 'string'
            ? (response as { message: string }).message
            : exception.message;

      if (statusCode >= 500) {
        request.log.error({ err: exception, requestId }, 'Unhandled HTTP 5xx exception');
      }

      const payload = buildErrorResponse({
        code: mapHttpStatusToErrorCode(statusCode),
        message: statusCode >= 500 ? 'Internal server error' : message,
        requestId,
      });
      void reply.code(statusCode).send(payload);
      return;
    }

    request.log.error({ err: exception, requestId }, 'Unhandled exception');

    const payload = buildErrorResponse({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId,
    });
    void reply.code(500).send(payload);
  }
}

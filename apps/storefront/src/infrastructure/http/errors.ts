import type { ErrorCode, ErrorDetail } from '@minieshop/contracts';
import type { z } from 'zod';

export type ContractIssue = z.core.$ZodIssue;

/**
 * Standardized HTTP API error parsed from `{ error: { code, message, details?, requestId } }`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'UNKNOWN_ERROR';
  readonly requestId: string;
  readonly details?: ErrorDetail[];

  constructor(params: {
    status: number;
    code: ErrorCode | 'UNKNOWN_ERROR';
    message: string;
    requestId: string;
    details?: ErrorDetail[];
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
    this.details = params.details;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.code === 'NOT_FOUND';
  }
}

/**
 * Raised when a fetch fails due to network unreachability, DNS/CORS errors, or request timeout.
 */
export class NetworkError extends Error {
  readonly isTimeout: boolean;

  constructor(message: string, options?: { isTimeout?: boolean; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = 'NetworkError';
    this.isTimeout = Boolean(options?.isTimeout);
  }
}

/**
 * Raised when an API payload violates the tolerant client Zod schema.
 * UI displays an error state cleanly while full details are logged for debugging.
 */
export class ContractViolationError extends Error {
  readonly endpoint: string;
  readonly issues: ContractIssue[];

  constructor(endpoint: string, issues: ContractIssue[]) {
    super(`API response contract violation at ${endpoint}.`);
    this.name = 'ContractViolationError';
    this.endpoint = endpoint;
    this.issues = issues;
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

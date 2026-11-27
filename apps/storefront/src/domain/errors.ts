/**
 * Pure domain-level error inspection helpers that decouple presentation components
 * from concrete HTTP transport error classes in `infrastructure/http/errors`.
 */

interface CodedErrorLike {
  code?: unknown;
  status?: unknown;
  isNotFound?: unknown;
}

function asCodedError(error: unknown): CodedErrorLike | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  return error as CodedErrorLike;
}

export function isNotFoundError(error: unknown): boolean {
  const candidate = asCodedError(error);
  if (!candidate) {
    return false;
  }
  return (
    candidate.isNotFound === true ||
    candidate.status === 404 ||
    candidate.code === 'NOT_FOUND'
  );
}

export function getErrorCode(error: unknown): string | null {
  const candidate = asCodedError(error);
  if (!candidate || typeof candidate.code !== 'string') {
    return null;
  }
  return candidate.code;
}

import { clientApiErrorResponseSchema } from '@minieshop/contracts/catalog/client';
import type { ZodIssue } from 'zod';
import { getStorefrontEnv } from '../../config/env';
import { getDevChaosHeaders } from './chaos';
import {
  ApiError,
  ContractViolationError,
  NetworkError,
  isAbortError,
} from './errors';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface SafeParseSchema<T> {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: ZodIssue[] } };
}

export interface HttpClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface HttpRequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  schema?: SafeParseSchema<T>;
}

function buildUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? getStorefrontEnv().VITE_API_URL).replace(
      /\/+$/,
      '',
    );
    this.defaultTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
  }

  async request<T = void>(
    path: string,
    options: HttpRequestOptions<T> = {},
  ): Promise<T> {
    const method = options.method ?? 'GET';
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const url = buildUrl(this.baseUrl, path);

    const devChaosHeaders = import.meta.env.DEV ? getDevChaosHeaders() : {};
    const hasDevChaos =
      import.meta.env.DEV && Object.keys(devChaosHeaders).length > 0;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...devChaosHeaders,
      ...options.headers,
    };

    let serializedBody: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      serializedBody = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    let timedOut = false;

    const onExternalAbort = (): void => {
      controller.abort(options.signal?.reason);
    };

    if (options.signal) {
      if (options.signal.aborted) {
        throw new DOMException('The request was aborted.', 'AbortError');
      }
      options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const timeoutId =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
          }, timeoutMs)
        : null;

    const toTransportError = (error: unknown): unknown => {
      if (timedOut) {
        return new NetworkError(
          `Request to ${path} timed out after ${timeoutMs}ms.`,
          { isTimeout: true, cause: error },
        );
      }
      if (options.signal?.aborted || isAbortError(error)) {
        return error;
      }
      return new NetworkError(
        `Network error while requesting ${path}. Check your connection and try again.`,
        { isTimeout: false, cause: error },
      );
    };

    try {
      let response: Response;
      try {
        response = await this.fetchFn(url, {
          method,
          credentials: 'include',
          ...(hasDevChaos ? { cache: 'no-store' as const } : {}),
          headers,
          body: serializedBody,
          signal: controller.signal,
        });
      } catch (error: unknown) {
        throw toTransportError(error);
      }

      if (!response.ok) {
        let errorPayload: unknown;
        try {
          errorPayload = await parseJsonSafe(response);
        } catch (error: unknown) {
          throw toTransportError(error);
        }

        const parsedError = clientApiErrorResponseSchema.safeParse(errorPayload);
        const fallbackRequestId =
          response.headers.get('x-request-id') ?? 'unavailable';

        if (parsedError.success) {
          throw new ApiError({
            status: response.status,
            code: parsedError.data.error.code,
            message: parsedError.data.error.message,
            requestId: parsedError.data.error.requestId,
            details: parsedError.data.error.details,
          });
        }

        throw new ApiError({
          status: response.status,
          code: 'UNKNOWN_ERROR',
          message: `HTTP ${response.status} ${response.statusText || 'Error'} while requesting ${path}`,
          requestId: fallbackRequestId,
        });
      }

      if (response.status === 204 || !options.schema) {
        return undefined as T;
      }

      let jsonPayload: unknown;
      try {
        jsonPayload = await parseJsonSafe(response);
      } catch (error: unknown) {
        throw toTransportError(error);
      }

      const parsed = options.schema.safeParse(jsonPayload);
      if (!parsed.success) {
        console.error('[HttpClient] ContractViolationError', {
          endpoint: path,
          issues: parsed.error.issues,
        });
        throw new ContractViolationError(path, parsed.error.issues);
      }

      return parsed.data;
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      options.signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  get<T>(
    path: string,
    schema: SafeParseSchema<T>,
    options?: Omit<HttpRequestOptions<T>, 'method' | 'body' | 'schema'>,
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET', schema });
  }

  post<T>(
    path: string,
    schema: SafeParseSchema<T>,
    options?: Omit<HttpRequestOptions<T>, 'method' | 'schema'>,
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', schema });
  }

  delete(
    path: string,
    options?: Omit<HttpRequestOptions<void>, 'method' | 'schema'>,
  ): Promise<void> {
    return this.request<void>(path, { ...options, method: 'DELETE' });
  }
}

export function createHttpClient(options?: HttpClientOptions): HttpClient {
  return new HttpClient(options);
}

import { describe, expect, it } from 'vitest';
import { parseStorefrontEnv } from './env';

describe('parseStorefrontEnv', () => {
  it('parses a valid HTTP(S) VITE_API_URL and strips trailing slashes', () => {
    const parsed = parseStorefrontEnv({
      VITE_API_URL: 'http://localhost:3001///',
    });
    expect(parsed.VITE_API_URL).toBe('http://localhost:3001');
  });

  it('throws a clear fast-fail error when VITE_API_URL is missing', () => {
    expect(() => parseStorefrontEnv({})).toThrow(/VITE_API_URL/);
  });

  it('throws a clear fast-fail error when VITE_API_URL is invalid or non-HTTP', () => {
    expect(() =>
      parseStorefrontEnv({ VITE_API_URL: 'not-a-url' }),
    ).toThrow(/VITE_API_URL/);

    expect(() =>
      parseStorefrontEnv({ VITE_API_URL: 'ftp://localhost:3001' }),
    ).toThrow(/http:\/\/ or https:\/\//);
  });
});

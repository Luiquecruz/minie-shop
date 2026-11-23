export interface DevChaosConfig {
  delay: string;
  fail: string;
  status: string;
}

const listeners = new Set<() => void>();

function emitChaosChange(): void {
  if (!import.meta.env.DEV) return;
  listeners.forEach((listener) => listener());
}

/**
 * Reads development chaos configuration from localStorage.
 * Completely tree-shaken out of production builds (`import.meta.env.DEV === false`).
 */
export function readDevChaosConfig(): DevChaosConfig {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return { delay: '', fail: '', status: '' };
  }

  try {
    return {
      delay: window.localStorage.getItem('chaos.delay')?.trim() ?? '',
      fail: window.localStorage.getItem('chaos.fail')?.trim() ?? '',
      status: window.localStorage.getItem('chaos.status')?.trim() ?? '',
    };
  } catch {
    return { delay: '', fail: '', status: '' };
  }
}

export function writeDevChaosKey(
  key: 'delay' | 'fail' | 'status',
  value: string,
): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }

  const storageKey =
    key === 'delay'
      ? 'chaos.delay'
      : key === 'fail'
        ? 'chaos.fail'
        : 'chaos.status';

  try {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, trimmed);
    }
    emitChaosChange();
  } catch {
    // Ignore storage quota or security errors in restricted browser contexts.
  }
}

export function resetDevChaosConfig(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem('chaos.delay');
    window.localStorage.removeItem('chaos.fail');
    window.localStorage.removeItem('chaos.status');
    emitChaosChange();
  } catch {
    // Ignore storage errors.
  }
}

export function subscribeDevChaos(listener: () => void): () => void {
  if (!import.meta.env.DEV) {
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Builds `x-chaos-*` headers strictly in development mode.
 * Returns `{}` and eliminates all chaos header strings from production bundles.
 */
export function getDevChaosHeaders(): Record<string, string> {
  if (!import.meta.env.DEV) {
    return {};
  }

  const config = readDevChaosConfig();
  const headers: Record<string, string> = {};

  if (config.delay.length > 0) {
    headers['x-chaos-delay'] = config.delay;
  }
  if (config.fail.length > 0) {
    headers['x-chaos-fail'] = config.fail;
  }
  if (config.status.length > 0) {
    headers['x-chaos-status'] = config.status;
  }

  return headers;
}

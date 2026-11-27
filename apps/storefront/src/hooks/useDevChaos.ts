import { useCallback, useEffect, useState } from 'react';
import {
  readDevChaosConfig,
  resetDevChaosConfig,
  subscribeDevChaos,
  writeDevChaosKey,
  type DevChaosConfig,
} from '../infrastructure/http/chaos';

export type { DevChaosConfig };

/**
 * Hook encapsulating DEV-only API chaos configuration stored in localStorage
 * so `ApiDebugFab` never imports `infrastructure/http/chaos` directly.
 */
export function useDevChaos() {
  const [config, setConfig] = useState<DevChaosConfig>(() => readDevChaosConfig());

  useEffect(() => {
    return subscribeDevChaos(() => {
      setConfig(readDevChaosConfig());
    });
  }, []);

  const setChaosValue = useCallback(
    (key: 'delay' | 'fail' | 'status', value: string): void => {
      writeDevChaosKey(key, value);
      setConfig(readDevChaosConfig());
    },
    [],
  );

  const resetChaos = useCallback((): void => {
    resetDevChaosConfig();
    setConfig(readDevChaosConfig());
  }, []);

  return {
    config,
    setChaosValue,
    resetChaos,
  };
}

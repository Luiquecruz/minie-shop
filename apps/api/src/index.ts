import { healthStatusSchema, type HealthStatus } from '@minieshop/contracts';

export function buildHealthPayload(): HealthStatus {
  return healthStatusSchema.parse({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}

import { z } from 'zod';

export const healthStatusSchema = z.object({
  status: z.enum(['ok', 'error']),
  timestamp: z.string().datetime(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const readinessStatusSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  database: z.enum(['up', 'down']),
  timestamp: z.string().datetime(),
});

export type ReadinessStatus = z.infer<typeof readinessStatusSchema>;

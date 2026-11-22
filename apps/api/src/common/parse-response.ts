import type { z } from 'zod';
import { AppHttpError } from './errors.js';

export function parseOutput<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '_root'}: ${issue.message}`)
      .join('; ');
    throw new AppHttpError({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: `Response contract validation failed: ${issueSummary}`,
    });
  }
  return parsed.data;
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { loadEnv, parseCorsOrigins } from '../../config/env.js';

export const CSRF_HEADER_NAME = 'x-csrf-token';

@Injectable()
export class CsrfService {
  generateToken(sessionId: string, secretOverride?: string): string {
    const secret = secretOverride ?? loadEnv().CSRF_SECRET;
    return createHmac('sha256', secret).update(`csrf:${sessionId}`).digest('base64url');
  }

  verifyToken(sessionId: string, candidate: string | undefined, secretOverride?: string): boolean {
    if (!candidate || candidate.length === 0) {
      return false;
    }
    const expected = this.generateToken(sessionId, secretOverride);
    const expectedBuf = Buffer.from(expected, 'utf8');
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (expectedBuf.length !== candidateBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, candidateBuf);
  }

  isOriginAllowed(originHeader: string | undefined, allowedOriginsOverride?: string[]): boolean {
    if (!originHeader || originHeader.trim().length === 0) {
      return false;
    }
    const allowedOrigins = allowedOriginsOverride ?? parseCorsOrigins(loadEnv().CORS_ORIGINS);
    return allowedOrigins.includes(originHeader.trim());
  }
}

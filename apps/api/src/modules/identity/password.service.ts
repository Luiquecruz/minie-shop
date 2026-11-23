import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { validationError } from '../../common/errors.js';
import { loadEnv, type Env } from '../../config/env.js';
import { COMMON_PASSWORDS } from './common-passwords.js';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export interface Argon2Params {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

@Injectable()
export class PasswordService {
  private dummyHashPromise: Promise<string> | null = null;

  getArgon2Params(env: Pick<Env, 'ARGON2_MEMORY_COST' | 'ARGON2_TIME_COST' | 'ARGON2_PARALLELISM'> = loadEnv()): Argon2Params {
    return {
      memoryCost: env.ARGON2_MEMORY_COST,
      timeCost: env.ARGON2_TIME_COST,
      parallelism: env.ARGON2_PARALLELISM,
    };
  }

  normalize(raw: string): string {
    return raw.normalize('NFKC');
  }

  validatePolicy(rawPassword: string, normalizedEmail?: string): string {
    const normalized = this.normalize(rawPassword);

    if (normalized.length < PASSWORD_MIN_LENGTH) {
      throw validationError([
        {
          path: 'password',
          message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
        },
      ]);
    }

    if (normalized.length > PASSWORD_MAX_LENGTH) {
      throw validationError([
        {
          path: 'password',
          message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters long`,
        },
      ]);
    }

    const lowered = normalized.toLowerCase();

    if (normalizedEmail && lowered === normalizedEmail.normalize('NFKC').trim().toLowerCase()) {
      throw validationError([
        {
          path: 'password',
          message: 'Password must not be identical to the email address',
        },
      ]);
    }

    if (COMMON_PASSWORDS.has(lowered)) {
      throw validationError([
        {
          path: 'password',
          message: 'Password is too common; please choose a stronger passphrase',
        },
      ]);
    }

    return normalized;
  }

  async hash(rawPassword: string, paramsOverride?: Argon2Params): Promise<string> {
    const normalized = this.normalize(rawPassword);
    const params = paramsOverride ?? this.getArgon2Params();
    return argon2.hash(normalized, {
      type: argon2.argon2id,
      memoryCost: params.memoryCost,
      timeCost: params.timeCost,
      parallelism: params.parallelism,
    });
  }

  async verify(storedHash: string, rawPassword: string): Promise<boolean> {
    const normalized = this.normalize(rawPassword);
    try {
      return await argon2.verify(storedHash, normalized);
    } catch {
      return false;
    }
  }

  needsRehash(storedHash: string, paramsOverride?: Argon2Params): boolean {
    const params = paramsOverride ?? this.getArgon2Params();
    try {
      return argon2.needsRehash(storedHash, {
        memoryCost: params.memoryCost,
        timeCost: params.timeCost,
        parallelism: params.parallelism,
      });
    } catch {
      return true;
    }
  }

  async verifyDummy(rawPassword: string, paramsOverride?: Argon2Params): Promise<void> {
    if (paramsOverride) {
      const dummyHash = await this.hash('dummy-timing-parity-passphrase-never-used', paramsOverride);
      await this.verify(dummyHash, rawPassword);
      return;
    }
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = this.hash('dummy-timing-parity-passphrase-never-used');
    }
    const dummyHash = await this.dummyHashPromise;
    await this.verify(dummyHash, rawPassword);
  }
}

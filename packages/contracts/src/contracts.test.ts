import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as rootContracts from './index.js';
import { clientProductCardDtoSchema } from './catalog/client.js';
import { productCardDtoSchema } from './catalog/public.js';
import { clientCsrfTokenResponseSchema, clientCustomerProfileDtoSchema } from './identity/client.js';
import { auditLogEntryDtoSchema } from './identity/admin.js';
import { customerProfileDtoSchema } from './identity/public.js';
import { clientSearchSuggestResponseSchema } from './search/client.js';
import { searchSuggestResponseSchema } from './search/public.js';

describe('@minieshop/contracts boundary and schema guarantees', () => {
  it('does not expose backend-internal searchIndexDocumentSchema in root barrel', () => {
    assert.equal('searchIndexDocumentSchema' in rootContracts, false);
  });

  it('rejects unknown fields on server .strict() schemas and strips them on client .strip() schemas', () => {
    const baseCard = {
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'fone-bluetooth',
      name: 'Fone Bluetooth',
      price: { amount: 19990, currency: 'BRL' as const },
      inStock: true,
      image: null,
      highlights: [],
      categorySlug: 'audio',
    };

    const withExtra = { ...baseCard, futureServerField: 'v2' };

    assert.equal(productCardDtoSchema.safeParse(withExtra).success, false);
    const stripped = clientProductCardDtoSchema.parse(withExtra);
    assert.deepEqual(stripped, baseCard);
  });

  it('validates categorySlug on search suggestions for both server and client schemas', () => {
    const payload = {
      suggestions: [
        {
          slug: 'fone-bluetooth',
          name: 'Fone Bluetooth',
          categoryName: 'Áudio',
          categorySlug: 'audio',
        },
      ],
      mode: 'keyword' as const,
    };

    assert.deepEqual(searchSuggestResponseSchema.parse(payload), payload);
    assert.deepEqual(
      clientSearchSuggestResponseSchema.parse({
        ...payload,
        extra: true,
        suggestions: [{ ...payload.suggestions[0], futureRank: 1 }],
      }),
      payload,
    );
  });

  it('validates identity client tolerant schemas and strict server schemas', () => {
    const profile = {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'customer@example.com',
      fullName: 'Ada Lovelace',
      phone: null,
      emailVerified: true,
      emailVerifiedAt: '2026-11-26T12:00:00.000Z',
      createdAt: '2026-11-26T11:00:00.000Z',
    };

    assert.equal(
      customerProfileDtoSchema.safeParse({ ...profile, internalFlag: true }).success,
      false,
    );
    assert.deepEqual(
      clientCustomerProfileDtoSchema.parse({ ...profile, internalFlag: true }),
      profile,
    );
    assert.deepEqual(
      clientCsrfTokenResponseSchema.parse({ csrfToken: 'tok_123', extra: 'ignored' }),
      { csrfToken: 'tok_123' },
    );
  });

  it('validates audit log record fields under Zod v4', () => {
    const entry = {
      id: '33333333-3333-4333-8333-333333333333',
      actorType: 'staff' as const,
      actorId: '44444444-4444-4444-8444-444444444444',
      action: 'staff.roles.updated',
      entityType: 'staff_user',
      entityId: '55555555-5555-4555-8555-555555555555',
      before: { roles: ['support'] },
      after: { roles: ['admin'] },
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      requestId: 'req-1',
      metadata: { reason: 'promotion' },
      createdAt: '2026-11-26T12:00:00.000Z',
    };

    assert.deepEqual(auditLogEntryDtoSchema.parse(entry), entry);
  });
});

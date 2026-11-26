import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { AppHttpError } from './errors.js';
import { parseOutput } from './parse-response.js';

describe('parseOutput', () => {
  it('returns parsed data when payload conforms to the schema', () => {
    const schema = z.object({ ok: z.boolean() }).strict();
    assert.deepEqual(parseOutput(schema, { ok: true }), { ok: true });
  });

  it('masks internal Zod validation issues behind a generic 500 client message', () => {
    const schema = z.object({ secretColumn: z.string().min(3) }).strict();

    assert.throws(
      () => parseOutput(schema, { secretColumn: '' }),
      (err: unknown) => {
        assert.ok(err instanceof AppHttpError);
        assert.equal(err.statusCode, 500);
        assert.equal(err.code, 'INTERNAL_ERROR');
        assert.equal(err.message, 'Internal server error');
        assert.equal(err.message.includes('secretColumn'), false);
        assert.ok(err.internalMessage?.includes('secretColumn'));
        return true;
      },
    );
  });
});

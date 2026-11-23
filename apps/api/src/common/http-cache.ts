import { createHash } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

export const PUBLIC_CACHE_CONTROL = 'public, max-age=30';
export const NO_STORE_CACHE_CONTROL = 'no-store';

export function computeWeakEtag(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  const hash = createHash('sha256').update(serialized).digest('base64url').slice(0, 22);
  return `W/"${hash}"`;
}

export async function sendWithPublicCache(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
): Promise<void> {
  const etag = computeWeakEtag(payload);
  void reply.header('Cache-Control', PUBLIC_CACHE_CONTROL);
  void reply.header('ETag', etag);

  const ifNoneMatch = request.headers['if-none-match'];
  if (typeof ifNoneMatch === 'string' && ifNoneMatch.trim() === etag) {
    await reply.code(304).send();
    return;
  }

  await reply.code(200).send(payload);
}

export function applyNoStoreCache(reply: FastifyReply): void {
  void reply.header('Cache-Control', NO_STORE_CACHE_CONTROL);
}

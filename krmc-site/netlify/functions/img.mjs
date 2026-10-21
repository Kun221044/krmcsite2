// GET /api/img/:id → serve an image uploaded through the admin
import { store } from '../lib/core.mjs';

export default async (req, context) => {
  const id = context?.params?.id || new URL(req.url).pathname.split('/').pop();
  if (!/^[\w.-]+$/.test(id || '')) return new Response('Not found', { status: 404 });
  const hit = await store().getWithMetadata('uploads/' + id, { type: 'arrayBuffer' });
  if (!hit) return new Response('Not found', { status: 404 });
  return new Response(hit.data, {
    headers: {
      'content-type': hit.metadata?.type || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      'netlify-cdn-cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'"
    }
  });
};

export const config = { path: '/api/img/:id' };

// GET  /api/history          → list saved versions (admin only)
// POST /api/history/restore  → { key } make that version live
// POST /api/history/reset    → go back to the original content/site.json
import { HISTORY_PREFIX, LIVE_KEY, fail, guard, json, pushHistory, store } from '../lib/core.mjs';

export default async (req) => {
  const denied = guard(req);
  if (denied) return denied;
  const s = store();
  const path = new URL(req.url).pathname;

  if (req.method === 'GET' && path === '/api/history') {
    const { blobs } = await s.list({ prefix: HISTORY_PREFIX });
    const versions = blobs.map((b) => ({ key: b.key, savedAt: b.key.slice(HISTORY_PREFIX.length) })).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
    return json({ versions });
  }

  if (req.method === 'POST' && path === '/api/history/restore') {
    let body = {};
    try { body = await req.json(); } catch { /* empty */ }
    if (typeof body.key !== 'string' || !body.key.startsWith(HISTORY_PREFIX)) return fail(400, 'Unknown version.');
    const version = await s.get(body.key, { type: 'json' });
    if (!version) return fail(404, 'That version no longer exists.');
    await pushHistory(s, 'Before restore');
    await s.setJSON(LIVE_KEY, version, { metadata: { savedAt: new Date().toISOString(), restoredFrom: body.key } });
    return json({ ok: true });
  }

  if (req.method === 'POST' && path === '/api/history/reset') {
    await pushHistory(s, 'Before reset');
    await s.delete(LIVE_KEY);
    return json({ ok: true });
  }

  return fail(405, 'Method not allowed');
};

export const config = { path: ['/api/history', '/api/history/restore', '/api/history/reset'] };

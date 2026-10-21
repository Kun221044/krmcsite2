// GET /api/content  → the live site content (404 until the first save; the site then uses /content/site.json)
// PUT /api/content  → save new content (admin only); the previous version goes into history
import { LIVE_KEY, fail, guard, json, pushHistory, store } from '../lib/core.mjs';

const MAX_BYTES = 1_500_000;
const REQUIRED = ['site', 'header', 'hero'];

export default async (req) => {
  const s = store();

  if (req.method === 'GET') {
    const data = await s.get(LIVE_KEY, { type: 'json' });
    return data ? json(data) : fail(404, 'No saved content yet');
  }

  if (req.method === 'PUT') {
    const denied = guard(req);
    if (denied) return denied;
    const text = await req.text();
    if (text.length > MAX_BYTES) return fail(413, 'Content is too large.');
    let data;
    try { data = JSON.parse(text); } catch { return fail(400, 'Invalid content.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data) || REQUIRED.some((k) => typeof data[k] !== 'object')) {
      return fail(400, 'Content is missing required sections.');
    }
    await pushHistory(s, 'Before save');
    await s.setJSON(LIVE_KEY, data, { metadata: { savedAt: new Date().toISOString() } });
    return json({ ok: true, savedAt: new Date().toISOString() });
  }

  return fail(405, 'Method not allowed');
};

export const config = { path: '/api/content' };

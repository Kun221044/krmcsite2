// /api/login  /api/logout  /api/session
import { adminConfigured, clearSessionCookie, fail, isAuthed, json, makeSessionCookie, passwordMatches, sameOrigin, store } from '../lib/core.mjs';
import { createHash } from 'node:crypto';

const MAX_FAILS = 8;
const WINDOW_MS = 15 * 60 * 1000;

export default async (req, context) => {
  const path = new URL(req.url).pathname;

  if (path === '/api/session') {
    return json({ configured: adminConfigured(), loggedIn: isAuthed(req) });
  }

  if (req.method !== 'POST') return fail(405, 'Method not allowed');
  if (!sameOrigin(req)) return fail(403, 'Cross-site request blocked.');

  if (path === '/api/logout') {
    return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
  }

  // /api/login
  if (!adminConfigured()) return fail(503, 'Admin is not set up yet. Add ADMIN_PASSWORD (8+ characters) in Netlify environment variables, then redeploy once.');
  const s = store();
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const lockKey = 'auth/fail/' + createHash('sha256').update(ip).digest('hex').slice(0, 24);
  const rec = (await s.get(lockKey, { type: 'json' })) || { count: 0, first: Date.now() };
  if (Date.now() - rec.first > WINDOW_MS) { rec.count = 0; rec.first = Date.now(); }
  if (rec.count >= MAX_FAILS) return fail(429, 'Too many attempts. Try again in 15 minutes.');

  let body = {};
  try { body = await req.json(); } catch { /* empty */ }
  if (!passwordMatches(body.password)) {
    rec.count += 1;
    await s.setJSON(lockKey, rec);
    await new Promise((r) => setTimeout(r, 600));
    return fail(401, 'Incorrect password.');
  }
  await s.delete(lockKey);
  return json({ ok: true }, 200, { 'set-cookie': makeSessionCookie() });
};

export const config = { path: ['/api/login', '/api/logout', '/api/session'] };

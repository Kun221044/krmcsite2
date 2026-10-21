// Shared helpers for the KRMC admin functions: storage, sessions, responses.
import { getStore } from '@netlify/blobs';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// ---------- storage ----------
// On Netlify this is Netlify Blobs. For local tests, KRMC_MEMORY_STORE=1 uses an in-memory map.
function memoryStore() {
  const m = (globalThis.__krmcMem ??= new Map());
  const out = (v, type) => {
    if (v == null) return null;
    if (type === 'json') return JSON.parse(typeof v === 'string' ? v : Buffer.from(v).toString());
    if (type === 'arrayBuffer') return typeof v === 'string' ? new TextEncoder().encode(v).buffer : v;
    return typeof v === 'string' ? v : Buffer.from(v).toString();
  };
  return {
    async get(k, o = {}) { const e = m.get(k); return e ? out(e.data, o.type) : null; },
    async getWithMetadata(k, o = {}) { const e = m.get(k); return e ? { data: out(e.data, o.type), metadata: e.metadata || {} } : null; },
    async set(k, data, o = {}) { m.set(k, { data, metadata: o.metadata || {} }); },
    async setJSON(k, obj, o = {}) { m.set(k, { data: JSON.stringify(obj), metadata: o.metadata || {} }); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '' } = {}) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; }
  };
}
export const store = () => (process.env.KRMC_MEMORY_STORE ? memoryStore() : getStore({ name: 'krmc', consistency: 'strong' }));

export const LIVE_KEY = 'content/live';
export const HISTORY_PREFIX = 'content/history/';
export const HISTORY_LIMIT = 30;

// ---------- responses ----------
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
export const fail = (status, error) => json({ error }, status);

// ---------- admin password + sessions ----------
const COOKIE = 'krmc_admin';
const SESSION_HOURS = 8;
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sha256 = (s) => createHash('sha256').update(s).digest();

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8);
}
function secret() {
  // Changing ADMIN_PASSWORD (or SESSION_SECRET) logs out every existing session.
  return process.env.SESSION_SECRET || sha256('krmc-session:' + process.env.ADMIN_PASSWORD).toString('hex');
}
export function passwordMatches(input) {
  const a = sha256(String(input ?? ''));
  const b = sha256(process.env.ADMIN_PASSWORD || randomBytes(16).toString('hex'));
  return timingSafeEqual(a, b);
}
export function makeSessionCookie() {
  const payload = b64url(JSON.stringify({ exp: Date.now() + SESSION_HOURS * 3600e3, n: randomBytes(8).toString('hex') }));
  const sig = b64url(createHmac('sha256', secret()).update(payload).digest());
  return `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}
export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function isAuthed(req) {
  if (!adminConfigured()) return false;
  const raw = (req.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig) return false;
  const expect = createHmac('sha256', secret()).update(payload).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}

// Block cross-site requests for anything that changes data.
export function sameOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // same-origin fetches from older browsers may omit it; SameSite=Strict still applies
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

// Guard for admin-only routes. Returns a Response to send back, or null when allowed.
export function guard(req) {
  if (!adminConfigured()) return fail(503, 'Admin is not set up yet. Add ADMIN_PASSWORD in Netlify environment variables.');
  if (req.method !== 'GET' && !sameOrigin(req)) return fail(403, 'Cross-site request blocked.');
  if (!isAuthed(req)) return fail(401, 'Please log in.');
  return null;
}

// ---------- content history ----------
export async function pushHistory(s, note) {
  const current = await s.get(LIVE_KEY, { type: 'json' });
  if (!current) return;
  const ts = new Date().toISOString();
  await s.setJSON(HISTORY_PREFIX + ts, current, { metadata: { savedAt: ts, note } });
  const { blobs } = await s.list({ prefix: HISTORY_PREFIX });
  const keys = blobs.map((b) => b.key).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - HISTORY_LIMIT))) await s.delete(k);
}

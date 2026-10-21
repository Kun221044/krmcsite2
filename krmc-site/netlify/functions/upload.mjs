// POST   /api/upload        → upload one image (admin only), returns { url }
// GET    /api/upload        → list uploaded images (admin only)
// DELETE /api/upload?id=…   → delete an uploaded image (admin only)
import { fail, guard, json, store } from '../lib/core.mjs';
import { randomBytes } from 'node:crypto';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_BYTES = 4 * 1024 * 1024; // Netlify function requests are capped near 6 MB; the admin shrinks photos before upload
const PREFIX = 'uploads/';

// Check the file really is the image type it claims to be
function sniff(buf) {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

export default async (req) => {
  const denied = guard(req);
  if (denied) return denied;
  const s = store();

  if (req.method === 'GET') {
    const { blobs } = await s.list({ prefix: PREFIX });
    const items = blobs.map((b) => ({ id: b.key.slice(PREFIX.length), url: '/api/img/' + b.key.slice(PREFIX.length) })).sort((a, b) => (a.id < b.id ? 1 : -1));
    return json({ items });
  }

  if (req.method === 'DELETE') {
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!/^[\w.-]+$/.test(id)) return fail(400, 'Bad id');
    await s.delete(PREFIX + id);
    return json({ ok: true });
  }

  if (req.method !== 'POST') return fail(405, 'Method not allowed');

  let form;
  try { form = await req.formData(); } catch { return fail(400, 'Upload failed. Please try again.'); }
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return fail(400, 'No file received.');
  if (file.size > MAX_BYTES) return fail(413, 'Image is larger than 4 MB.');
  const buf = await file.arrayBuffer();
  const type = sniff(buf);
  if (!type || !TYPES[type]) return fail(415, 'Only JPG, PNG, WebP or GIF images are allowed.');

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const id = `${stamp}-${randomBytes(5).toString('hex')}.${TYPES[type]}`;
  const name = String(file.name || '').replace(/[^\w. -]/g, '').slice(0, 80);
  await s.set(PREFIX + id, buf, { metadata: { type, name, size: buf.byteLength } });
  return json({ ok: true, id, url: '/api/img/' + id });
};

export const config = { path: '/api/upload' };

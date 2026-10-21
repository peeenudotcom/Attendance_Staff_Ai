import fs from 'node:fs';
import { faceDescriptor } from '../lib/face-local.js';
import { faceProvider } from '../lib/face.js';

// GET /api/face-selftest (public) -> loads the free face engine and finds the face in a bundled sample photo, so a
// deployment can be checked without signing in. No staff data is touched.
export default async function handler(req, res) {
  const t = Date.now();
  try {
    const face = await faceDescriptor(fs.readFileSync(new URL('../lib/face-selftest.jpg', import.meta.url)));
    return res.status(200).json({ ok: !!face, provider: faceProvider(), ms: Date.now() - t });
  } catch (err) {
    console.error('[face-selftest]', err);
    return res.status(500).json({ ok: false, provider: faceProvider(), error: err.message });
  }
}

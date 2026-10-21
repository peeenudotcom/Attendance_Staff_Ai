import { createRequire } from 'node:module';
import path from 'node:path';
import jpeg from 'jpeg-js';

// Free face matching on our own server: open-source models (face-api, a FaceNet-style network) running on TensorFlow
// WebAssembly. Each face becomes 128 numbers; two photos of the same person are close (distance under ~0.5), different
// people far apart (~0.65 and up). Nothing leaves the server and nothing is stored: the numbers are worked out again
// from the saved photo when needed (kept in memory only while the server stays warm).
const require = createRequire(import.meta.url);
export const MATCH_BELOW = 0.55; // euclidean distance: same person below this
const MAX_SIDE = 640; // selfies are scaled down to this before looking for a face (faster, same result)

let loading = null;
function engine() {
  loading ??= (async () => {
    const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
    await faceapi.tf.setBackend('wasm');
    await faceapi.tf.ready();
    const models = path.join(path.dirname(require.resolve('@vladmandic/face-api/dist/face-api.node-wasm.js')), '..', 'model');
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(models),
      faceapi.nets.faceLandmark68Net.loadFromDisk(models),
      faceapi.nets.faceRecognitionNet.loadFromDisk(models),
    ]);
    return faceapi;
  })().catch((err) => { loading = null; throw err; });
  return loading;
}

/** JPEG bytes -> [height, width, 3] RGB pixels, scaled down so the longer side is at most MAX_SIDE. */
function pixels(bytes) {
  const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 256 });
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0, j = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor(y / scale));
    for (let x = 0; x < w; x++) {
      const i = (sy * img.width + Math.min(img.width - 1, Math.floor(x / scale))) * 4;
      rgb[j++] = img.data[i]; rgb[j++] = img.data[i + 1]; rgb[j++] = img.data[i + 2];
    }
  }
  return { rgb, w, h };
}

/** The face's 128 numbers for the largest face in a JPEG, or null if there is no clear face. */
export async function faceDescriptor(bytes) {
  const faceapi = await engine();
  const { rgb, w, h } = pixels(bytes);
  const tensor = faceapi.tf.tensor3d(rgb, [h, w, 3], 'int32');
  try {
    const faces = await faceapi.detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks().withFaceDescriptors();
    if (!faces.length) return null;
    const area = (f) => f.detection.box.width * f.detection.box.height;
    return Array.from(faces.reduce((a, b) => (area(b) > area(a) ? b : a)).descriptor);
  } finally {
    tensor.dispose();
  }
}

export const distance = (a, b) => Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));

/** Distance -> { result: 'match' | 'mismatch', score } where score is a 0-100 similarity for admins. */
export const verdict = (d) => ({ result: d < MATCH_BELOW ? 'match' : 'mismatch', score: Math.round(Math.max(0, 1 - d) * 1000) / 10 });

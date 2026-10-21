import { createHash, createHmac } from 'node:crypto';
import { db } from './db.js';

// Face match with Amazon Rekognition CompareFaces (Mumbai region by default). Set REKOGNITION_ACCESS_KEY_ID and
// REKOGNITION_SECRET_ACCESS_KEY (an IAM user allowed only rekognition:CompareFaces); REKOGNITION_REGION is optional.
// Vercel reserves the usual AWS_* names, hence these. Images are sent for the comparison only; Rekognition does not
// keep them for CompareFaces.
const BUCKET = 'selfies';
export const MATCH_AT = 90; // similarity (0-100) needed to count as the same person
const TIMEOUT_MS = 6000;

export const faceEnabled = () => Boolean(process.env.REKOGNITION_ACCESS_KEY_ID && process.env.REKOGNITION_SECRET_ACCESS_KEY);

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const hmac = (key, s) => createHmac('sha256', key).update(s).digest();

/** Calls one Rekognition JSON action, signed with AWS Signature Version 4. */
async function rekognition(action, payload) {
  const region = process.env.REKOGNITION_REGION || 'ap-south-1';
  const host = `rekognition.${region}.amazonaws.com`;
  const body = JSON.stringify(payload);
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const target = `RekognitionService.${action}`;
  const headers = { 'content-type': 'application/x-amz-json-1.1', host, 'x-amz-date': amzDate, 'x-amz-target': target };
  const signed = Object.keys(headers).sort();
  const canonical = ['POST', '/', '', ...signed.map((k) => `${k}:${headers[k]}`), '', signed.join(';'), sha256(body)].join('\n');
  const scope = `${day}/${region}/rekognition/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  let key = hmac(`AWS4${process.env.REKOGNITION_SECRET_ACCESS_KEY}`, day);
  for (const part of [region, 'rekognition', 'aws4_request']) key = hmac(key, part);
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  const res = await fetch(`https://${host}/`, {
    method: 'POST',
    headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${process.env.REKOGNITION_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${signature}` },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const err = new Error(`Rekognition ${action} failed: ${res.status} ${(json.__type || '').split('#').pop()} ${json.message || json.Message || text.slice(0, 200)}`);
    err.type = (json.__type || '').split('#').pop();
    throw err;
  }
  return json;
}

/**
 * Compares a new selfie with the reference photo. Returns { result: 'match' | 'mismatch' | 'no_face', score }.
 * A reference with no clear face counts as 'no_face' too (Rekognition rejects it as an invalid parameter).
 */
export async function compareFaces(reference, selfie) {
  try {
    const out = await rekognition('CompareFaces', {
      SourceImage: { Bytes: reference.toString('base64') },
      TargetImage: { Bytes: selfie.toString('base64') },
      SimilarityThreshold: 0,
      QualityFilter: 'NONE',
    });
    const best = Math.max(0, ...(out.FaceMatches || []).map((m) => m.Similarity ?? 0));
    if (!(out.FaceMatches || []).length && !(out.UnmatchedFaces || []).length) return { result: 'no_face', score: null };
    return { result: best >= MATCH_AT ? 'match' : 'mismatch', score: Math.round(best * 10) / 10 };
  } catch (err) {
    if (err.type === 'InvalidParameterException') return { result: 'no_face', score: null };
    throw err;
  }
}

const refPath = (staffId) => `${staffId}/face-reference.jpg`;

/**
 * Face check for a check-in selfie (`selfie` is the JPEG bytes). With no reference photo yet (or the file is gone),
 * this selfie becomes the reference ('enrolled'). Never throws: problems come back as 'error' so check-in goes on.
 */
export async function faceCheck(staff, selfie) {
  try {
    let reference = null;
    if (staff.face_ref) {
      const { data } = await db().storage.from(BUCKET).download(staff.face_ref);
      if (data) reference = Buffer.from(await data.arrayBuffer());
    }
    if (!reference) {
      const path = refPath(staff.id);
      const { error } = await db().storage.from(BUCKET).upload(path, selfie, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(`Reference upload failed: ${error.message}`);
      const { error: e2 } = await db().from('staff').update({ face_ref: path, face_ref_at: new Date().toISOString() }).eq('id', staff.id);
      if (e2) throw new Error(e2.message);
      return { result: 'enrolled', score: null };
    }
    return await compareFaces(reference, selfie);
  } catch (err) {
    console.error('[face] check failed:', err.message);
    return { result: 'error', score: null };
  }
}

import { HttpError } from './http.js';

/** Metres between two { lat, lng } points (haversine). */
export function distanceM(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}

/** The company's office as { lat, lng, radiusM }, or null when location lock is off. */
export function officeOf(org) {
  if (!org || org.office_lat == null || org.office_lng == null || !org.office_radius_m) return null;
  return { lat: org.office_lat, lng: org.office_lng, radiusM: org.office_radius_m };
}

export const fmtDistance = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

// GPS readings wobble; a reported accuracy gives up to this much extra room, never more.
const MAX_ACCURACY_ALLOWANCE_M = 50;

/**
 * Distance from the office for a check-in or check-out (null if the company has no office set).
 * With `enforce`, refuses when the person is outside the office radius.
 */
export function officeDistance(staff, { lat, lng, accuracy }, { enforce = false } = {}) {
  const office = officeOf(staff.org);
  if (!office) return null;
  const locked = enforce && !staff.location_free;
  if (lat == null || lng == null) {
    if (locked) throw new HttpError(400, 'Turn on location to check in. Your company only allows check-in at the office.');
    return null;
  }
  const d = distanceM(office, { lat, lng });
  const slack = Math.min(Math.max(Number(accuracy) || 0, 0), MAX_ACCURACY_ALLOWANCE_M);
  if (locked && d - slack > office.radiusM) {
    throw new HttpError(403, `You are ${fmtDistance(d)} from the office. You can check in when you are within ${fmtDistance(office.radiusM)} of it.`);
  }
  return d;
}

// Same rules as the server (backend/lib/geo.js), used to warn before the selfie. The server decides.

/** Metres between two { lat, lng } points (haversine). */
export function distanceM(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}

export const fmtDistance = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

/** True when a reading is outside the office radius (GPS accuracy gives up to 50 m of room). */
export function outsideOffice(distance, accuracy, radiusM) {
  return distance - Math.min(Math.max(accuracy || 0, 0), 50) > radiusM;
}

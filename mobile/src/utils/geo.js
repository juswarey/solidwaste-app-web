// Small map maths for the resident's live truck view.
const R = 6371000; // metres
const rad = (d) => (d * Math.PI) / 180;

/** Straight-line distance in metres between two {latitude, longitude} points. */
export function distanceM(a, b) {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Compass direction of travel from a to b, 0-360 degrees (0 = north). */
export function bearing(a, b) {
  const y = Math.sin(rad(b.longitude - a.longitude)) * Math.cos(rad(b.latitude));
  const x = Math.cos(rad(a.latitude)) * Math.sin(rad(b.latitude))
    - Math.sin(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.cos(rad(b.longitude - a.longitude));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** 950 -> "950 m", 1240 -> "1.2 km" */
export function fmtDistance(m) {
  if (!Number.isFinite(m)) return '';
  return m < 1000 ? `${Math.round(m / 10) * 10 || 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/**
 * Rough minutes to arrive. Garbage trucks crawl through streets, so a moving truck uses its
 * measured speed (but never assumed faster than 30 km/h or slower than 8 km/h); a truck that
 * has not moved yet is assumed to travel at 15 km/h. Straight-line distance, so it is an estimate.
 */
export function etaMinutes(meters, speedKmh) {
  const v = speedKmh && speedKmh > 1 ? Math.min(30, Math.max(8, speedKmh)) : 15;
  return Math.max(1, Math.round((meters / 1000 / v) * 60));
}

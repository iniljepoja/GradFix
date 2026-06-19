// Small geo helpers for the duplicate-detection panel. No PostGIS / backend support needed: we fetch
// a bounding box around the pin and refine by straight-line distance on the client.
const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance in metres between two { lat, lng } points.
export function distanceMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// `minLng,minLat,maxLng,maxLat` box of roughly ±`meters` around a { lat, lng } point.
export function bboxAround({ lat, lng }, meters) {
  const latDelta = meters / 111320;
  const lngDelta = meters / (111320 * Math.cos(toRad(lat)) || 1);
  return [lng - lngDelta, lat - latDelta, lng + lngDelta, lat + latDelta]
    .map((n) => n.toFixed(6))
    .join(',');
}

export function formatDistance(m) {
  if (m < 1000) return `${Math.round(m)} m away`;
  return `${(m / 1000).toFixed(1)} km away`;
}

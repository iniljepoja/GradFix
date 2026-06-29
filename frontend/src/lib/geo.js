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

// Best-effort city-center geocoding via Nominatim. Returns { centerLat, centerLng } or null.
// Used only from the admin tenant-creation form; respects Nominatim's single-request usage.
export async function geocodeCity(name) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const [match] = await res.json();
    if (!match) return null;
    return { centerLat: Number(match.lat), centerLng: Number(match.lon) };
  } catch {
    return null;
  }
}

// Best-effort reverse geocoding of { lat, lng } to a short street address string.
// Returns { address, hasHouseNumber } or null if nothing was found. Nominatim returns
// Serbian street names in Cyrillic even with `accept-language=en`; we transliterate to Latin
// so the address matches the rest of the app (CARTO Voyager tiles render Latin place names too).
export async function reverseGeocode({ lat, lng }) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const hasHouseNumber = !!addr.house_number;
    const formatted = formatOsmAddress(addr) || data.display_name?.split(',').slice(0, 2).join(', ') || null;
    if (!formatted) return null;
    return { address: toLatin(formatted), hasHouseNumber };
  } catch {
    return null;
  }
}

// Serbian Cyrillic → Latin transliteration (deterministic 1:1, including digraphs).
const CYRILLIC_TO_LATIN = {
  а:'a', б:'b', в:'v', г:'g', д:'d', ђ:'đ', е:'e', ж:'ž', з:'z', и:'i',
  ј:'j', к:'k', л:'l', љ:'lj', м:'m', н:'n', њ:'nj', о:'o', п:'p', р:'r',
  с:'s', т:'t', ћ:'ć', у:'u', ф:'f', х:'h', ц:'c', ч:'č', џ:'dž', ш:'š',
  А:'A', Б:'B', В:'V', Г:'G', Д:'D', Ђ:'Đ', Е:'E', Ж:'Ž', З:'Z', И:'I',
  Ј:'J', К:'K', Л:'L', Љ:'Lj', М:'M', Н:'N', Њ:'Nj', О:'O', П:'P', Р:'R',
  С:'S', Т:'T', Ћ:'Ć', У:'U', Ф:'F', Х:'H', Ц:'C', Ч:'Č', Џ:'Dž', Ш:'Š',
};

function toLatin(text) {
  if (!text) return text;
  let out = '';
  for (const char of text) out += CYRILLIC_TO_LATIN[char] ?? char;
  return out;
}

function formatOsmAddress(addr) {
  if (!addr) return null;
  const street = [addr.house_number, addr.road || addr.pedestrian || addr.footway || addr.square]
    .filter(Boolean).join(' ');
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
  if (street && city) return `${street}, ${city}`;
  return street || city || null;
}

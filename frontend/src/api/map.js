import { api } from './client.js';

// Reports within a bounding box, as GeoJSON features. Reused for the public map and for the
// duplicate-detection panel in the report wizard. `bbox` is "minLng,minLat,maxLng,maxLat".
export async function nearbyReports(bbox, limit = 50) {
  const { data } = await api.get('/map/reports', { params: { bbox, limit } });
  return data.features || [];
}

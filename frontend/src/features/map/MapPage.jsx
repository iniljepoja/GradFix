import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { api } from '../../api/client.js';
import { TILE_URL, TILE_ATTRIBUTION, TILE_SUBDOMAINS } from './tiles.js';
import '../../lib/leafletIcon.js';

// Public map of reports. Refetches GeoJSON for the visible bounding box whenever the map moves.
// Default view is the tenant city (Subotica); reports load for whatever box is visible.
const SUBOTICA = [46.1005, 19.6651];

// Reports the current map bounds on initial render and after every pan/zoom (`moveend`).
function BoundsWatcher({ onBounds }) {
  const map = useMapEvents({ moveend: () => onBounds(map.getBounds()) });
  useEffect(() => { onBounds(map.getBounds()); }, [map, onBounds]);
  return null;
}

const bboxOf = (b) =>
  [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(6)).join(',');

export default function MapPage() {
  const [features, setFeatures] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounce = useRef();

  const onBounds = useCallback((bounds) => {
    // Debounce so a continuous drag/zoom issues a single request when it settles.
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setIsLoading(true);
      api.get('/map/reports', { params: { bbox: bboxOf(bounds) } })
        .then((res) => setFeatures(res.data.features || []))
        .catch(() => { /* keep the last good set on transient errors */ })
        .finally(() => setIsLoading(false));
    }, 300);
  }, []);

  useEffect(() => () => clearTimeout(debounce.current), []);

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 49px)' }}>
      <MapContainer center={SUBOTICA} zoom={13} style={{ height: '100%' }}>
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} subdomains={TILE_SUBDOMAINS} />
        <BoundsWatcher onBounds={onBounds} />
        {features.map((f) => (
          <Marker key={f.properties.id} position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}>
            <Popup>
              <strong>{f.properties.title}</strong>
              <br />
              Status: {f.properties.status} · ▲ {f.properties.upvoteCount}
              <br />
              <Link to={`/reports/${f.properties.id}`}>View details →</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {isLoading && (
        <div className="card" style={{ position: 'absolute', top: 12, left: 12, zIndex: 500, padding: '8px 12px' }}>
          Loading reports…
        </div>
      )}
    </div>
  );
}

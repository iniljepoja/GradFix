import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../../api/client.js';
import { STATUS_LABELS } from '../../lib/reportStatus.js';
import { TILE_URL, TILE_ATTRIBUTION, TILE_SUBDOMAINS } from './tiles.js';
import '../../lib/leafletIcon.js';

// Public map of reports. Refetches GeoJSON for the visible bounding box whenever the map moves.
// Default view is the tenant city (Subotica); reports load for whatever box is visible.
const SUBOTICA = [46.1005, 19.6651];
const STATUS_COLORS = {
  new: '#41505f',
  accepted: '#1a5fd0',
  assigned: '#b26a00',
  in_progress: '#8a6d00',
  resolved: '#1e8e4f',
  closed: '#5b6470',
};
const STATUS_ORDER = ['new', 'accepted', 'assigned', 'in_progress', 'resolved', 'closed'];

function markerIcon(status) {
  const color = STATUS_COLORS[status] || '#6f4fc7';
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:20px;height:20px;border-radius:999px;background:${color};border:3px solid #fff;box-shadow:0 1px 5px rgba(33,27,51,.35);"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -10],
  });
}

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
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const debounce = useRef();

  const onBounds = useCallback((bounds) => {
    // Debounce so a continuous drag/zoom issues a single request when it settles.
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setIsLoading(true);
      setError('');
      api.get('/map/reports', { params: { bbox: bboxOf(bounds) } })
        .then((res) => setFeatures(res.data.features || []))
        .catch(() => setError('Could not refresh reports. Showing the last loaded results.'))
        .finally(() => { setHasLoaded(true); setIsLoading(false); });
    }, 300);
  }, []);

  useEffect(() => () => clearTimeout(debounce.current), []);

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 49px)' }}>
      <MapContainer center={SUBOTICA} zoom={13} style={{ height: '100%' }}>
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} subdomains={TILE_SUBDOMAINS} />
        <BoundsWatcher onBounds={onBounds} />
        {features.map((f) => (
          <Marker key={f.properties.id} position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
            icon={markerIcon(f.properties.status)}>
            <Popup>
              <strong>{f.properties.title}</strong>
              <br />
              Status: {STATUS_LABELS[f.properties.status] || f.properties.status} · ▲ {f.properties.upvoteCount}
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
      {error && !isLoading && (
        <div className="alert alert-error" style={{ position: 'absolute', top: 12, left: 12, zIndex: 500 }}>
          {error}
        </div>
      )}
      {hasLoaded && !isLoading && !error && features.length === 0 && (
        <div className="card" style={{ position: 'absolute', top: 12, left: 12, zIndex: 500, padding: '10px 14px' }}>
          No reports in this area.
        </div>
      )}
      <div className="card" style={{ position: 'absolute', right: 12, bottom: 24, zIndex: 500, padding: '10px 12px' }}>
        <strong style={{ display: 'block', marginBottom: 6 }}>Status</strong>
        <div className="stack" style={{ gap: 4 }}>
          {STATUS_ORDER.map((status) => (
            <div key={status} className="row" style={{ alignItems: 'center', gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: 999, background: STATUS_COLORS[status], display: 'inline-block' }} />
              <span className="report-meta">{STATUS_LABELS[status]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

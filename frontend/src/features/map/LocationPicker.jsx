import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { TILE_URL, TILE_ATTRIBUTION, TILE_SUBDOMAINS } from './tiles.js';
import '../../lib/leafletIcon.js';

// Interactive location picker: drop a pin by tapping the map, drag it to fine-tune, or jump to the
// device's GPS position. `value` is { lat, lng } | null; `onChange` receives the same shape.
const DEFAULT_CENTER = [45.8131, 15.9776]; // Zagreb

function ClickToPlace({ onChange }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, Math.max(map.getZoom(), 16));
  }, [center, map]);
  return null;
}

export default function LocationPicker({ value, onChange }) {
  const [recenterTo, setRecenterTo] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [locating, setLocating] = useState(false);

  const position = value ? [value.lat, value.lng] : null;

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not available in this browser. Tap the map to drop a pin.');
      return;
    }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChange(next);
        setRecenterTo([next.lat, next.lng]);
        setLocating(false);
      },
      () => {
        setGeoError('Could not get your location. Tap the map to drop a pin instead.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="btn btn-sm" onClick={locate} disabled={locating}>
          {locating ? 'Locating…' : '📍 Use my location'}
        </button>
        {position && (
          <span className="report-meta">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</span>
        )}
      </div>

      {geoError && <div className="alert alert-info">{geoError}</div>}

      <div className="map-wrap" style={{ minHeight: '42vh', borderRadius: 8, overflow: 'hidden' }}>
        <MapContainer center={position || DEFAULT_CENTER} zoom={position ? 16 : 13}>
          <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} subdomains={TILE_SUBDOMAINS} />
          <ClickToPlace onChange={onChange} />
          <Recenter center={recenterTo} />
          {position && (
            <Marker
              position={position}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target.getLatLng();
                  onChange({ lat: m.lat, lng: m.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <p className="field-hint">Tap the map or drag the pin to set the exact spot.</p>
    </div>
  );
}

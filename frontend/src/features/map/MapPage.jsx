import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { api } from '../../api/client.js';

// Public map of reports. Fetches GeoJSON for the current view's bounding box.
const ZAGREB = [45.8131, 15.9776];

export default function MapPage() {
  const [features, setFeatures] = useState([]);

  useEffect(() => {
    // Initial load around the default center; a production version refetches on map move (bbox).
    const bbox = '15.85,45.75,16.10,45.85';
    api.get('/map/reports', { params: { bbox } })
      .then((res) => setFeatures(res.data.features || []))
      .catch(() => setFeatures([]));
  }, []);

  return (
    <MapContainer center={ZAGREB} zoom={13} style={{ height: 'calc(100vh - 49px)' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {features.map((f) => (
        <Marker key={f.properties.id} position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}>
          <Popup>
            <strong>{f.properties.title}</strong>
            <br />
            Status: {f.properties.status} · ▲ {f.properties.upvoteCount}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

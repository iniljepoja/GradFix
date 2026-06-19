import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as mapApi from '../../api/map.js';
import * as reportsApi from '../../api/reports.js';
import { bboxAround, distanceMeters, formatDistance } from '../../lib/geo.js';
import StatusPill from '../../components/StatusPill.jsx';

const RADIUS_M = 300;      // only treat reports within this distance as possible duplicates
const BBOX_PAD_M = 450;    // fetch a slightly larger box so edge cases aren't clipped
const MAX_RESULTS = 5;

// Duplicate-prevention panel shown in the report wizard once a location is set. When `categorySlug`
// is provided (Category step onward), same-category reports are prioritised. Never blocks the flow —
// it only surfaces existing reports the citizen can support instead of filing a duplicate.
export default function NearbyReports({ location, categorySlug, onContinue, supported, onSupport }) {
  // Round the key to ~11 m so nudging the pin doesn't trigger a refetch storm.
  const keyLat = location ? location.lat.toFixed(4) : null;
  const keyLng = location ? location.lng.toFixed(4) : null;

  const { data: features = [], isLoading } = useQuery({
    queryKey: ['nearby-reports', keyLat, keyLng],
    queryFn: () => mapApi.nearbyReports(bboxAround(location, BBOX_PAD_M)),
    enabled: !!location,
  });

  const matches = useMemo(() => {
    if (!location) return [];
    return features
      .map((f) => ({
        id: f.properties.id,
        title: f.properties.title,
        status: f.properties.status,
        categorySlug: f.properties.categorySlug,
        upvoteCount: f.properties.upvoteCount,
        distance: distanceMeters(location, {
          lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
        }),
      }))
      .filter((m) => m.distance <= RADIUS_M)
      .sort((a, b) => {
        if (categorySlug) {
          const am = a.categorySlug === categorySlug ? 0 : 1;
          const bm = b.categorySlug === categorySlug ? 0 : 1;
          if (am !== bm) return am - bm;
        }
        return a.distance - b.distance;
      })
      .slice(0, MAX_RESULTS);
  }, [features, location, categorySlug]);

  const supportMutation = useMutation({
    mutationFn: (id) => reportsApi.upvote(id),
    onSuccess: (data, id) => onSupport(id, data.upvoteCount),
  });

  if (!location || isLoading || matches.length === 0) return null;

  const anySupported = matches.some((m) => supported.has(m.id));

  return (
    <div className="nearby card stack">
      <div>
        <h3 style={{ margin: 0 }}>Nearby existing reports</h3>
        <p className="field-hint" style={{ margin: '4px 0 0' }}>
          Is your problem already here? Support an existing report instead of creating a duplicate.
        </p>
      </div>

      {anySupported && (
        <div className="alert alert-ok">Thanks — we recorded that this affects you too.</div>
      )}

      <div className="report-list">
        {matches.map((m) => {
          const count = supported.get(m.id) ?? m.upvoteCount;
          const isSupported = supported.has(m.id);
          const sameCat = categorySlug && m.categorySlug === categorySlug;
          const pending = supportMutation.isPending && supportMutation.variables === m.id;
          return (
            <div className="report-item card" key={m.id}>
              <div className="stack" style={{ gap: 4 }}>
                <h4 style={{ margin: 0 }}>
                  {m.title}
                  {sameCat && <span className="pill status-accepted" style={{ marginLeft: 8 }}>Same category</span>}
                </h4>
                <div className="report-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <StatusPill status={m.status} />
                  <span>{formatDistance(m.distance)}</span>
                  <span>· 👥 {count} affected</span>
                </div>
              </div>
              <div className="stack nearby-actions" style={{ gap: 6 }}>
                <Link className="btn btn-sm" to={`/reports/${m.id}`} target="_blank" rel="noreferrer">
                  View details
                </Link>
                <button
                  type="button"
                  className={`btn btn-sm ${isSupported ? '' : 'btn-primary'}`}
                  onClick={() => supportMutation.mutate(m.id)}
                  disabled={isSupported || pending}
                >
                  {isSupported ? '✓ You’re affected too' : 'I have this problem too'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" className="btn btn-ghost" onClick={onContinue}>
        None of these – continue my report →
      </button>
    </div>
  );
}

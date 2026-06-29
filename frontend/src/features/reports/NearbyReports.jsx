import { useMemo, useState } from 'react';
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
// is provided (Category step onward), only same-category reports are shown by default; other nearby
// reports are hidden behind an opt-in toggle so they don't distract from the duplicate check.
// Never blocks the flow — it only surfaces existing reports the citizen can support instead of
// filing a duplicate.
export default function NearbyReports({ location, categorySlug, onContinue, supported, onSupport }) {
  // Round the key to ~11 m so nudging the pin doesn't trigger a refetch storm.
  const keyLat = location ? location.lat.toFixed(4) : null;
  const keyLng = location ? location.lng.toFixed(4) : null;
  const [showOther, setShowOther] = useState(false);

  const { data: features = [], isLoading } = useQuery({
    queryKey: ['nearby-reports', keyLat, keyLng],
    queryFn: () => mapApi.nearbyReports(bboxAround(location, BBOX_PAD_M)),
    enabled: !!location,
  });

  const { sameCategory, otherCategory } = useMemo(() => {
    if (!location) return { sameCategory: [], otherCategory: [] };
    const all = features
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
      .sort((a, b) => a.distance - b.distance);

    if (!categorySlug) return { sameCategory: all.slice(0, MAX_RESULTS), otherCategory: [] };

    const same = all.filter((m) => m.categorySlug === categorySlug);
    const other = all.filter((m) => m.categorySlug !== categorySlug);
    return { sameCategory: same.slice(0, MAX_RESULTS), otherCategory: other.slice(0, MAX_RESULTS) };
  }, [features, location, categorySlug]);

  const supportMutation = useMutation({
    mutationFn: (id) => reportsApi.upvote(id),
    onSuccess: (data, id) => onSupport(id, data.upvoteCount),
  });

  if (!location || isLoading) return null;
  if (sameCategory.length === 0 && otherCategory.length === 0) return null;

  const anySupported = [...sameCategory, ...(showOther ? otherCategory : [])]
    .some((m) => supported.has(m.id));

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

      {sameCategory.length > 0 && (
        <div className="report-list">
          {sameCategory.map((m) => (
            <NearbyReportItem key={m.id} report={m} categorySlug={categorySlug}
              supported={supported} pending={supportMutation.isPending && supportMutation.variables === m.id}
              onSupport={() => supportMutation.mutate(m.id)} />
          ))}
        </div>
      )}

      {sameCategory.length === 0 && otherCategory.length > 0 && !showOther && (
        <p className="muted" style={{ margin: 0 }}>
          No nearby reports in this category yet.
        </p>
      )}

      {otherCategory.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          {!showOther ? (
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => setShowOther(true)}>
              Show {otherCategory.length} other nearby report{otherCategory.length > 1 ? 's' : ''} (different category)
            </button>
          ) : (
            <>
              <div className="report-meta" style={{ marginTop: 4 }}>Other nearby reports (different category):</div>
              <div className="report-list">
                {otherCategory.map((m) => (
                  <NearbyReportItem key={m.id} report={m} categorySlug={null}
                    supported={supported} pending={supportMutation.isPending && supportMutation.variables === m.id}
                    onSupport={() => supportMutation.mutate(m.id)} />
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => setShowOther(false)}>
                Hide other reports
              </button>
            </>
          )}
        </div>
      )}

      <button type="button" className="btn btn-ghost" onClick={onContinue}>
        None of these – continue my report →
      </button>
    </div>
  );
}

function NearbyReportItem({ report, categorySlug, supported, pending, onSupport }) {
  const count = supported.get(report.id) ?? report.upvoteCount;
  const isSupported = supported.has(report.id);
  const sameCat = categorySlug && report.categorySlug === categorySlug;
  return (
    <div className="report-item card">
      <div className="stack" style={{ gap: 4 }}>
        <h4 style={{ margin: 0 }}>
          {report.title}
          {sameCat && <span className="pill status-accepted" style={{ marginLeft: 8 }}>Same category</span>}
        </h4>
        <div className="report-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <StatusPill status={report.status} />
          <span>{formatDistance(report.distance)}</span>
          <span>· 👥 {count} affected</span>
        </div>
      </div>
      <div className="stack nearby-actions" style={{ gap: 6 }}>
        <Link className="btn btn-sm" to={`/reports/${report.id}`} target="_blank" rel="noreferrer">
          View details
        </Link>
        <button
          type="button"
          className={`btn btn-sm ${isSupported ? '' : 'btn-primary'}`}
          onClick={onSupport}
          disabled={isSupported || pending}
        >
          {isSupported ? '✓ You’re affected too' : 'I have this problem too'}
        </button>
      </div>
    </div>
  );
}

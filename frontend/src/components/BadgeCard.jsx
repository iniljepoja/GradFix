// Gamification badge display: current rank + progress toward the next one.
export default function BadgeCard({ reportCount = 0, badge, nextBadge }) {
  const pct = nextBadge
    ? Math.min(100, Math.round((reportCount / nextBadge.at) * 100))
    : 100;

  return (
    <div className="card stack">
      <h2>Your badge</h2>
      <div>
        {badge
          ? <span className="badge">🏅 {badge.title}</span>
          : <span className="badge badge-none">No badge yet</span>}
      </div>
      <p className="muted">{reportCount} report{reportCount === 1 ? '' : 's'} filed</p>
      {nextBadge ? (
        <>
          <div className="progressbar"><span style={{ width: `${pct}%` }} /></div>
          <p className="muted">
            {nextBadge.at - reportCount} more to reach <strong>{nextBadge.title}</strong>
          </p>
        </>
      ) : (
        <p className="muted">Top rank reached — thank you for looking after your city! 🎉</p>
      )}
    </div>
  );
}

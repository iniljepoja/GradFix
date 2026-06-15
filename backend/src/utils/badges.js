// Gamification badges, awarded by the user's accepted report count (internship spec).
const RANKS = [
  { rank: 1, title: 'New Fellow Citizen', min: 1 },
  { rank: 2, title: 'Active Citizen', min: 5 },
  { rank: 3, title: 'City Guardian', min: 15 },
  { rank: 4, title: 'Neighborhood Hero', min: 30 },
  { rank: 5, title: 'City Ambassador', min: 50 },
  { rank: 6, title: 'City Lover', min: 100 },
];

/** Returns the highest badge earned for a given report count, plus progress to the next rank. */
export function badgeForCount(count) {
  let current = null;
  let next = null;
  for (const r of RANKS) {
    if (count >= r.min) current = r;
    else { next = r; break; }
  }
  return {
    reportCount: count,
    badge: current ? { rank: current.rank, title: current.title } : null,
    nextBadge: next ? { rank: next.rank, title: next.title, at: next.min } : null,
  };
}

# GradFix — 6-Week Roadmap

Aligned to the internship program milestones. Each week ends with something demonstrable.

| Week | Focus              | Status |
| ---- | ------------------ | ------ |
| 1    | Setup & Planning   | ✅ done |
| 2    | Backend core       | ✅ accepted feature-complete |
| 3    | Frontend — Citizens | ✅ done |
| 4    | Admin panel        | planned |
| 5    | Integration        | planned |
| 6    | Polish & Demo      | planned |

## Week 1 — Setup & Planning ✅
- Backend (Express) + frontend (Vite/React) scaffolding, linting, `.env` handling.
- Docker Compose PostgreSQL; migration runner + seed.
- `001_init.sql`, tenant resolution middleware, shared `pg` pool, `ApiError`, error handler, `GET /health`.
- Architecture, DB schema, ERD, API spec, gap analysis docs.

## Week 2 — Backend core ✅
Complete, spec-aligned REST API + schema (see API.md / DATABASE.md).
- **Schema alignment**: status lifecycle `new→accepted→assigned→in_progress→resolved→closed`; role
  system (citizen/reviewer/conductor/community_manager/tenant_admin/super_admin); responsible
  entities, routing, ratings, comments, push subscriptions; spec category taxonomy seed.
- **Auth**: register, login, JWT access + rotating refresh, email verification, password reset, `/me`.
- **Citizen flow**: report create (verified-gated), photo upload (max 3, compressed), `/reports/mine`,
  resolution rating, upvoting, status-change email notifications, gamification badges.
- **Admin core**: `/admin` report management (filter/search, status, priority, assign, merge,
  internal comments), responsible-entity CRUD + category routing, category/subcategory CRUD,
  user role management, dashboard analytics.
- **Public**: report list, detail, history, GeoJSON map (bbox), statistics dashboard.
- **Deliverable**: the full backend contract the citizen + admin frontends build against. ✅

## Week 3 — Frontend (Citizens) ✅
The citizen-facing PWA, built against the Week 2 API.
- **PWA foundations**: `vite-plugin-pwa` service worker (auto-update) with basemap-tile caching;
  generated app icons (`scripts/generate-icons.mjs`); `beforeinstallprompt` install banner and an
  offline indicator (`InstallPrompt` / `OfflineIndicator` in the layout).
- **Auth UI**: register, login, email verification, forgot/reset password; session restore via
  refresh token; verified-gated routes.
- **Profile + history**: dashboard with profile, gamification badge, and the user's report list.
- **Report creation flow**: 5-step wizard — photos (mandatory, max 3, client-side canvas
  compression) → GPS auto-locate + draggable map pin → category/subcategory → title/description/
  priority → review/submit. Auto-refreshes dashboard + badge on success.
- **Duplicate prevention**: the wizard's `NearbyReports` panel (Location + Category steps) surfaces
  nearby existing reports and lets a citizen "support" one ("I have this problem too") instead of
  filing a duplicate — reuses the map bbox + upvote endpoints, never blocks the flow.
- **Public map**: report markers refetched per visible bounding box on pan/zoom (`moveend`,
  debounced); popups link to report detail. CARTO Voyager basemap (Latin labels) + inline-SVG pins.
- **Report detail + upvote**: photos, description, location, and status-history timeline; optimistic
  upvote with server reconciliation (logged-out users are routed to login).
- **Public stats dashboard**: read-only `/stats` view — totals, resolved %, and by-status /
  by-category breakdowns.
- **Localization/branding**: defaults to the `subotica` tenant; light-purple theme; demo seed with
  12 Subotica/Palić reports (varied categories, priorities, statuses, support counts).
- **Deliverable**: a citizen can register, verify, and file a complete report from the PWA. ✅
- _Fixes during Week 3_: PWA build (pinned `serialize-javascript` ^6 via `overrides`); `/map/reports`
  500 (ambiguous `tenant_id` — qualified report columns with `r.`); invisible markers (Leaflet/Vite
  default-icon URL resolution).
- _Known follow-ups_: detail page can't show whether the current user already upvoted (no
  `hasUpvoted` flag on the public endpoint); frontend unit tests deferred to Week 5.

## Week 4 — Admin panel
- Admin dashboard UI over `/admin`: report queue (filters/search), status & priority management,
  assignment, duplicate merge, internal comments, category/entity/routing configuration, user roles.
- Work orders: PDF generation + email delivery to the assigned entity (backend + UI).
- **Deliverable**: municipality staff triage and resolve reports end-to-end.

## Week 5 — Integration
- Wire push notification delivery (VAPID/Web Push) on top of the stored subscriptions.
- CSV/Excel export of reports/analytics; heat-map layer on the public map.
- End-to-end + tenant-isolation tests, bug fixes, performance pass (image lazy-loading, FCP/TTI).

## Week 6 — Polish & Demo
- Accessibility, responsive polish, i18n wiring, security review, deployment to staging.
- Final presentation (≤10 slides, 15-min live demo).

## Cross-cutting (ongoing)
- Add a tenant-isolation test with every new tenant-scoped query.
- Keep `docs/` (schema, API, gap analysis) in sync with code.

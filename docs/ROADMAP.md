# GradFix — 6-Week Roadmap

Aligned to the internship program milestones. Each week ends with something demonstrable.

| Week | Focus              | Status |
| ---- | ------------------ | ------ |
| 1    | Setup & Planning   | ✅ done |
| 2    | Backend core       | ✅ accepted feature-complete |
| 3    | Frontend — Citizens | 🚧 in progress |
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

## Week 3 — Frontend (Citizens)
- PWA foundations: install/offline polish, auth UI (register/login/verify/reset), profile + history.
- Report creation flow: photo (mandatory, max 3, client-side compression) → GPS auto-locate + map
  pin → category/subcategory → description → priority → review/submit.
- Public map + report detail + upvote; public dashboard view of `/stats`.
- **Deliverable**: a citizen can register, verify, and file a complete report from the PWA.

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

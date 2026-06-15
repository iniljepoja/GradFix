# GradFix — 6-Week Development Roadmap

A pragmatic MVP plan. Each week ends with something demonstrable. Adjust scope, not quality.

## Week 1 — Foundations & multi-tenancy
- Repo scaffolding: backend (Express) + frontend (Vite/React), linting, `.env` handling.
- Docker Compose PostgreSQL; migration runner (`npm run migrate`) and seed script.
- Implement `001_init.sql` (tenants, users, tokens, categories, reports, photos, history, upvotes).
- Tenant resolution middleware (`X-Tenant` / subdomain) + `req.tenant`.
- Shared `pg` pool, `ApiError`, centralized error handler, success/error response contract.
- `GET /health`.
- **Deliverable**: server boots, DB migrated/seeded, tenant resolution working, health check green.

## Week 2 — Authentication & email verification
- Registration (bcrypt), login, JWT access + hashed/rotating refresh tokens, `/refresh`, `/logout`.
- `authenticate` + `authorize(role)` middleware (RBAC).
- Email verification flow (hashed single-use tokens) + mailer (dev: console/Ethereal).
- Password reset flow.
- Frontend: API client with token injection + 401→refresh retry; register/login/verify pages.
- **Deliverable**: a user can register, verify email, log in, and stay authenticated across refresh.

## Week 3 — Categories & report creation
- Category/subcategory listing endpoints + admin CRUD; seed default categories per tenant.
- `POST /reports` with validation; photo upload (`multer`, local storage) + `report_photos`.
- GPS capture on the frontend (geolocation API) + manual pin adjustment on a Leaflet picker.
- Report creation form (category select, description, photo, location).
- **Deliverable**: a verified citizen can submit a report with category, photos, and GPS location.

## Week 4 — Report browsing, status tracking & upvoting
- `GET /reports` (filters, sorting, pagination), `GET /reports/:id`, `GET /:id/history`.
- Status transition endpoint writing `report_status_history`; status timeline UI.
- Upvote/unvote endpoints (idempotent, denormalized count) + optimistic UI.
- Report list + detail pages; "my reports" view.
- **Deliverable**: reports are browsable, upvotable, and show a status history timeline.

## Week 5 — Public map & PWA
- `GET /map/reports` GeoJSON-by-bbox endpoint.
- Leaflet + OSM map with marker clustering, status-colored pins, popup → report detail.
- PWA: manifest, service worker (app shell + tile caching), installability, offline draft queue.
- **Deliverable**: installable PWA with a public map of reports; basic offline support.

## Week 6 — Admin panel, hardening & deployment
- Admin dashboard: report queue, status management, stats (counts, resolution time), user roles.
- Super-admin tenant management.
- Rate limiting on auth/write routes, security headers, input-validation pass, seed data review.
- Test pass (auth, reports, tenancy isolation), CI lint+test, deployment docs / first deploy.
- **Deliverable**: municipality staff can triage and resolve reports; app deployed to a staging env.

## Cross-cutting (ongoing)
- **Tenant isolation tests** every time a new tenant-scoped query is added.
- Keep `docs/` (schema, API) in sync with code changes.
- Accessibility and responsive design as features land, not at the end.

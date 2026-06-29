# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GradFix is a multi-tenant PWA for reporting urban infrastructure problems. Citizens file geo-located
reports with photos; municipalities resolve them via an admin panel. One deployment serves many
municipalities (tenants).

- **Backend**: Node.js + Express REST API (`backend/`)
- **Frontend**: React (Vite) PWA with Leaflet/OpenStreetMap (`frontend/`)
- **Database**: PostgreSQL

## Commands

All backend commands run from `backend/`, all frontend commands from `frontend/`.

```bash
# Database (from repo root)
docker compose up -d            # start local PostgreSQL on :5432

# Backend
npm run dev                     # nodemon dev server (:4000)
npm start                       # production server
npm run migrate                 # apply SQL migrations in src/db/migrations
npm run seed                    # load demo tenant, admin user, categories
npm test                        # run all tests (node --test)
npm test -- <file>              # run a single test file
npm run lint                    # eslint

# Frontend
npm run dev                     # Vite dev server (:5173)
npm run build                   # production build
npm run preview                 # preview production build
npm test                        # vitest
npm test -- <pattern>           # run tests matching pattern
npm run lint
```

## Architecture essentials

These are the cross-cutting concerns that span multiple files — read these before making changes.

### Multi-tenancy (shared DB, shared schema)
- Every tenant-scoped table carries a `tenant_id` (FK → `tenants`). There is **no separate database
  or schema per tenant** — isolation is enforced in the query layer, not by Postgres.
- The tenant is resolved per request by `middleware/tenant.js`, from the `X-Tenant` header or
  subdomain, and attached as `req.tenant`. **Every query against a tenant-scoped table must filter by
  `req.tenant.id`.** Forgetting this is the #1 source of cross-tenant data leaks.
- `super_admin` users are tenant-less (`users.tenant_id` may be null) and operate across tenants
  through `/api/v1/admin` routes.
- **Roles** (`user_role` enum): `citizen`, `reviewer`, `conductor`, `community_manager`,
  `tenant_admin`, `super_admin`. `authorize(...roles)` gates routes; `super_admin` always passes.

### Request pipeline (backend)
Order matters in `src/app.js`: `helmet` → `cors` → body parsing → `tenant` resolution → route →
route-level `authenticate` / `authorize(role)` → controller → centralized `errorHandler` (last).
Controllers throw `ApiError` (`utils/ApiError.js`); the error handler converts them to JSON. Never
`res.status().json()` an error directly from a controller.

### Auth
- JWT access token (short-lived, ~15 min) + refresh token (long-lived, stored hashed in
  `refresh_tokens`). `middleware/auth.js` verifies the access token and loads `req.user`.
- Email verification and password reset use single-use, hashed, expiring tokens
  (`email_verification_tokens`, `password_reset_tokens`). Plain tokens are emailed; only hashes are
  stored. Unverified citizens cannot log in or create reports; staff and super_admin bypass this.

### Reports & status lifecycle
- **Creation** (`POST /reports`) is `multipart/form-data` and **requires 1–3 photos** — enforced in
  `report.service.createReport`, which compresses photos, inserts the report + photo rows atomically,
  and **auto-routes**: `assigned_entity_id` is resolved from the category's `category_routes` entry.
- Admin assignment (`PATCH /admin/reports/:id/assign`) accepts an explicit `entityId` or, if omitted,
  falls back to the same category route.
- Status flow: `new → accepted → assigned → in_progress → resolved → closed` (with reopen
  `resolved → in_progress` and early-close paths). Allowed transitions are enforced by
  `STATUS_TRANSITIONS` / `assertTransition` in `services/report.service.js`.
- Every status change appends a row to `report_status_history` and may set `resolved_at` / `closed_at`
  — never mutate `reports.status` without going through `changeStatus` (records history + fires
  notifications). Use the report service, not direct UPDATEs.
- **Duplicate merge**: a duplicate report gets `duplicate_of_id` set to the canonical report and is
  moved to `closed`; it is not a status value.
- `reports.upvote_count` is **denormalized**. It is maintained alongside inserts/deletes in
  `upvotes` (within the same transaction). The `upvotes` table has a `UNIQUE(report_id, user_id)`.

### Spatial data
- Reports store `latitude`/`longitude` as `double precision`. The public map endpoint
  (`GET /api/v1/map/reports`) returns GeoJSON filtered by a bounding box. PostGIS is **not** required
  for the MVP; if added later, migrate to a `geography(Point)` column and update the map query.

### Frontend
- API access goes through `src/api/client.js` (a single axios wrapper that injects the
  `Authorization` header, the `X-Tenant` header — default tenant slug `subotica` — and handles
  401 → refresh-token retry). Do not call `fetch` directly from components. `assetUrl()` (same file)
  resolves photo `/uploads/...` paths against the API origin, since they're served outside `/api/v1`.
- Server state is fetched with `@tanstack/react-query`; auth/session lives in `context/AuthContext`.
  Features are grouped under `src/features/` (`auth`, `dashboard`, `reports`, `map`, `stats`).
- PWA: manifest is configured in `vite.config.js` + service worker (via `vite-plugin-pwa`). Map
  rendering is isolated in `src/features/map/` using react-leaflet; basemap tiles are CARTO Voyager
  (`features/map/tiles.js`) — chosen so Serbian place names render in **Latin**, not Cyrillic. The
  default Leaflet marker is replaced with an inline-SVG pin in `lib/leafletIcon.js` (the bundled-PNG
  icon URLs 404 under Vite).
- **Duplicate prevention**: the report wizard's `NearbyReports` panel (Location + Category steps)
  reuses `GET /map/reports` (bbox) to surface nearby existing reports and lets a citizen "support" one
  via the existing upvote endpoint instead of filing a duplicate. UI says "affected citizens", never
  "upvotes" — same denormalized `upvote_count` underneath.

## Conventions

- API is versioned under `/api/v1`. Responses use `{ data, meta }` on success and
  `{ error: { code, message, details } }` on failure.
- Validation lives at the route boundary (a `validate(schema)` middleware), not in controllers.
- DB access is parameterized queries through the shared `pg` pool (`src/config/db.js`). No ORM;
  no string-interpolated SQL.
- Migrations are plain `.sql` files in `src/db/migrations`, applied in filename order. Add a new
  numbered file; never edit an applied migration.

## Docs

Authoritative specs live in `docs/` (`ARCHITECTURE.md`, `DATABASE.md`, `ERD.md`, `API.md`,
`ROADMAP.md`). Keep them in sync when changing the schema or API surface.

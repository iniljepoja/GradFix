# GradFix — System Architecture

## 1. Overview

GradFix is a multi-tenant Progressive Web Application that lets citizens report urban infrastructure
problems and lets municipalities triage and resolve them. A single backend deployment and a single
PostgreSQL database serve many municipalities ("tenants").

```
                         ┌─────────────────────────────┐
                         │   Client (React PWA)         │
                         │   - Service Worker / offline │
                         │   - Leaflet + OSM map        │
                         └──────────────┬──────────────┘
                                        │ HTTPS, JSON
                                        │ Authorization: Bearer <jwt>
                                        │ X-Tenant: <slug>
                         ┌──────────────▼──────────────┐
                         │   Express REST API           │
                         │   /api/v1/*                  │
                         │  ┌────────────────────────┐  │
                         │  │ helmet → cors → parse   │  │
                         │  │ → tenant → auth         │  │
                         │  │ → validate → controller │  │
                         │  │ → errorHandler          │  │
                         │  └────────────────────────┘  │
                         └───────┬───────────────┬──────┘
                                 │               │
                   ┌─────────────▼──┐    ┌───────▼────────┐
                   │  PostgreSQL    │    │ Object/file    │
                   │  (shared DB,   │    │ storage        │
                   │  tenant_id)    │    │ (photos)       │
                   └────────────────┘    └────────────────┘
                                 │
                         ┌───────▼────────┐
                         │  Email service │
                         │ (verification, │
                         │  password reset)│
                         └────────────────┘
```

## 2. Multi-tenancy model

**Strategy: shared database, shared schema, discriminator column.**

- Every tenant-scoped table has a `tenant_id` foreign key to `tenants`.
- Tenant isolation is enforced in the **application query layer**, not by separate databases or
  Postgres schemas. This keeps operations (migrations, backups, pooling) simple for the MVP and scales
  to thousands of small tenants.
- **Tenant resolution** (`middleware/tenant.js`) runs early in the request pipeline and resolves the
  active tenant from, in order of precedence:
  1. `X-Tenant` request header (slug) — used by the SPA.
  2. Subdomain (e.g. `zagreb.gradfix.app` → slug `zagreb`).
  The resolved tenant is attached to `req.tenant`. Requests to tenant-scoped routes with an unknown or
  missing tenant are rejected with `404 TENANT_NOT_FOUND`.
- **Every query** touching a tenant-scoped table must include `WHERE tenant_id = $1`. This is the
  primary isolation guarantee; a future hardening step is enabling PostgreSQL Row-Level Security with
  a `SET app.tenant_id` per connection.
- **Super admins** (`users.role = 'super_admin'`) are platform operators. They are tenant-less and
  manage tenants, global category templates, and cross-tenant analytics through dedicated routes.

### Roles
| Role          | Scope          | Capabilities                                                       |
| ------------- | -------------- | ----------------------------------------------------------------- |
| `citizen`     | one tenant     | create reports, upvote, comment, view own reports                 |
| `moderator`   | one tenant     | triage reports, change status, merge duplicates                   |
| `admin`       | one tenant     | moderator + manage categories, users, tenant settings             |
| `super_admin` | platform-wide  | manage tenants and global templates                               |

## 3. Backend architecture

Layered, framework-light Express app. No ORM — parameterized SQL through a shared `pg` pool.

```
HTTP → Router → Middleware (auth/tenant/validate) → Controller → Service → Repository (SQL) → PostgreSQL
```

- **Routers** (`src/routes`) define endpoints and attach middleware.
- **Middleware** (`src/middleware`): `tenant`, `auth` (JWT), `authorize` (RBAC), `validate` (schema),
  `errorHandler`, `rateLimiter`, `upload` (multer).
- **Controllers** (`src/controllers`) parse the request, call a service, shape the response. They
  contain no SQL.
- **Services** (`src/services`) hold business rules (status transitions, upvote counting, token
  issuance) and own transactions.
- **Repositories** (`src/repositories`) are the only place SQL lives.
- **Cross-cutting**: `config` (env, db pool, logger), `utils` (`ApiError`, JWT, hashing, mailer).

### Error & response contract
- Success: `{ "data": <payload>, "meta": <pagination/extra> }`
- Failure: `{ "error": { "code": "STRING_CODE", "message": "...", "details": [...] } }`
- Controllers `throw new ApiError(status, code, message)`; the centralized `errorHandler` serializes it.

## 4. Authentication & security

- **Tokens**: short-lived JWT access token (~15 min) + opaque/long-lived refresh token. Refresh tokens
  are stored **hashed** in `refresh_tokens` and rotated on use; logout revokes them.
- **Passwords**: bcrypt (cost ≥ 12).
- **Email verification**: on registration a single-use, hashed, time-limited token is emailed.
  Unverified accounts may sign in but cannot create reports.
- **Password reset**: same single-use hashed-token pattern via `password_reset_tokens`.
- **Transport/headers**: `helmet`, strict CORS allowlist, rate limiting on auth + write endpoints.
- **Input validation** at the route boundary; parameterized SQL everywhere (no string interpolation).

## 5. Frontend architecture

- **React + Vite**, feature-folder organization (`src/features/<domain>`).
- **PWA**: `vite-plugin-pwa` generates the service worker and manifest; app shell + map tiles are
  cached, report drafts can be queued offline and synced when back online.
- **State**: server state via React Query (caching, retries, optimistic upvotes); local UI state via
  React context/hooks.
- **API layer**: a single client (`src/api/client.js`) injects auth + `X-Tenant` headers and performs
  401 → refresh → retry. Components never call `fetch` directly.
- **Maps**: `react-leaflet` over OpenStreetMap tiles; clustering for dense report sets.

## 6. Photo storage

- Uploads handled by `multer`. MVP: local disk (`backend/uploads/`, served statically).
- Production: pluggable storage adapter targeting S3-compatible object storage; the DB stores only a
  storage key + metadata, never the binary.

## 7. Environments & deployment

- **Local**: Docker Compose Postgres + Adminer; backend and frontend run via their dev servers.
- **Production**: backend behind a reverse proxy (TLS termination, gzip), frontend served as static
  assets/CDN, managed PostgreSQL, object storage for photos, transactional email provider.

# GradFix — Gap Analysis

Comparison of the **Studio Present GradFix Internship Program** specification against the current
repository (end of Week 1 / scaffolding). "Implemented" means working code, not just documentation.

> Source spec: `GradFix-Internship-Program.pdf` (30 working days, 6 weekly milestones).
> Per the program's milestones, **Week 2 = "Backend core: API endpoints, database schema."** This
> analysis is scoped to drive that week.

Legend: ✅ implemented · 🟡 partial · ❌ missing

---

## 1. Implemented requirements ✅

These are coded and functional in the backend.

| Requirement (spec) | Where | Notes |
| --- | --- | --- |
| Multi-tenant architecture, data isolation per city | `middleware/tenant.js`, `tenant_id` on all scoped tables | Shared-DB + `tenant_id`; resolved via `X-Tenant`/subdomain |
| Mandatory registration with valid email | `auth.service.register`, `auth.routes` | Email format validated (Zod) |
| Email verification | `auth.service.verifyEmail`, hashed single-use tokens | Unverified users blocked from creating reports |
| Forgotten-password flow | `auth.service.requestPasswordReset` / `resetPassword` | Hashed, expiring, single-use tokens |
| REST API + PostgreSQL | `backend/`, `db/migrations/001_init.sql` | Versioned `/api/v1`, parameterized SQL, no ORM |
| Report creation (text, category, GPS coords, priority) | `report.service.create`, `reports.routes` | Accepts lat/lng + priority; category ownership checked |
| Public map of reports (anonymous, no auth) | `map.routes` `GET /map/reports` | GeoJSON by bounding box |
| Upvote system ("I have this too") | `report.service.upvote` / `removeUpvote` | Idempotent, denormalized count, transactional |
| Report status changes (with audit history) | `report.service.changeStatus`, `report_status_history` | Append-only history per change |
| Security: input validation | `middleware/validate.js` (Zod) | At route boundary |
| Security: SQL-injection protection | parameterized queries everywhere | No string-interpolated SQL |
| Security: rate limiting | `app.js` (`express-rate-limit`) | Global `/api` limiter |
| Security headers / XSS baseline | `helmet`, React auto-escaping | |
| PWA manifest + service worker + Add to Home Screen | `frontend/vite.config.js` (`vite-plugin-pwa`) | Manifest + SW generated; OSM tile caching |

---

## 2. Partially implemented requirements 🟡

Foundations exist but the feature is incomplete or diverges from the spec.

| Requirement (spec) | Current state | Gap to close |
| --- | --- | --- |
| **Report status lifecycle**: New → Accepted → Assigned → In progress → Resolved → Closed | Enum is `submitted, acknowledged, in_progress, resolved, rejected, duplicate` | Re-map enum to the spec's 6 states (add **Assigned**, **Closed**; rename New/Accepted); update history + transitions |
| **Role system**: Super Admin, Tenant Admin, Reviewer, Conductor, Community Manager | Enum is `citizen, moderator, admin, super_admin` | Add **Reviewer**, **Conductor**, **Community Manager**; map admin→Tenant Admin; wire per-role permissions |
| **Photo upload** (mandatory, max 3, compressed) | `report_photos` table exists; `multer` in deps; route is a TODO stub (`reports.routes.js:88`) | Implement upload endpoint, enforce max 3 + required, add compression, store + serve |
| **Profile with report history** | `GET /auth/me` returns profile only | Add "my reports" endpoint (reports filtered by `reporter_id`) |
| **Categories** (the 5 spec categories + subcategories) | Listing endpoints work; seed has *Roads/Lighting/Waste/Signage* | Reseed to spec taxonomy: Urban furniture, Public lighting, Traffic infrastructure, Vegetation, Other (with listed subcategories) |
| **Admin report management** (overview, filters, search) | Public `GET /reports` supports filters/search/pagination; `authorize()` exists; `/admin` router is a TODO (`routes/index.js:14`) | Build `/admin` routes (admin-scoped listing incl. private fields, priority updates) |
| **Automatic GPS location** | Backend accepts lat/lng; frontend has no geolocation capture | Add browser geolocation + map pin in the citizen create flow (Week 3 frontend, but API is ready) |
| **Configuration: category/subcategory management** | Read endpoints only; admin CRUD is a documented TODO | Add admin create/update/deactivate for categories + subcategories |
| **PWA offline (view your own reports)** | Service worker caches app shell + OSM tiles | Add offline caching/queue for the user's own reports + draft submission |

---

## 3. Missing requirements ❌

Not present in code or schema.

### Citizen app
- **Push / Email notifications on status change** (mailer exists, but no notification is sent on transitions)
- **Resolution rating** (satisfied / unsatisfied + comment) — no table or endpoint
- **Public map: confirm "still present / resolved"** by other citizens
- **Gamification — badges** (6 ranks by report count) — no schema or logic
- **Public dashboard / statistics** (reports per category, % resolved, heat map) — no public stats endpoint

### Admin panel (City Government)
- **Assignment to responsible entity** (utility companies, NGOs, citizen groups) — no entities table/relation
- **Duplicate merging** (status `duplicate` exists, but no merge operation/linkage)
- **Internal comments** (admin-only) — no table/endpoint
- **Automatic routing** (category → responsible org) — not modeled
- **Work orders** — PDF generation + email delivery to responsible entity
- **Notification settings** (per tenant)
- **Multi-language preparation (i18n core)**
- **Reporting/analytics**: reports per period, average resolution time, most-affected areas (heat map), most-burdened utilities, active reporters, **CSV/Excel export**

### Non-functional
- **Performance targets** (FCP < 2s, TTI < 3s), image compression before upload, lazy-loaded report list
- **Push notifications** (Web Push subscription, VAPID keys, SW push handlers)
- **Accessibility** (large fonts, high contrast, simple navigation, minimal steps)
- **Responsive design** (mobile-first; tablet; desktop admin) — frontend is a minimal shell
- **HTTPS** (deployment/infra concern; documented in ARCHITECTURE, not provisioned)

### Frontend (citizen app — Week 3 milestone, noted for completeness)
- Auth UI (register, login, verify, reset), report-creation flow (photo → GPS → category → description →
  priority → review), report list/detail, profile/history. Only a routing shell + read-only map exist.

---

## 4. Week 2 priorities — Backend core

Goal for the milestone: a **complete, spec-aligned backend API + schema** so the Week 3 citizen PWA
can be built against a stable contract. Ordered by impact on the core citizen flow and downstream work.

### P0 — Schema alignment (do first; everything else depends on it)
1. **Status lifecycle migration** (`002_status_lifecycle.sql`): re-map `report_status` to
   `new, accepted, assigned, in_progress, resolved, closed`. Update default, `changeStatus`,
   allowed-transition logic, and the status-history wiring.
2. **Role system migration** (`003_roles.sql`): extend `user_role` to
   `citizen, reviewer, conductor, community_manager, tenant_admin, super_admin`; update
   `authorize()` and seed.
3. **Category taxonomy**: reseed to the 5 spec categories + their subcategories (`seed.js`).

### P1 — Complete the citizen reporting flow (backend)
4. **Photo upload**: implement `POST /reports/:id/photos` with `multer`, enforce **mandatory + max 3**,
   server-side compression, persist to `report_photos`, serve via `/uploads` (or S3 adapter).
5. **Profile report history**: `GET /reports?mine=true` (or `/auth/me/reports`) scoped to `reporter_id`.
6. **Resolution rating**: add `report_ratings` table (satisfied/unsatisfied + comment) + endpoint,
   allowed once a report is `resolved`.
7. **Notifications on status change**: send email on transition (reuse `mailer`); lay the table/skeleton
   for push (Web Push subscriptions) without full delivery yet.

### P2 — Admin core API (`/api/v1/admin`)
8. **Wire the `/admin` router** with role-gated routes: admin report listing (filters/search, private
   fields), **priority updates**, **internal comments** (`report_comments`, admin-only), and
   **duplicate merge** (link duplicates → canonical report).
9. **Category/subcategory admin CRUD** (create/update/deactivate).
10. **Responsible entities + routing**: `responsible_entities` table, `category → entity` routing config,
    report **assignment** endpoint (enables Work Orders in Week 4).

### P3 — Public stats (unblocks the public dashboard in Week 3/4)
11. **Public statistics endpoint**: counts per category, % resolved, totals — no auth required.

### Explicitly deferred (not Week 2)
- Gamification badges (schema can be sketched now; logic later), Work-order PDF generation,
  CSV/Excel export, i18n, full Web Push delivery, and all citizen/admin **frontend** UI (Week 3–4).

### Suggested migration/PR sequence
`002_status_lifecycle` → `003_roles` → `004_photos_ratings_comments` → `005_entities_routing` →
seed refresh → admin router + endpoints → public stats. Add tenant-isolation tests with each new
tenant-scoped query.

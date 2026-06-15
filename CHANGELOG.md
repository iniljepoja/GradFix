# Changelog

## Week 2 — Backend core ✅ (accepted feature-complete)

Spec-aligned REST API + PostgreSQL schema. See `docs/API.md`, `docs/DATABASE.md`, `docs/GAP_ANALYSIS.md`.

- **Schema** (`001_init.sql`): status lifecycle `new→accepted→assigned→in_progress→resolved→closed`;
  roles `citizen/reviewer/conductor/community_manager/tenant_admin/super_admin`; `responsible_entities`,
  `category_routes`, `report_ratings`, `report_comments`, `push_subscriptions`; report
  `assigned_entity_id`/`duplicate_of_id`/`closed_at`.
- **Auth**: register, login, JWT access + rotating refresh, email verification, password reset, `/me`.
- **Citizen reporting**: multipart `POST /reports` with **mandatory 1–3 compressed photos**, GPS,
  category/subcategory, description, priority; **automatic category→entity routing**; report history
  (`/reports/mine`), status-change email notifications, resolution rating, upvoting, gamification badges.
- **Admin core** (`/admin`): report management (filter/search, status, priority, assign, duplicate
  merge, internal comments), responsible-entity CRUD + routing, category/subcategory CRUD, user roles.
- **Public**: report list/detail/history, GeoJSON map (bbox), statistics dashboard.

**Known limitations carried forward** (later milestones): Web Push delivery, work-order PDFs,
CSV/Excel export, heat-map aggregation, citizen "still present" confirmation, tenant notification
settings, i18n. Test coverage is minimal (one unit test); not yet run against a live database.

## Week 1 — Setup & planning ✅
Backend + frontend scaffolding, Docker Postgres, migration/seed runner, architecture/DB/ERD/API docs.

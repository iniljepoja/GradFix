# GradFix — PostgreSQL Database

The authoritative schema lives in `backend/src/db/migrations/`. This document explains intent and
design decisions; the SQL below mirrors `001_init.sql`.

## Conventions

- Primary keys are `UUID` defaulted with `gen_random_uuid()` (requires the `pgcrypto` extension).
- Timestamps are `timestamptz`, defaulting to `now()`.
- Enumerated values use native `CREATE TYPE ... AS ENUM`.
- Tenant-scoped tables carry a `tenant_id` FK and are indexed on it.
- Tables are written assuming application-layer tenant filtering (see ARCHITECTURE.md).

## Extensions & enums

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM
  ('citizen', 'reviewer', 'conductor', 'community_manager', 'tenant_admin', 'super_admin');

CREATE TYPE report_status AS ENUM
  ('new', 'accepted', 'assigned', 'in_progress', 'resolved', 'closed');

CREATE TYPE report_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE entity_type AS ENUM ('company', 'ngo', 'informal_group', 'department');
```

Status lifecycle (enforced by `assertTransition` in `report.service.js`):
`new → accepted → assigned → in_progress → resolved → closed`, plus reopen (`resolved → in_progress`)
and early-close from any non-terminal state. Duplicates are not a status — a duplicate report sets
`duplicate_of_id` and moves to `closed`.

## Tables

### tenants
```sql
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  center_lat  DOUBLE PRECISION,
  center_lng  DOUBLE PRECISION,
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### users
```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL for super_admin
  email             TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  role              user_role NOT NULL DEFAULT 'citizen',
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
```

### email_verification_tokens / password_reset_tokens / refresh_tokens
```sql
CREATE TABLE email_verification_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evt_user ON email_verification_tokens(user_id);

CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prt_user ON password_reset_tokens(user_id);

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rt_user ON refresh_tokens(user_id);
```

### categories / subcategories
```sql
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);
CREATE INDEX idx_categories_tenant ON categories(tenant_id);

CREATE TABLE subcategories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (category_id, slug)
);
CREATE INDEX idx_subcategories_category ON subcategories(category_id);
```

### responsible_entities
Companies / NGOs / informal groups / departments that reports are routed and assigned to.
```sql
CREATE TABLE responsible_entities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        entity_type NOT NULL DEFAULT 'company',
  email       TEXT,
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
```

### reports
```sql
CREATE TABLE reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reporter_id        UUID REFERENCES users(id) ON DELETE SET NULL,   -- NULL = anonymous
  category_id        UUID NOT NULL REFERENCES categories(id),
  subcategory_id     UUID REFERENCES subcategories(id),
  title              TEXT NOT NULL,
  description        TEXT,
  status             report_status NOT NULL DEFAULT 'new',
  priority           report_priority NOT NULL DEFAULT 'medium',
  latitude           DOUBLE PRECISION NOT NULL,
  longitude          DOUBLE PRECISION NOT NULL,
  address            TEXT,
  upvote_count       INTEGER NOT NULL DEFAULT 0,
  assigned_entity_id UUID REFERENCES responsible_entities(id) ON DELETE SET NULL,
  duplicate_of_id    UUID REFERENCES reports(id) ON DELETE SET NULL,  -- set when merged as a duplicate
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at        TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ
);
-- indexes: tenant, (tenant,status), category, reporter, (lat,lng), assigned_entity_id, duplicate_of_id
```

### report_photos
Mandatory at creation, **max 3 per report**, compressed server-side (`sharp`, with a no-op fallback).
```sql
CREATE TABLE report_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  url         TEXT,
  width       INTEGER,
  height      INTEGER,
  size_bytes  INTEGER,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_report_photos_report ON report_photos(report_id);
```

### report_status_history
```sql
CREATE TABLE report_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  from_status report_status,
  to_status   report_status NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_history_report ON report_status_history(report_id);
```

### upvotes
```sql
CREATE TABLE upvotes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);
CREATE INDEX idx_upvotes_report ON upvotes(report_id);
```

### category_routes
Default responsible entity per category (automatic routing); one route per category.
```sql
CREATE TABLE category_routes (
  category_id           UUID PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
  responsible_entity_id UUID NOT NULL REFERENCES responsible_entities(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### report_ratings
Reporter's resolution rating; one per report, allowed once the report is `resolved`.
```sql
CREATE TABLE report_ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  rated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  satisfied  BOOLEAN NOT NULL,
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id)
);
```

### report_comments
Admin-only internal comments by default (`is_internal = TRUE`).
```sql
CREATE TABLE report_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### push_subscriptions
Web Push (VAPID) subscription store. Email notifications run now; push delivery is deferred.
```sql
CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
```

## Notes

- **`updated_at`**: maintained either by the application or a shared `BEFORE UPDATE` trigger
  (`001_init.sql` installs a `set_updated_at()` trigger on `tenants`, `users`, `reports`).
- **Spatial queries**: the public map filters reports by a bounding box on `latitude`/`longitude`.
  For high volume, migrate to PostGIS (`geography(Point, 4326)` + GiST index) — see ARCHITECTURE.md §5.
- **Denormalized `upvote_count`**: incremented/decremented in the same transaction as the
  insert/delete on `upvotes`. A periodic reconciliation job can recompute it from the join table.

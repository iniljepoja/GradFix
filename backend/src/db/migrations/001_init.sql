-- GradFix initial schema (multi-tenant, shared DB / shared schema)
-- Applied by `npm run migrate`. Do not edit after it has been applied; add a new migration instead.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums --------------------------------------------------------------------
-- Role system per the internship spec (Super Admin → Tenant Admin → Reviewer / Conductor /
-- Community Manager → Citizen).
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM
    ('citizen', 'reviewer', 'conductor', 'community_manager', 'tenant_admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Report lifecycle per the spec: New → Accepted → Assigned → In progress → Resolved → Closed.
DO $$ BEGIN
  CREATE TYPE report_status AS ENUM
    ('new', 'accepted', 'assigned', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Responsible-entity classification for automatic routing / work orders.
DO $$ BEGIN
  CREATE TYPE entity_type AS ENUM ('company', 'ngo', 'informal_group', 'department');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Shared updated_at trigger ------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tenants ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
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
DROP TRIGGER IF EXISTS trg_tenants_updated ON tenants;
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Users --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  role              user_role NOT NULL DEFAULT 'citizen',
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Token tables -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evt_user ON email_verification_tokens(user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rt_user ON refresh_tokens(user_id);

-- Categories ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
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
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);

CREATE TABLE IF NOT EXISTS subcategories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (category_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);

-- Responsible entities -----------------------------------------------------
-- Companies / NGOs / informal groups / city departments that reports are routed and assigned to.
CREATE TABLE IF NOT EXISTS responsible_entities (
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
CREATE INDEX IF NOT EXISTS idx_entities_tenant ON responsible_entities(tenant_id);

-- Reports ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reporter_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  category_id    UUID NOT NULL REFERENCES categories(id),
  subcategory_id UUID REFERENCES subcategories(id),
  title             TEXT NOT NULL,
  description       TEXT,
  status            report_status NOT NULL DEFAULT 'new',
  priority          report_priority NOT NULL DEFAULT 'medium',
  latitude          DOUBLE PRECISION NOT NULL,
  longitude         DOUBLE PRECISION NOT NULL,
  address           TEXT,
  upvote_count      INTEGER NOT NULL DEFAULT 0,
  assigned_entity_id UUID REFERENCES responsible_entities(id) ON DELETE SET NULL,
  duplicate_of_id   UUID REFERENCES reports(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reports_tenant         ON reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reports_tenant_status  ON reports(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_category       ON reports(category_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter       ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_location       ON reports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reports_assigned       ON reports(assigned_entity_id);
CREATE INDEX IF NOT EXISTS idx_reports_duplicate_of   ON reports(duplicate_of_id);
DROP TRIGGER IF EXISTS trg_reports_updated ON reports;
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Report photos ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_photos (
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
CREATE INDEX IF NOT EXISTS idx_report_photos_report ON report_photos(report_id);

-- Status history -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  from_status report_status,
  to_status   report_status NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_status_history_report ON report_status_history(report_id);

-- Upvotes ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upvotes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_upvotes_report ON upvotes(report_id);

-- Category routing ---------------------------------------------------------
-- Default responsible entity per category (automatic routing). One route per category.
CREATE TABLE IF NOT EXISTS category_routes (
  category_id          UUID PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
  responsible_entity_id UUID NOT NULL REFERENCES responsible_entities(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Resolution ratings -------------------------------------------------------
-- The reporter rates the resolution once a report is resolved (satisfied + optional comment).
CREATE TABLE IF NOT EXISTS report_ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  rated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  satisfied  BOOLEAN NOT NULL,
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_report ON report_ratings(report_id);

-- Comments -----------------------------------------------------------------
-- Internal (admin-only) comments by default; is_internal=FALSE reserved for future public replies.
CREATE TABLE IF NOT EXISTS report_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_report ON report_comments(report_id);

-- Push subscriptions -------------------------------------------------------
-- Web Push (VAPID) subscription store. Delivery wiring is deferred; email runs now.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

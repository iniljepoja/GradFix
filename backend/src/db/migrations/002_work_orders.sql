-- First-class Work Orders subsystem.
-- Work orders are operational records separate from citizen-facing reports.

DO $$ BEGIN
  CREATE TYPE work_order_status AS ENUM
    ('draft', 'sent', 'delivery_failed', 'in_progress', 'completed', 'cancelled', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS work_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id             UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  responsible_entity_id UUID NOT NULL REFERENCES responsible_entities(id),
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  status                work_order_status NOT NULL DEFAULT 'draft',
  due_at                TIMESTAMPTZ,
  sent_at               TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  superseded_by_id      UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_orders_tenant ON work_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_report ON work_orders(report_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_entity ON work_orders(responsible_entity_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(tenant_id, status);
DROP TRIGGER IF EXISTS trg_work_orders_updated ON work_orders;
CREATE TRIGGER trg_work_orders_updated BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS work_order_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  storage_key   TEXT NOT NULL,
  url           TEXT,
  checksum      TEXT,
  snapshot      JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, version)
);
CREATE INDEX IF NOT EXISTS idx_work_order_documents_tenant ON work_order_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_order_documents_order ON work_order_documents(work_order_id);

CREATE TABLE IF NOT EXISTS work_order_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  work_order_id   UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  document_id     UUID REFERENCES work_order_documents(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL DEFAULT 'email',
  recipient_email TEXT,
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  queued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_order_deliveries_tenant ON work_order_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_order_deliveries_order ON work_order_deliveries(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_deliveries_status ON work_order_deliveries(tenant_id, status);

CREATE TABLE IF NOT EXISTS work_order_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,
  from_status   work_order_status,
  to_status     work_order_status,
  note          TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_order_events_tenant ON work_order_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_order_events_order ON work_order_events(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_events_type ON work_order_events(tenant_id, event_type);

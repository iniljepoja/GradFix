-- Audit assignment/reassignment separately from status history.

CREATE TABLE IF NOT EXISTS report_assignment_history (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id               UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  changed_by              UUID REFERENCES users(id) ON DELETE SET NULL,
  from_responsible_entity_id UUID REFERENCES responsible_entities(id) ON DELETE SET NULL,
  to_responsible_entity_id   UUID REFERENCES responsible_entities(id) ON DELETE SET NULL,
  note                    TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_assignment_history_tenant ON report_assignment_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_assignment_history_report ON report_assignment_history(report_id);

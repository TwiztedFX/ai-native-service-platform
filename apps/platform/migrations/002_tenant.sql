CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  proposal_id TEXT NOT NULL REFERENCES proposals(id),
  checkout_session_id TEXT,
  checkout_url TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_event_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, project_id)
);

CREATE INDEX idx_payments_org_checkout ON payments(organization_id, checkout_session_id);

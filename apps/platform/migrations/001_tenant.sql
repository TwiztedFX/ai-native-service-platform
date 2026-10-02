CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE engagements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  created_by TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  status TEXT NOT NULL,
  narrative TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE discovery_answers (
  engagement_id TEXT NOT NULL REFERENCES engagements(id),
  organization_id TEXT NOT NULL,
  question_key TEXT NOT NULL,
  answer TEXT NOT NULL,
  answered_by TEXT NOT NULL,
  answered_at TEXT NOT NULL,
  PRIMARY KEY (engagement_id, question_key)
);

CREATE TABLE requirements_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  engagement_id TEXT NOT NULL REFERENCES engagements(id),
  version INTEGER NOT NULL,
  spec_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (engagement_id, version)
);

CREATE TABLE solutions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  engagement_id TEXT NOT NULL REFERENCES engagements(id),
  requirements_id TEXT NOT NULL REFERENCES requirements_documents(id),
  spec_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  engagement_id TEXT NOT NULL REFERENCES engagements(id),
  solution_id TEXT NOT NULL REFERENCES solutions(id),
  document_json TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT,
  note TEXT
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  engagement_id TEXT NOT NULL REFERENCES engagements(id),
  proposal_id TEXT NOT NULL REFERENCES proposals(id),
  status TEXT NOT NULL,
  commercial_status TEXT NOT NULL,
  spec_json TEXT NOT NULL,
  solution_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  task_key TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  executor TEXT NOT NULL,
  depends_on_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  budget_cents INTEGER NOT NULL,
  UNIQUE (project_id, task_key)
);

CREATE TABLE task_executions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  project_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  tools_json TEXT NOT NULL,
  detail TEXT NOT NULL,
  cost_cents INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL
);

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  task_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE outcomes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
  metric TEXT NOT NULL,
  before_value TEXT NOT NULL,
  after_value TEXT,
  unit TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE TABLE blueprints (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
  spec_json TEXT NOT NULL,
  stage TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE domain_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  status TEXT NOT NULL,
  cost_cents INTEGER NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE tenant_audit (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_engagements_org ON engagements(organization_id, created_at);
CREATE INDEX idx_events_org ON domain_events(organization_id, created_at);
CREATE INDEX idx_tasks_project ON tasks(project_id, status);

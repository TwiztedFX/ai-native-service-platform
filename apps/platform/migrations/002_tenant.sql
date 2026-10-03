CREATE TABLE evaluation_reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  eval_id TEXT NOT NULL,
  passed INTEGER NOT NULL,
  failed_case_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_evaluation_reports_org_project ON evaluation_reports(organization_id, project_id);

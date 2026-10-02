import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { DomainEventType } from "@platform/domain";
import { assertEventType } from "@platform/domain";
import { all, one, run } from "../db/sql.ts";
import { now } from "../errors.ts";

export function insertEvent(
  db: DatabaseSync,
  organizationId: string,
  type: DomainEventType,
  payload: Record<string, unknown>,
): void {
  assertEventType(type);
  run(
    db,
    "INSERT INTO domain_events (id, organization_id, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
    [randomUUID(), organizationId, type, JSON.stringify(payload), now()],
  );
}

export function auditTenant(
  db: DatabaseSync,
  organizationId: string,
  actorId: string,
  action: string,
  subjectType: string,
  subjectId: string,
): void {
  run(
    db,
    `INSERT INTO tenant_audit (id, organization_id, actor_type, actor_id, action, subject_type, subject_id, created_at)
     VALUES (?, ?, 'user', ?, ?, ?, ?, ?)`,
    [randomUUID(), organizationId, actorId, action, subjectType, subjectId, now()],
  );
}

export function recordAgent(
  db: DatabaseSync,
  organizationId: string,
  agentId: string,
  action: string,
  subjectType: string,
  subjectId: string,
  detail: string,
): void {
  run(
    db,
    `INSERT INTO agent_runs (id, organization_id, agent_id, action, subject_type, subject_id, status, cost_cents, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'completed', 0, ?, ?)`,
    [randomUUID(), organizationId, agentId, action, subjectType, subjectId, detail, now()],
  );
}

export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export interface EngagementRow {
  id: string;
  organization_id: string;
  customer_id: string;
  created_by: string;
  problem_statement: string;
  status: string;
  narrative: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalRow {
  id: string;
  organization_id: string;
  engagement_id: string;
  solution_id: string;
  document_json: string;
  price_cents: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface ProjectRow {
  id: string;
  organization_id: string;
  engagement_id: string;
  proposal_id: string;
  status: string;
  commercial_status: string;
  spec_json: string;
  solution_json: string;
  created_at: string;
}

export interface TaskRow {
  id: string;
  organization_id: string;
  project_id: string;
  task_key: string;
  title: string;
  kind: string;
  executor: string;
  depends_on_json: string;
  status: string;
  attempts: number;
  budget_cents: number;
}

export interface ArtifactRow {
  id: string;
  organization_id: string;
  project_id: string;
  task_id: string | null;
  kind: string;
  title: string;
  content: string;
  content_hash: string;
  verification_status: string;
  created_at: string;
}

export function getEngagement(
  db: DatabaseSync,
  organizationId: string,
  engagementId: string,
): EngagementRow | undefined {
  return one<EngagementRow>(db, "SELECT * FROM engagements WHERE id = ? AND organization_id = ?", [
    engagementId,
    organizationId,
  ]);
}

export function latestRequirements(
  db: DatabaseSync,
  organizationId: string,
  engagementId: string,
): { id: string; version: number; spec_json: string } | undefined {
  return one(
    db,
    `SELECT id, version, spec_json FROM requirements_documents
     WHERE engagement_id = ? AND organization_id = ?
     ORDER BY version DESC LIMIT 1`,
    [engagementId, organizationId],
  );
}

export function latestProposal(
  db: DatabaseSync,
  organizationId: string,
  engagementId: string,
): ProposalRow | undefined {
  return one<ProposalRow>(
    db,
    `SELECT * FROM proposals WHERE engagement_id = ? AND organization_id = ? AND status != 'superseded'
     ORDER BY created_at DESC LIMIT 1`,
    [engagementId, organizationId],
  );
}

export function projectForEngagement(
  db: DatabaseSync,
  organizationId: string,
  engagementId: string,
): ProjectRow | undefined {
  return one<ProjectRow>(
    db,
    "SELECT * FROM projects WHERE engagement_id = ? AND organization_id = ?",
    [engagementId, organizationId],
  );
}

export function listTasks(db: DatabaseSync, organizationId: string, projectId: string): TaskRow[] {
  return all<TaskRow>(
    db,
    "SELECT * FROM tasks WHERE project_id = ? AND organization_id = ? ORDER BY task_key",
    [projectId, organizationId],
  );
}

export function latestArtifact(
  db: DatabaseSync,
  organizationId: string,
  projectId: string,
  kind: string,
): ArtifactRow | undefined {
  return one<ArtifactRow>(
    db,
    `SELECT * FROM artifacts
     WHERE project_id = ? AND organization_id = ? AND kind = ? AND verification_status != 'superseded'
     ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    [projectId, organizationId, kind],
  );
}

export function answersFor(
  db: DatabaseSync,
  organizationId: string,
  engagementId: string,
): Record<string, string> {
  const rows = all<{ question_key: string; answer: string }>(
    db,
    "SELECT question_key, answer FROM discovery_answers WHERE engagement_id = ? AND organization_id = ?",
    [engagementId, organizationId],
  );
  return Object.fromEntries(rows.map((row) => [row.question_key, row.answer]));
}

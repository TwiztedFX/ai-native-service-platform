import { assertCanPromote } from "@platform/domain";
import { assertRole, type TenantContext } from "../auth/identity.ts";
import { all, one, run, transaction } from "../db/sql.ts";
import { AppError, now } from "../errors.ts";
import {
  type ArtifactRow,
  auditTenant,
  insertEvent,
  type ProjectRow,
  type TaskRow,
} from "./records.ts";

function projectOrThrow(ctx: TenantContext, projectId: string): ProjectRow {
  const project = one<ProjectRow>(
    ctx.tenant,
    "SELECT * FROM projects WHERE id = ? AND organization_id = ?",
    [projectId, ctx.organizationId],
  );
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found.");
  return project;
}

export function projectView(ctx: TenantContext, projectId: string) {
  const project = projectOrThrow(ctx, projectId);
  const tasks = all<TaskRow>(
    ctx.tenant,
    "SELECT * FROM tasks WHERE project_id = ? AND organization_id = ? ORDER BY task_key",
    [projectId, ctx.organizationId],
  );
  const executions = all(
    ctx.tenant,
    "SELECT id, task_id, attempt, agent_id, status, detail, cost_cents, duration_ms, started_at, finished_at FROM task_executions WHERE project_id = ? AND organization_id = ? ORDER BY started_at",
    [projectId, ctx.organizationId],
  );
  const artifacts = all<ArtifactRow>(
    ctx.tenant,
    "SELECT * FROM artifacts WHERE project_id = ? AND organization_id = ? AND verification_status != 'superseded' ORDER BY created_at",
    [projectId, ctx.organizationId],
  );
  const outcome = one(
    ctx.tenant,
    "SELECT metric, before_value, after_value, unit, recorded_at FROM outcomes WHERE project_id = ? AND organization_id = ?",
    [projectId, ctx.organizationId],
  );
  const blueprint = one<{ spec_json: string; stage: string }>(
    ctx.tenant,
    "SELECT spec_json, stage FROM blueprints WHERE project_id = ? AND organization_id = ?",
    [projectId, ctx.organizationId],
  );
  const events = all<{ type: string; payload_json: string; created_at: string }>(
    ctx.tenant,
    "SELECT type, payload_json, created_at FROM domain_events WHERE organization_id = ? ORDER BY created_at",
    [ctx.organizationId],
  ).filter((event) => event.payload_json.includes(projectId));
  return {
    project: {
      id: project.id,
      engagementId: project.engagement_id,
      status: project.status,
      commercialStatus: project.commercial_status,
      createdAt: project.created_at,
    },
    tasks: tasks.map((task) => ({
      id: task.id,
      key: task.task_key,
      title: task.title,
      kind: task.kind,
      executor: task.executor,
      status: task.status,
      attempts: task.attempts,
      budgetCents: task.budget_cents,
      dependsOn: JSON.parse(task.depends_on_json) as unknown,
    })),
    executions,
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      content: artifact.content,
      contentHash: artifact.content_hash,
      verificationStatus: artifact.verification_status,
    })),
    outcome,
    blueprint: blueprint
      ? { stage: blueprint.stage, spec: JSON.parse(blueprint.spec_json) as unknown }
      : null,
    events: events.map((event) => ({ type: event.type, at: event.created_at })),
  };
}

export function artifactContent(
  ctx: TenantContext,
  projectId: string,
  artifactId: string,
): ArtifactRow {
  const artifact = one<ArtifactRow>(
    ctx.tenant,
    "SELECT * FROM artifacts WHERE id = ? AND project_id = ? AND organization_id = ?",
    [artifactId, projectId, ctx.organizationId],
  );
  if (!artifact) throw new AppError(404, "NOT_FOUND", "Artifact not found.");
  return artifact;
}

export function recordOutcome(ctx: TenantContext, projectId: string, afterValue: string): void {
  assertRole(ctx.role, ["owner", "operator", "customer"]);
  projectOrThrow(ctx, projectId);
  const updated = run(
    ctx.tenant,
    "UPDATE outcomes SET after_value = ?, recorded_at = ? WHERE project_id = ? AND organization_id = ?",
    [afterValue.trim(), now(), projectId, ctx.organizationId],
  );
  if (updated !== 1)
    throw new AppError(
      409,
      "OUTCOME_BASELINE_REQUIRED",
      "Deliver the project before recording an outcome.",
    );
  insertEvent(ctx.tenant, ctx.organizationId, "OutcomeRecorded", { projectId, phase: "after" });
  auditTenant(
    ctx.tenant,
    ctx.organizationId,
    ctx.actor.userId,
    "outcome.record",
    "project",
    projectId,
  );
}

export function decideReview(
  ctx: TenantContext,
  projectId: string,
  taskId: string,
  decision: "retry" | "stop",
  note: string,
): void {
  assertRole(ctx.role, ["owner", "operator"]);
  const project = projectOrThrow(ctx, projectId);
  const task = one<TaskRow>(
    ctx.tenant,
    "SELECT * FROM tasks WHERE id = ? AND project_id = ? AND organization_id = ? AND kind = 'approval' AND status = 'pending'",
    [taskId, projectId, ctx.organizationId],
  );
  if (!task) throw new AppError(404, "NOT_FOUND", "Human review not found.");
  transaction(ctx.tenant, () => {
    if (decision === "stop") {
      run(
        ctx.tenant,
        "UPDATE tasks SET status = 'cancelled' WHERE id = ? AND organization_id = ?",
        [taskId, ctx.organizationId],
      );
      run(
        ctx.tenant,
        "UPDATE projects SET status = 'cancelled' WHERE id = ? AND organization_id = ?",
        [projectId, ctx.organizationId],
      );
      run(
        ctx.tenant,
        "UPDATE engagements SET status = 'cancelled', updated_at = ? WHERE id = ? AND organization_id = ?",
        [now(), project.engagement_id, ctx.organizationId],
      );
      closeApproval(ctx, taskId, "rejected", note);
      insertEvent(ctx.tenant, ctx.organizationId, "ProjectCancelled", { projectId, taskId });
      return;
    }
    run(ctx.tenant, "UPDATE tasks SET status = 'completed' WHERE id = ? AND organization_id = ?", [
      taskId,
      ctx.organizationId,
    ]);
    run(
      ctx.tenant,
      `UPDATE tasks SET status = 'pending', attempts = 0
       WHERE project_id = ? AND organization_id = ? AND task_key IN ('author_runbook', 'author_checklist', 'author_metrics', 'verify_package')`,
      [projectId, ctx.organizationId],
    );
    run(ctx.tenant, "UPDATE projects SET status = 'ready' WHERE id = ? AND organization_id = ?", [
      projectId,
      ctx.organizationId,
    ]);
    run(
      ctx.tenant,
      "UPDATE engagements SET status = 'accepted', updated_at = ? WHERE id = ? AND organization_id = ?",
      [now(), project.engagement_id, ctx.organizationId],
    );
    closeApproval(ctx, taskId, "granted", note);
    insertEvent(ctx.tenant, ctx.organizationId, "HumanApprovalGranted", { projectId, taskId });
  });
}

function closeApproval(ctx: TenantContext, taskId: string, status: string, note: string): void {
  const approval = one<{ id: string }>(
    ctx.tenant,
    "SELECT id FROM approvals WHERE organization_id = ? AND subject_id = ? AND status = 'pending' ORDER BY requested_at DESC LIMIT 1",
    [ctx.organizationId, taskId],
  );
  if (!approval) return;
  run(
    ctx.tenant,
    "UPDATE approvals SET status = ?, decided_at = ?, decided_by = ?, note = ? WHERE id = ? AND organization_id = ?",
    [status, now(), ctx.actor.userId, note, approval.id, ctx.organizationId],
  );
}

export function promoteBlueprint(ctx: TenantContext, projectId: string): void {
  assertRole(ctx.role, ["owner", "operator"]);
  const blueprint = one(
    ctx.tenant,
    "SELECT id FROM blueprints WHERE project_id = ? AND organization_id = ?",
    [projectId, ctx.organizationId],
  );
  if (!blueprint) throw new AppError(404, "NOT_FOUND", "Blueprint not found.");
  try {
    assertCanPromote();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Promotion is blocked.";
    throw new AppError(409, "PROMOTION_GATE", message);
  }
}

import { randomUUID } from "node:crypto";
import {
  type AgentId,
  type AuthorArtifactKind,
  agentForTask,
  assertAllowed,
  BUILDER_AGENT,
  buildBlueprint,
  capabilitiesForVertical,
  executionCostCents,
  getAgent,
  isRequirementsSpec,
  isTaskKey,
  parseBaseline,
  renderAuthorArtifact,
  renderVerificationReport,
  type TaskKey,
  VERIFIER_AGENT,
  verifyPackage,
} from "@platform/domain";
import { assertRole, type TenantContext } from "../auth/identity.ts";
import { one, run, transaction } from "../db/sql.ts";
import { AppError, now } from "../errors.ts";
import {
  type ArtifactRow,
  contentHash,
  getEngagement,
  insertEvent,
  latestArtifact,
  listTasks,
  type ProjectRow,
  recordAgent,
  type TaskRow,
} from "./records.ts";

export type FaultMode = "none" | "omit_metric_once" | "omit_metric_always";

const AUTHOR_KEYS = ["author_runbook", "author_checklist", "author_metrics", "verify_package"];

function projectRow(ctx: TenantContext, projectId: string): ProjectRow {
  const project = one<ProjectRow>(
    ctx.tenant,
    "SELECT * FROM projects WHERE id = ? AND organization_id = ?",
    [projectId, ctx.organizationId],
  );
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found.");
  return project;
}

function requirementsOf(project: ProjectRow) {
  const parsed: unknown = JSON.parse(project.spec_json);
  if (!isRequirementsSpec(parsed))
    throw new AppError(500, "CORRUPT_SPEC", "Project requirements are unreadable.");
  return parsed;
}

function authorKind(key: TaskKey): AuthorArtifactKind | undefined {
  switch (key) {
    case "author_runbook":
      return "runbook";
    case "author_checklist":
      return "checklist";
    case "author_metrics":
      return "metrics";
    case "verify_package":
    case "publish_delivery":
    case "human_review":
      return undefined;
    default: {
      const exhaustive: never = key;
      throw new Error(`Unknown task ${String(exhaustive)}`);
    }
  }
}

function actionFor(kind: string): string {
  switch (kind) {
    case "author":
      return "artifact.write";
    case "verify":
      return "verification.write";
    case "deliver":
      return "delivery.publish";
    default:
      throw new AppError(500, "CORRUPT_TASK", "Task kind cannot be executed.");
  }
}

function shouldOmit(fault: FaultMode, key: TaskKey, attempt: number): boolean {
  if (key !== "author_runbook") return false;
  if (fault === "omit_metric_always") return true;
  return fault === "omit_metric_once" && attempt === 1;
}

function writeArtifact(
  ctx: TenantContext,
  projectId: string,
  taskId: string,
  kind: string,
  title: string,
  content: string,
  status: string,
): ArtifactRow {
  run(
    ctx.tenant,
    `UPDATE artifacts SET verification_status = 'superseded'
     WHERE project_id = ? AND organization_id = ? AND kind = ? AND verification_status != 'superseded'`,
    [projectId, ctx.organizationId, kind],
  );
  const id = randomUUID();
  const created = now();
  run(
    ctx.tenant,
    `INSERT INTO artifacts (id, organization_id, project_id, task_id, kind, title, content, content_hash, verification_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      ctx.organizationId,
      projectId,
      taskId,
      kind,
      title,
      content,
      contentHash(content),
      status,
      created,
    ],
  );
  const saved = latestArtifact(ctx.tenant, ctx.organizationId, projectId, kind);
  if (!saved) throw new AppError(500, "ARTIFACT_MISSING", "Artifact was not stored.");
  return saved;
}

function finishExecution(
  ctx: TenantContext,
  task: TaskRow,
  attempt: number,
  agentId: AgentId,
  status: string,
  detail: string,
  cost: number,
  startedAt: string,
  startedMs: number,
): void {
  run(
    ctx.tenant,
    `INSERT INTO task_executions (id, organization_id, task_id, project_id, attempt, agent_id, status, tools_json, detail, cost_cents, duration_ms, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      ctx.organizationId,
      task.id,
      task.project_id,
      attempt,
      agentId,
      status,
      JSON.stringify([...getAgent(agentId).tools]),
      detail,
      cost,
      Date.now() - startedMs,
      startedAt,
      now(),
    ],
  );
}

function escalate(ctx: TenantContext, project: ProjectRow, detail: string): void {
  const existing = one<TaskRow>(
    ctx.tenant,
    "SELECT * FROM tasks WHERE project_id = ? AND organization_id = ? AND task_key = 'human_review'",
    [project.id, ctx.organizationId],
  );
  const taskId = existing?.id ?? randomUUID();
  if (!existing) {
    run(
      ctx.tenant,
      `INSERT INTO tasks (id, organization_id, project_id, task_key, title, kind, executor, depends_on_json, status, attempts, budget_cents)
       VALUES (?, ?, ?, 'human_review', 'Human review', 'approval', 'human', '[]', 'pending', 0, 0)`,
      [taskId, ctx.organizationId, project.id],
    );
    insertEvent(ctx.tenant, ctx.organizationId, "TaskCreated", {
      projectId: project.id,
      taskId,
      taskKey: "human_review",
    });
  } else {
    run(ctx.tenant, "UPDATE tasks SET status = 'pending' WHERE id = ? AND organization_id = ?", [
      taskId,
      ctx.organizationId,
    ]);
  }
  run(
    ctx.tenant,
    `INSERT INTO approvals (id, organization_id, subject_type, subject_id, status, requested_at, decided_at, decided_by, note)
     VALUES (?, ?, 'task', ?, 'pending', ?, NULL, NULL, ?)`,
    [randomUUID(), ctx.organizationId, taskId, now(), detail.slice(0, 500)],
  );
  run(
    ctx.tenant,
    "UPDATE projects SET status = 'needs_human' WHERE id = ? AND organization_id = ?",
    [project.id, ctx.organizationId],
  );
  run(
    ctx.tenant,
    "UPDATE engagements SET status = 'needs_human', updated_at = ? WHERE id = ? AND organization_id = ?",
    [now(), project.engagement_id, ctx.organizationId],
  );
  insertEvent(ctx.tenant, ctx.organizationId, "HumanApprovalRequested", {
    projectId: project.id,
    taskId,
    detail,
  });
}

function failPermanently(
  ctx: TenantContext,
  project: ProjectRow,
  task: TaskRow,
  attempt: number,
  agentId: AgentId,
  cost: number,
  startedAt: string,
  startedMs: number,
  detail: string,
): void {
  transaction(ctx.tenant, () => {
    run(ctx.tenant, "UPDATE tasks SET status = 'failed' WHERE id = ? AND organization_id = ?", [
      task.id,
      ctx.organizationId,
    ]);
    finishExecution(ctx, task, attempt, agentId, "failed", detail, cost, startedAt, startedMs);
    insertEvent(ctx.tenant, ctx.organizationId, "TaskFailed", {
      projectId: project.id,
      taskId: task.id,
      taskKey: task.task_key,
    });
    escalate(ctx, project, detail);
  });
}

function execute(ctx: TenantContext, project: ProjectRow, task: TaskRow, fault: FaultMode): void {
  if (!isTaskKey(task.task_key)) throw new AppError(500, "CORRUPT_TASK", "Unknown task key.");
  const key = task.task_key;
  const expected = agentForTask(key);
  if (task.executor !== expected || expected === "human") return;
  const agentId = expected;
  const startedAt = now();
  const startedMs = Date.now();
  const attempt = transaction(ctx.tenant, () => {
    const claimed = run(
      ctx.tenant,
      "UPDATE tasks SET status = 'running', attempts = attempts + 1 WHERE id = ? AND organization_id = ? AND status = 'pending'",
      [task.id, ctx.organizationId],
    );
    if (claimed !== 1) return 0;
    insertEvent(ctx.tenant, ctx.organizationId, "TaskStarted", {
      projectId: project.id,
      taskId: task.id,
      taskKey: key,
    });
    const stored = one<{ attempts: number }>(
      ctx.tenant,
      "SELECT attempts FROM tasks WHERE id = ? AND organization_id = ?",
      [task.id, ctx.organizationId],
    );
    return stored?.attempts ?? 0;
  });
  if (attempt === 0) return;
  const cost = executionCostCents(key);
  try {
    assertAllowed(agentId, actionFor(task.kind));
    if (cost > task.budget_cents)
      throw new AppError(409, "BUDGET_EXCEEDED", "Task cost exceeds its budget.");
    const spec = requirementsOf(project);
    if (task.kind === "author") {
      const kind = authorKind(key);
      if (!kind) throw new AppError(500, "CORRUPT_TASK", "Author task has no artifact.");
      let content = renderAuthorArtifact(kind, spec);
      if (shouldOmit(fault, key, attempt))
        content = content.replaceAll(spec.answers.successMetric.value, "");
      transaction(ctx.tenant, () => {
        writeArtifact(ctx, project.id, task.id, kind, task.title, content, "recorded");
        run(
          ctx.tenant,
          "UPDATE tasks SET status = 'completed' WHERE id = ? AND organization_id = ?",
          [task.id, ctx.organizationId],
        );
        finishExecution(
          ctx,
          task,
          attempt,
          agentId,
          "completed",
          "artifact written",
          cost,
          startedAt,
          startedMs,
        );
        recordAgent(
          ctx.tenant,
          ctx.organizationId,
          agentId,
          actionFor(task.kind),
          "task",
          task.id,
          kind,
        );
        insertEvent(ctx.tenant, ctx.organizationId, "TaskCompleted", {
          projectId: project.id,
          taskId: task.id,
          taskKey: key,
        });
      });
      return;
    }
    if (task.kind === "verify") {
      const runbook = latestArtifact(ctx.tenant, ctx.organizationId, project.id, "runbook");
      const checklist = latestArtifact(ctx.tenant, ctx.organizationId, project.id, "checklist");
      const metrics = latestArtifact(ctx.tenant, ctx.organizationId, project.id, "metrics");
      const result = verifyPackage({
        spec,
        runbook: runbook?.content ?? "",
        checklist: checklist?.content ?? "",
        metrics: metrics?.content ?? "",
        builderAgentId: BUILDER_AGENT,
        verifierAgentId: VERIFIER_AGENT,
      });
      const report = renderVerificationReport(result);
      transaction(ctx.tenant, () => {
        writeArtifact(
          ctx,
          project.id,
          task.id,
          "verification_report",
          "Verification report",
          report,
          result.ok ? "pass" : "fail",
        );
        finishExecution(
          ctx,
          task,
          attempt,
          agentId,
          result.ok ? "completed" : "failed",
          result.reasons.join("; ") || "pass",
          cost,
          startedAt,
          startedMs,
        );
        recordAgent(
          ctx.tenant,
          ctx.organizationId,
          agentId,
          "verification.write",
          "task",
          task.id,
          result.ok ? "pass" : "fail",
        );
        if (result.ok) {
          run(
            ctx.tenant,
            "UPDATE tasks SET status = 'completed' WHERE id = ? AND organization_id = ?",
            [task.id, ctx.organizationId],
          );
          insertEvent(ctx.tenant, ctx.organizationId, "TaskCompleted", {
            projectId: project.id,
            taskId: task.id,
            taskKey: key,
          });
          return;
        }
        insertEvent(ctx.tenant, ctx.organizationId, "TaskFailed", {
          projectId: project.id,
          taskId: task.id,
          taskKey: key,
        });
        if (attempt < getAgent("verifier").maxAttempts) {
          run(
            ctx.tenant,
            `UPDATE tasks SET status = 'pending' WHERE project_id = ? AND organization_id = ? AND task_key IN (${AUTHOR_KEYS.map(() => "?").join(", ")})`,
            [project.id, ctx.organizationId, ...AUTHOR_KEYS],
          );
          return;
        }
        run(ctx.tenant, "UPDATE tasks SET status = 'failed' WHERE id = ? AND organization_id = ?", [
          task.id,
          ctx.organizationId,
        ]);
        escalate(ctx, project, result.reasons.join("; ") || "verification failed");
      });
      return;
    }
    if (task.kind === "deliver") {
      const verify = one<TaskRow>(
        ctx.tenant,
        "SELECT * FROM tasks WHERE project_id = ? AND organization_id = ? AND task_key = 'verify_package'",
        [project.id, ctx.organizationId],
      );
      const report = latestArtifact(
        ctx.tenant,
        ctx.organizationId,
        project.id,
        "verification_report",
      );
      if (verify?.status !== "completed" || !report?.content.includes("Result: pass")) {
        throw new AppError(409, "NOT_VERIFIED", "Delivery requires a passing verification report.");
      }
      const pieces = ["runbook", "checklist", "metrics", "verification_report"].map((kind) => {
        const artifact = latestArtifact(ctx.tenant, ctx.organizationId, project.id, kind);
        if (!artifact) throw new AppError(409, "NOT_VERIFIED", "A required artifact is missing.");
        return artifact;
      });
      const manifest = [
        "# Delivery",
        "",
        "Status: verified",
        "",
        "## Artifacts",
        ...pieces.map((piece) => `- ${piece.kind} ${piece.id} ${piece.content_hash}`),
        "",
      ].join("\n");
      const baseline = parseBaseline(
        spec.answers.successMetric.value,
        spec.answers.currentWork.value,
      );
      assertAllowed("optimization", "blueprint.write");
      const blueprint = buildBlueprint({
        projectId: project.id,
        capabilityIds: capabilitiesForVertical().map((capability) => capability.id),
        artifactKinds: [
          "runbook",
          "checklist",
          "metrics",
          "verification_report",
          "delivery_manifest",
        ],
      });
      transaction(ctx.tenant, () => {
        writeArtifact(
          ctx,
          project.id,
          task.id,
          "delivery_manifest",
          "Delivery manifest",
          manifest,
          "recorded",
        );
        run(
          ctx.tenant,
          `INSERT INTO outcomes (id, organization_id, project_id, metric, before_value, after_value, unit, recorded_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
          [
            randomUUID(),
            ctx.organizationId,
            project.id,
            spec.answers.successMetric.value,
            baseline.before,
            baseline.unit,
            now(),
          ],
        );
        run(
          ctx.tenant,
          "INSERT INTO blueprints (id, organization_id, project_id, spec_json, stage, created_at) VALUES (?, ?, ?, ?, 'candidate', ?)",
          [randomUUID(), ctx.organizationId, project.id, JSON.stringify(blueprint), now()],
        );
        run(
          ctx.tenant,
          "UPDATE tasks SET status = 'completed' WHERE id = ? AND organization_id = ?",
          [task.id, ctx.organizationId],
        );
        run(
          ctx.tenant,
          "UPDATE projects SET status = 'delivered' WHERE id = ? AND organization_id = ?",
          [project.id, ctx.organizationId],
        );
        run(
          ctx.tenant,
          "UPDATE engagements SET status = 'delivered', updated_at = ? WHERE id = ? AND organization_id = ?",
          [now(), project.engagement_id, ctx.organizationId],
        );
        finishExecution(
          ctx,
          task,
          attempt,
          agentId,
          "completed",
          "package delivered",
          cost,
          startedAt,
          startedMs,
        );
        recordAgent(
          ctx.tenant,
          ctx.organizationId,
          "delivery",
          "delivery.publish",
          "project",
          project.id,
          "delivered",
        );
        recordAgent(
          ctx.tenant,
          ctx.organizationId,
          "optimization",
          "blueprint.write",
          "project",
          project.id,
          "candidate",
        );
        insertEvent(ctx.tenant, ctx.organizationId, "TaskCompleted", {
          projectId: project.id,
          taskId: task.id,
          taskKey: key,
        });
        insertEvent(ctx.tenant, ctx.organizationId, "OutcomeRecorded", {
          projectId: project.id,
          phase: "baseline",
        });
        insertEvent(ctx.tenant, ctx.organizationId, "BlueprintCreated", {
          projectId: project.id,
          stage: "candidate",
        });
        insertEvent(ctx.tenant, ctx.organizationId, "SolutionCompleted", {
          projectId: project.id,
          engagementId: project.engagement_id,
        });
      });
      return;
    }
    throw new AppError(500, "CORRUPT_TASK", "Task kind cannot be executed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task failed.";
    failPermanently(ctx, project, task, attempt, agentId, cost, startedAt, startedMs, message);
  }
}

export function runProject(ctx: TenantContext, projectId: string, fault: FaultMode = "none"): void {
  assertRole(ctx.role, ["owner", "operator"]);
  const initial = projectRow(ctx, projectId);
  if (!getEngagement(ctx.tenant, ctx.organizationId, initial.engagement_id)) {
    throw new AppError(404, "NOT_FOUND", "Engagement not found.");
  }
  if (
    initial.status === "delivered" ||
    initial.status === "cancelled" ||
    initial.status === "needs_human"
  )
    return;
  transaction(ctx.tenant, () => {
    run(
      ctx.tenant,
      "UPDATE tasks SET status = 'pending' WHERE project_id = ? AND organization_id = ? AND status = 'running'",
      [projectId, ctx.organizationId],
    );
    run(ctx.tenant, "UPDATE projects SET status = 'running' WHERE id = ? AND organization_id = ?", [
      projectId,
      ctx.organizationId,
    ]);
    run(
      ctx.tenant,
      "UPDATE engagements SET status = 'in_delivery', updated_at = ? WHERE id = ? AND organization_id = ?",
      [now(), initial.engagement_id, ctx.organizationId],
    );
  });
  for (let step = 0; step < 25; step += 1) {
    const tasks = listTasks(ctx.tenant, ctx.organizationId, projectId);
    const byKey = new Map(tasks.map((task) => [task.task_key, task]));
    const runnable = tasks
      .filter((task) => task.status === "pending" && task.kind !== "approval")
      .filter((task) => {
        const depends: unknown = JSON.parse(task.depends_on_json);
        return (
          Array.isArray(depends) &&
          depends.every((key) => typeof key === "string" && byKey.get(key)?.status === "completed")
        );
      })
      .sort((left, right) => left.task_key.localeCompare(right.task_key));
    const next = runnable[0];
    if (!next) break;
    execute(ctx, projectRow(ctx, projectId), next, fault);
    const status = projectRow(ctx, projectId).status;
    if (status === "needs_human" || status === "delivered" || status === "cancelled") break;
  }
}

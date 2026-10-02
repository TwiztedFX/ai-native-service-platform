import { randomUUID } from "node:crypto";
import {
  answerIssue,
  assertAllowed,
  buildProposal,
  buildRequirements,
  composeSolution,
  createDefaultTaskGraph,
  discoveryQuestions,
  extractFacts,
  isRequirementsSpec,
  type QuestionKey,
  quoteVertical,
} from "@platform/domain";
import { assertRole, type TenantContext } from "../auth/identity.ts";
import { run, transaction } from "../db/sql.ts";
import { AppError, now } from "../errors.ts";
import {
  answersFor,
  auditTenant,
  type EngagementRow,
  getEngagement,
  insertEvent,
  latestProposal,
  latestRequirements,
  projectForEngagement,
  recordAgent,
} from "./records.ts";

const LOCKED = new Set(["accepted", "in_delivery", "delivered", "needs_human", "cancelled"]);

function requireEngagement(ctx: TenantContext, engagementId: string): EngagementRow {
  const engagement = getEngagement(ctx.tenant, ctx.organizationId, engagementId);
  if (!engagement) throw new AppError(404, "NOT_FOUND", "Engagement not found.");
  return engagement;
}

function assertUnlocked(engagement: EngagementRow): void {
  if (LOCKED.has(engagement.status))
    throw new AppError(409, "ENGAGEMENT_LOCKED", "This engagement can no longer be edited.");
}

export function createCustomer(
  ctx: TenantContext,
  input: { name: string; company: string },
): { id: string } {
  assertRole(ctx.role, ["owner", "operator"]);
  const id = randomUUID();
  transaction(ctx.tenant, () => {
    run(
      ctx.tenant,
      "INSERT INTO customers (id, organization_id, name, company, created_at) VALUES (?, ?, ?, ?, ?)",
      [id, ctx.organizationId, input.name.trim(), input.company.trim(), now()],
    );
    insertEvent(ctx.tenant, ctx.organizationId, "CustomerCreated", { customerId: id });
    auditTenant(
      ctx.tenant,
      ctx.organizationId,
      ctx.actor.userId,
      "customer.create",
      "customer",
      id,
    );
  });
  return { id };
}

export function listCustomers(
  ctx: TenantContext,
): Array<{ id: string; name: string; company: string }> {
  return ctx.tenant
    .prepare(
      "SELECT id, name, company FROM customers WHERE organization_id = ? ORDER BY created_at",
    )
    .all(ctx.organizationId) as Array<{ id: string; name: string; company: string }>;
}

export function createEngagement(
  ctx: TenantContext,
  input: { customerId: string; problem: string },
): { id: string } {
  assertRole(ctx.role, ["owner", "operator"]);
  const customer = ctx.tenant
    .prepare("SELECT id FROM customers WHERE id = ? AND organization_id = ?")
    .get(input.customerId, ctx.organizationId) as { id: string } | undefined;
  if (!customer) throw new AppError(404, "NOT_FOUND", "Customer not found.");
  const id = randomUUID();
  const stamp = now();
  transaction(ctx.tenant, () => {
    run(
      ctx.tenant,
      `INSERT INTO engagements (id, organization_id, customer_id, created_by, problem_statement, status, narrative, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'discovery', NULL, ?, ?)`,
      [
        id,
        ctx.organizationId,
        input.customerId,
        ctx.actor.userId,
        input.problem.trim(),
        stamp,
        stamp,
      ],
    );
    insertEvent(ctx.tenant, ctx.organizationId, "RequirementSubmitted", {
      engagementId: id,
      customerId: input.customerId,
    });
    auditTenant(
      ctx.tenant,
      ctx.organizationId,
      ctx.actor.userId,
      "engagement.create",
      "engagement",
      id,
    );
  });
  return { id };
}

export function saveAnswers(
  ctx: TenantContext,
  engagementId: string,
  answers: Partial<Record<QuestionKey, string>>,
): void {
  assertRole(ctx.role, ["owner", "operator", "customer"]);
  const engagement = requireEngagement(ctx, engagementId);
  assertUnlocked(engagement);
  const keys = Object.keys(answers);
  for (const key of keys) {
    if (!discoveryQuestions.some((question) => question.key === key)) {
      throw new AppError(400, "VALIDATION", "Unknown discovery question.");
    }
  }
  transaction(ctx.tenant, () => {
    for (const question of discoveryQuestions) {
      const value = answers[question.key];
      if (value === undefined) continue;
      run(
        ctx.tenant,
        `INSERT INTO discovery_answers (engagement_id, organization_id, question_key, answer, answered_by, answered_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (engagement_id, question_key) DO UPDATE SET answer = excluded.answer, answered_by = excluded.answered_by, answered_at = excluded.answered_at`,
        [engagementId, ctx.organizationId, question.key, value.trim(), ctx.actor.userId, now()],
      );
    }
    run(ctx.tenant, "UPDATE engagements SET updated_at = ? WHERE id = ? AND organization_id = ?", [
      now(),
      engagementId,
      ctx.organizationId,
    ]);
  });
}

export function finalizeRequirements(
  ctx: TenantContext,
  engagementId: string,
): { id: string; version: number } {
  assertRole(ctx.role, ["owner", "operator"]);
  const engagement = requireEngagement(ctx, engagementId);
  assertUnlocked(engagement);
  assertAllowed("discovery", "discovery.write");
  const spec = buildRequirements(
    engagement.problem_statement,
    answersFor(ctx.tenant, ctx.organizationId, engagementId),
  );
  if (spec.openQuestions.length > 0) {
    throw new AppError(
      409,
      "OPEN_QUESTIONS",
      "Required discovery answers are still missing or too vague.",
      {
        openQuestions: spec.openQuestions,
      },
    );
  }
  const specJson = JSON.stringify(spec);
  const current = latestRequirements(ctx.tenant, ctx.organizationId, engagementId);
  if (current?.spec_json === specJson) return { id: current.id, version: current.version };
  const id = randomUUID();
  const version = (current?.version ?? 0) + 1;
  transaction(ctx.tenant, () => {
    run(
      ctx.tenant,
      `INSERT INTO requirements_documents (id, organization_id, engagement_id, version, spec_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, ctx.organizationId, engagementId, version, specJson, now()],
    );
    run(
      ctx.tenant,
      "UPDATE engagements SET status = 'requirements_ready', updated_at = ? WHERE id = ? AND organization_id = ?",
      [now(), engagementId, ctx.organizationId],
    );
    recordAgent(
      ctx.tenant,
      ctx.organizationId,
      "discovery",
      "discovery.write",
      "engagement",
      engagementId,
      "requirements finalized",
    );
    insertEvent(ctx.tenant, ctx.organizationId, "RequirementValidated", {
      engagementId,
      requirementsId: id,
      version,
    });
  });
  return { id, version };
}

export function composeEngagement(
  ctx: TenantContext,
  engagementId: string,
): { proposalId: string; priceCents: number } {
  assertRole(ctx.role, ["owner", "operator"]);
  const engagement = requireEngagement(ctx, engagementId);
  assertUnlocked(engagement);
  const requirements = latestRequirements(ctx.tenant, ctx.organizationId, engagementId);
  if (!requirements)
    throw new AppError(
      409,
      "REQUIREMENTS_REQUIRED",
      "Finalize requirements before composing a solution.",
    );
  const parsed: unknown = JSON.parse(requirements.spec_json);
  if (!isRequirementsSpec(parsed) || parsed.openQuestions.length > 0) {
    throw new AppError(409, "REQUIREMENTS_REQUIRED", "Requirements are not ready.");
  }
  assertAllowed("solution_architect", "solution.compose");
  assertAllowed("pricing", "pricing.calculate");
  assertAllowed("proposal", "proposal.create");
  const solution = composeSolution(parsed);
  const price = quoteVertical();
  const proposal = buildProposal(parsed, solution, price);
  const solutionId = randomUUID();
  const proposalId = randomUUID();
  transaction(ctx.tenant, () => {
    run(
      ctx.tenant,
      "UPDATE proposals SET status = 'superseded' WHERE engagement_id = ? AND organization_id = ? AND status = 'ready'",
      [engagementId, ctx.organizationId],
    );
    run(
      ctx.tenant,
      `INSERT INTO solutions (id, organization_id, engagement_id, requirements_id, spec_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        solutionId,
        ctx.organizationId,
        engagementId,
        requirements.id,
        JSON.stringify(solution),
        now(),
      ],
    );
    run(
      ctx.tenant,
      `INSERT INTO proposals (id, organization_id, engagement_id, solution_id, document_json, price_cents, currency, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'USD', 'ready', ?)`,
      [
        proposalId,
        ctx.organizationId,
        engagementId,
        solutionId,
        JSON.stringify(proposal),
        price.priceCents,
        now(),
      ],
    );
    run(
      ctx.tenant,
      "UPDATE engagements SET status = 'proposal_ready', updated_at = ? WHERE id = ? AND organization_id = ?",
      [now(), engagementId, ctx.organizationId],
    );
    recordAgent(
      ctx.tenant,
      ctx.organizationId,
      "solution_architect",
      "solution.compose",
      "engagement",
      engagementId,
      solution.summary,
    );
    recordAgent(
      ctx.tenant,
      ctx.organizationId,
      "pricing",
      "pricing.calculate",
      "proposal",
      proposalId,
      String(price.priceCents),
    );
    recordAgent(
      ctx.tenant,
      ctx.organizationId,
      "proposal",
      "proposal.create",
      "proposal",
      proposalId,
      "proposal ready",
    );
    insertEvent(ctx.tenant, ctx.organizationId, "SolutionGenerated", { engagementId, solutionId });
    insertEvent(ctx.tenant, ctx.organizationId, "ProposalCreated", {
      engagementId,
      proposalId,
      priceCents: price.priceCents,
    });
  });
  return { proposalId, priceCents: price.priceCents };
}

export function acceptProposal(ctx: TenantContext, proposalId: string): { projectId: string } {
  assertRole(ctx.role, ["owner", "operator", "customer"]);
  const proposal = ctx.tenant
    .prepare("SELECT * FROM proposals WHERE id = ? AND organization_id = ?")
    .get(proposalId, ctx.organizationId) as
    | {
        id: string;
        engagement_id: string;
        solution_id: string;
        status: string;
        price_cents: number;
      }
    | undefined;
  if (!proposal) throw new AppError(404, "NOT_FOUND", "Proposal not found.");
  if (proposal.status === "accepted") {
    const existing = projectForEngagement(ctx.tenant, ctx.organizationId, proposal.engagement_id);
    if (!existing) throw new AppError(409, "PROPOSAL_ACCEPTED", "Proposal was already accepted.");
    return { projectId: existing.id };
  }
  if (proposal.status !== "ready")
    throw new AppError(409, "PROPOSAL_NOT_READY", "This proposal cannot be accepted.");
  const engagement = requireEngagement(ctx, proposal.engagement_id);
  const requirements = latestRequirements(ctx.tenant, ctx.organizationId, engagement.id);
  const solution = ctx.tenant
    .prepare("SELECT spec_json FROM solutions WHERE id = ? AND organization_id = ?")
    .get(proposal.solution_id, ctx.organizationId) as { spec_json: string } | undefined;
  if (!requirements || !solution)
    throw new AppError(409, "REQUIREMENTS_REQUIRED", "Solution inputs are missing.");
  const projectId = randomUUID();
  const graph = createDefaultTaskGraph();
  transaction(ctx.tenant, () => {
    run(
      ctx.tenant,
      "UPDATE proposals SET status = 'accepted' WHERE id = ? AND organization_id = ? AND status = 'ready'",
      [proposal.id, ctx.organizationId],
    );
    run(
      ctx.tenant,
      `INSERT INTO approvals (id, organization_id, subject_type, subject_id, status, requested_at, decided_at, decided_by, note)
       VALUES (?, ?, 'proposal', ?, 'granted', ?, ?, ?, NULL)`,
      [randomUUID(), ctx.organizationId, proposal.id, now(), now(), ctx.actor.userId],
    );
    run(
      ctx.tenant,
      `INSERT INTO projects (id, organization_id, engagement_id, proposal_id, status, commercial_status, spec_json, solution_json, created_at)
       VALUES (?, ?, ?, ?, 'ready', 'accepted_unbilled', ?, ?, ?)`,
      [
        projectId,
        ctx.organizationId,
        engagement.id,
        proposal.id,
        requirements.spec_json,
        solution.spec_json,
        now(),
      ],
    );
    for (const task of graph) {
      const taskId = randomUUID();
      run(
        ctx.tenant,
        `INSERT INTO tasks (id, organization_id, project_id, task_key, title, kind, executor, depends_on_json, status, attempts, budget_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
        [
          taskId,
          ctx.organizationId,
          projectId,
          task.key,
          task.title,
          task.kind,
          task.executor,
          JSON.stringify(task.dependsOn),
          task.budgetCents,
        ],
      );
      insertEvent(ctx.tenant, ctx.organizationId, "TaskCreated", {
        projectId,
        taskId,
        taskKey: task.key,
      });
    }
    run(
      ctx.tenant,
      "UPDATE engagements SET status = 'accepted', updated_at = ? WHERE id = ? AND organization_id = ?",
      [now(), engagement.id, ctx.organizationId],
    );
    insertEvent(ctx.tenant, ctx.organizationId, "ProposalAccepted", {
      engagementId: engagement.id,
      proposalId: proposal.id,
      projectId,
    });
    insertEvent(ctx.tenant, ctx.organizationId, "ProjectCreated", {
      engagementId: engagement.id,
      projectId,
      commercialStatus: "accepted_unbilled",
    });
    auditTenant(
      ctx.tenant,
      ctx.organizationId,
      ctx.actor.userId,
      "proposal.accept",
      "proposal",
      proposal.id,
    );
  });
  return { projectId };
}

export function engagementView(ctx: TenantContext, engagementId: string) {
  const engagement = requireEngagement(ctx, engagementId);
  const stored = answersFor(ctx.tenant, ctx.organizationId, engagementId);
  const requirements = latestRequirements(ctx.tenant, ctx.organizationId, engagementId);
  const proposal = latestProposal(ctx.tenant, ctx.organizationId, engagementId);
  const project = projectForEngagement(ctx.tenant, ctx.organizationId, engagementId);
  const parsedRequirements = requirements ? (JSON.parse(requirements.spec_json) as unknown) : null;
  return {
    engagement: {
      id: engagement.id,
      customerId: engagement.customer_id,
      problem: engagement.problem_statement,
      status: engagement.status,
      narrative: engagement.narrative,
      createdAt: engagement.created_at,
    },
    questions: discoveryQuestions.map((question) => ({
      key: question.key,
      prompt: question.prompt,
      answer: stored[question.key] ?? null,
      issue: answerIssue(question.key, stored[question.key]),
    })),
    facts: extractFacts(engagement.problem_statement),
    requirements: parsedRequirements,
    proposal: proposal
      ? {
          id: proposal.id,
          status: proposal.status,
          priceCents: proposal.price_cents,
          currency: proposal.currency,
          document: JSON.parse(proposal.document_json) as unknown,
        }
      : null,
    project: project
      ? { id: project.id, status: project.status, commercialStatus: project.commercial_status }
      : null,
  };
}

export function listEngagements(
  ctx: TenantContext,
): Array<{ id: string; status: string; problem: string; createdAt: string }> {
  return ctx.tenant
    .prepare(
      "SELECT id, status, problem_statement AS problem, created_at AS createdAt FROM engagements WHERE organization_id = ? ORDER BY created_at DESC",
    )
    .all(ctx.organizationId) as Array<{
    id: string;
    status: string;
    problem: string;
    createdAt: string;
  }>;
}

import { agents, assertAllowed, BUILDER_AGENT, VERIFIER_AGENT } from "./agents.ts";
import { renderAuthorArtifact } from "./artifacts.ts";
import { answerIssue, buildRequirements } from "./discovery.ts";
import { quoteVertical } from "./pricing.ts";
import { verifyPackage } from "./verify.ts";

export const OPERATIONAL_RUNBOOK_EVAL_ID = "eval-operational-runbook-1";

const evaluationCaseIds = [
  "discovery-stays-open-without-numeric-success-metric",
  "quote-vertical-price",
  "verification-fails-when-success-metric-missing",
  "builder-permissions-are-not-verifier-permissions",
] as const;

type EvaluationCaseId = (typeof evaluationCaseIds)[number];

export interface EvaluationReport {
  evalId: typeof OPERATIONAL_RUNBOOK_EVAL_ID;
  passed: boolean;
  failedCaseIds: string[];
}

export type ApproverRole = "owner" | "operator" | "customer";

export interface PromotionDecision {
  report: EvaluationReport | null;
  approvalNote: string | undefined;
  approverRole: ApproverRole;
}

const measuredAnswers = {
  current_work: "Two coordinators spend 20 hours per week emailing new clients.",
  success_metric: "Cut onboarding from 15 days to 5 days.",
  existing_systems: "none",
  constraints: "Do not replace the mailbox.",
  approver: "Nora Ahmed",
};

export function evaluationReport(failedCaseIds: readonly string[]): EvaluationReport {
  return {
    evalId: OPERATIONAL_RUNBOOK_EVAL_ID,
    passed: failedCaseIds.length === 0,
    failedCaseIds: [...failedCaseIds],
  };
}

export function runOperationalRunbookEvaluation(): EvaluationReport {
  const failedCaseIds: string[] = [];
  for (const caseId of evaluationCaseIds) {
    if (!runEvaluationCase(caseId)) failedCaseIds.push(caseId);
  }
  return evaluationReport(failedCaseIds);
}

function runEvaluationCase(caseId: EvaluationCaseId): boolean {
  switch (caseId) {
    case "discovery-stays-open-without-numeric-success-metric":
      return discoveryStaysOpenWithoutNumericSuccessMetric();
    case "quote-vertical-price":
      return quoteVertical().priceCents === 46197;
    case "verification-fails-when-success-metric-missing":
      return verificationFailsWhenSuccessMetricMissing();
    case "builder-permissions-are-not-verifier-permissions":
      return builderPermissionsAreNotVerifierPermissions();
    default: {
      const unexpected: never = caseId;
      throw new Error(`Unhandled evaluation case: ${String(unexpected)}`);
    }
  }
}

function discoveryStaysOpenWithoutNumericSuccessMetric(): boolean {
  const successMetric = "faster onboarding";
  const spec = buildRequirements("We onboard clients too slowly.", {
    ...measuredAnswers,
    success_metric: successMetric,
  });
  return answerIssue("success_metric", successMetric) !== null && spec.openQuestions.length > 0;
}

function verificationFailsWhenSuccessMetricMissing(): boolean {
  const spec = buildRequirements("Onboarding takes too long.", measuredAnswers);
  const metric = spec.answers.successMetric.value;
  if (!metric) return false;
  const result = verifyPackage({
    spec,
    runbook: renderAuthorArtifact("runbook", spec).replaceAll(metric, ""),
    checklist: renderAuthorArtifact("checklist", spec),
    metrics: renderAuthorArtifact("metrics", spec),
    builderAgentId: BUILDER_AGENT,
    verifierAgentId: VERIFIER_AGENT,
  });
  return result.ok === false;
}

function builderPermissionsAreNotVerifierPermissions(): boolean {
  if (BUILDER_AGENT === VERIFIER_AGENT) return false;
  const builder = agents[BUILDER_AGENT].permissions;
  const verifier = agents[VERIFIER_AGENT].permissions;
  const sameList =
    builder.length === verifier.length &&
    builder.every((permission, index) => permission === verifier[index]);
  if (sameList) return false;
  return (
    actionRejected(BUILDER_AGENT, "verification.write") &&
    actionRejected(VERIFIER_AGENT, "artifact.write")
  );
}

function actionRejected(
  agentId: typeof BUILDER_AGENT | typeof VERIFIER_AGENT,
  action: string,
): boolean {
  try {
    assertAllowed(agentId, action);
    return false;
  } catch {
    return true;
  }
}

export function hasPassingOperationalEval(report: EvaluationReport | null): boolean {
  return (
    report !== null &&
    report.evalId === OPERATIONAL_RUNBOOK_EVAL_ID &&
    report.passed &&
    report.failedCaseIds.length === 0
  );
}

export function hasExplicitHumanApproval(note: string | undefined, role: ApproverRole): boolean {
  if (!note || note.trim().length === 0) return false;
  switch (role) {
    case "owner":
    case "operator":
      return true;
    case "customer":
      return false;
    default: {
      const unexpected: never = role;
      throw new Error(`Unexpected approver role: ${String(unexpected)}`);
    }
  }
}

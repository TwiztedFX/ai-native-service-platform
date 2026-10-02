import type { RequirementsSpec } from "./types.ts";

const PLACEHOLDER = /\b(TODO|TBD|lorem ipsum)\b/i;

export interface VerificationResult {
  ok: boolean;
  reasons: string[];
}

export function renderVerificationReport(result: VerificationResult): string {
  const lines = result.ok
    ? ["# Verification report", "", "Result: pass", ""]
    : [
        "# Verification report",
        "",
        "Result: fail",
        "",
        "## Reasons",
        ...result.reasons.map((reason) => `- ${reason}`),
        "",
      ];
  return lines.join("\n");
}

export function verifyPackage(input: {
  spec: RequirementsSpec;
  runbook: string;
  checklist: string;
  metrics: string;
  builderAgentId: string;
  verifierAgentId: string;
}): VerificationResult {
  const reasons: string[] = [];
  if (input.builderAgentId === input.verifierAgentId) {
    reasons.push("The builder and verifier must be different agents.");
  }
  const required = [
    ["objective", input.spec.objective.value],
    ["success metric", input.spec.answers.successMetric.value],
    ["approver", input.spec.answers.approver.value],
  ] as const;
  for (const [label, value] of required) {
    if (!value || !input.runbook.includes(value)) reasons.push(`Runbook is missing the ${label}.`);
  }
  if (!input.runbook.includes("## Objective") || !input.runbook.includes("## Success metric")) {
    reasons.push("Runbook is missing required sections.");
  }
  if (!input.checklist.includes(input.spec.answers.successMetric.value)) {
    reasons.push("Checklist is missing the success metric.");
  }
  if (!input.checklist.includes(input.spec.answers.approver.value)) {
    reasons.push("Checklist is missing the approver.");
  }
  const items = input.checklist.split("\n").filter((line) => line.startsWith("- [ ]")).length;
  if (items < 5) reasons.push("Checklist needs at least five acceptance items.");
  if (!input.metrics.includes(input.spec.answers.successMetric.value)) {
    reasons.push("Metric baseline is missing the success metric.");
  }
  const combined = `${input.runbook}\n${input.checklist}\n${input.metrics}`;
  if (PLACEHOLDER.test(combined)) reasons.push("Package contains a placeholder.");
  return { ok: reasons.length === 0, reasons };
}

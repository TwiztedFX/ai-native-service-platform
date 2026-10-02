import type { RequirementsSpec } from "./types.ts";

export type AuthorArtifactKind = "runbook" | "checklist" | "metrics";

export function renderRunbook(spec: RequirementsSpec): string {
  const security = spec.securityRequirements.length
    ? spec.securityRequirements.map((item) => `- ${item.value} _(${item.source})_`).join("\n")
    : "None stated.";
  const assumptions = spec.assumptions.length
    ? spec.assumptions.map((item) => `- ${item.value}`).join("\n")
    : "None.";
  const integrations = spec.integrations.length
    ? spec.integrations.map((item) => `- ${item.value}`).join("\n")
    : "None.";
  return [
    "# Operational runbook",
    "",
    "## Objective",
    spec.objective.value,
    "",
    "## Who does the work today",
    spec.answers.currentWork.value,
    "",
    "## Success metric",
    spec.answers.successMetric.value,
    "",
    "## Systems",
    spec.answers.existingSystems.value,
    "",
    "## Constraints",
    spec.answers.constraints.value,
    "",
    "## Approver",
    spec.answers.approver.value,
    "",
    "## Procedure",
    "1. Confirm the objective with the approver before changing how people work.",
    `2. Observe the current work: ${spec.answers.currentWork.value}`,
    "3. Write each step as input, action, output, and the system used.",
    `4. Treat these limits as fixed boundaries: ${spec.answers.constraints.value}`,
    `5. Collect the success metric exactly as stated: ${spec.answers.successMetric.value}`,
    "6. Run one pilot cycle using this runbook.",
    "7. Compare the pilot result with the baseline in the metric record.",
    `8. Ask ${spec.answers.approver.value} to accept or reject the result using the checklist.`,
    "",
    "## Security and privacy notes from the customer",
    security,
    "",
    "## Accepted assumptions",
    assumptions,
    "",
    "## Integrations to respect",
    integrations,
    "",
  ].join("\n");
}

export function renderChecklist(spec: RequirementsSpec): string {
  return [
    "# Acceptance checklist",
    "",
    `- [ ] The objective matches the customer problem: ${spec.objective.value}`,
    `- [ ] The success metric is present: ${spec.answers.successMetric.value}`,
    `- [ ] The systems in scope are listed: ${spec.answers.existingSystems.value}`,
    `- [ ] The constraints are listed: ${spec.answers.constraints.value}`,
    `- [ ] The named approver has reviewed the package: ${spec.answers.approver.value}`,
    "- [ ] The verification report passed.",
    "- [ ] The baseline metric was recorded before calling the work done.",
    "",
  ].join("\n");
}

export function renderMetrics(spec: RequirementsSpec): string {
  return [
    "# Metric baseline",
    "",
    "| Metric | Baseline | Target |",
    "| --- | --- | --- |",
    `| ${spec.answers.successMetric.value} | Taken from the customer statement at delivery | Stated in the metric |`,
    "",
    `Current work context: ${spec.answers.currentWork.value}`,
    "",
  ].join("\n");
}

export function renderAuthorArtifact(kind: AuthorArtifactKind, spec: RequirementsSpec): string {
  switch (kind) {
    case "runbook":
      return renderRunbook(spec);
    case "checklist":
      return renderChecklist(spec);
    case "metrics":
      return renderMetrics(spec);
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unknown artifact kind: ${String(exhaustive)}`);
    }
  }
}

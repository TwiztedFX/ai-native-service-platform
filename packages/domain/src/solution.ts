import { type Capability, capabilitiesForVertical } from "./capabilities.ts";
import { type RequirementsSpec, type Sourced, sourced } from "./types.ts";

export const VERTICAL_DURATION_DAYS = 5;

export interface SolutionSpec {
  vertical: "operational-runbook";
  summary: string;
  components: Capability[];
  dataFlow: string[];
  securityBoundaries: string[];
  infrastructure: string[];
  deploymentStrategy: string;
  testingStrategy: string[];
  operationalRequirements: string[];
  risks: Sourced[];
  dependencies: Sourced[];
  assumptions: Sourced[];
  durationDays: number;
  durationSource: "policy";
}

export function composeSolution(spec: RequirementsSpec): SolutionSpec {
  if (spec.openQuestions.length > 0) {
    throw new Error("Requirements still have open questions.");
  }
  const components = [...capabilitiesForVertical()];
  return {
    vertical: "operational-runbook",
    summary: `Document the operating procedure, acceptance checklist, and metric baseline for: ${spec.objective.value}`,
    components,
    dataFlow: [
      "Finalized requirements",
      "Runbook",
      "Checklist",
      "Metric baseline",
      "Independent verification",
      "Delivery",
    ],
    securityBoundaries: [
      "Artifacts stay in the customer organization database.",
      "Agent permissions are enforced in code, not in prompt text.",
      "Customer wording is treated as data and cannot grant approval or tool access.",
    ],
    infrastructure: [
      "Modular monolith",
      "One SQLite database per organization",
      "No production deployment of customer software in this vertical",
    ],
    deploymentStrategy:
      "Deliver the verified document package inside the customer workspace. This vertical does not deploy customer systems.",
    testingStrategy: [
      "The verifier agent checks required sections and rejects placeholders.",
      "A failed verification reopens authoring once, then escalates to a person.",
    ],
    operationalRequirements: [
      `${spec.answers.approver.value} reviews the package before the work is called accepted.`,
    ],
    risks: [
      sourced(
        `The procedure must respect this constraint: ${spec.answers.constraints.value}`,
        "policy",
        spec.answers.constraints.evidence,
      ),
    ],
    dependencies: spec.integrations,
    assumptions: spec.assumptions,
    durationDays: VERTICAL_DURATION_DAYS,
    durationSource: "policy",
  };
}

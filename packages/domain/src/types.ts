export const sources = ["customer", "extracted", "assumption", "policy", "recommendation"] as const;

export type Source = (typeof sources)[number];

export interface Sourced {
  value: string;
  source: Source;
  evidence: string | null;
}

export function sourced(value: string, source: Source, evidence: string | null = null): Sourced {
  return { value, source, evidence };
}

export interface RequirementAnswers {
  currentWork: Sourced;
  successMetric: Sourced;
  existingSystems: Sourced;
  constraints: Sourced;
  approver: Sourced;
}

export interface RequirementsSpec {
  vertical: "operational-runbook";
  objective: Sourced;
  answers: RequirementAnswers;
  requirements: Sourced[];
  constraints: Sourced[];
  integrations: Sourced[];
  securityRequirements: Sourced[];
  successMetrics: Sourced[];
  assumptions: Sourced[];
  facts: Sourced[];
  openQuestions: string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSourced(value: unknown): value is Sourced {
  if (!isRecord(value)) return false;
  return typeof value.value === "string" && typeof value.source === "string";
}

export function isRequirementsSpec(value: unknown): value is RequirementsSpec {
  if (!isRecord(value) || !isSourced(value.objective) || !isRecord(value.answers)) return false;
  const answers = value.answers;
  return (
    isSourced(answers.currentWork) &&
    isSourced(answers.successMetric) &&
    isSourced(answers.existingSystems) &&
    isSourced(answers.constraints) &&
    isSourced(answers.approver)
  );
}

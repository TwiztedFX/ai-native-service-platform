import { type RequirementsSpec, type Sourced, sourced } from "./types.ts";

export const discoveryQuestions = [
  {
    key: "current_work",
    prompt: "Who does this work today, and about how many hours per week does it take?",
  },
  {
    key: "success_metric",
    prompt: "What measurable result would make this successful? Include a number and a unit.",
  },
  {
    key: "existing_systems",
    prompt: 'Which systems are already involved? Answer "none" if there are none.',
  },
  {
    key: "constraints",
    prompt: "What must not change, or which limits apply?",
  },
  {
    key: "approver",
    prompt: "Who is allowed to accept the delivered result?",
  },
] as const;

export type QuestionKey = (typeof discoveryQuestions)[number]["key"];

export type AnswerMap = Partial<Record<QuestionKey, string>>;

const VAGUE = /^(n\/a|na|unknown|not sure|idk|tbd|todo|\?+|-+|unsure|later)$/i;
const SECURITY_TERMS = ["gdpr", "hipaa", "pci", "soc 2", "soc2", "pii", "confidential"] as const;
const SYSTEM_TERMS = [
  "email",
  "spreadsheet",
  "excel",
  "google sheets",
  "slack",
  "whatsapp",
  "notion",
  "salesforce",
  "hubspot",
  "shopify",
] as const;

export function questionByKey(key: QuestionKey): (typeof discoveryQuestions)[number] {
  const found = discoveryQuestions.find((question) => question.key === key);
  if (!found) {
    throw new Error(`Unknown discovery question: ${key}`);
  }
  return found;
}

export function classifyAnswer(
  raw: string,
): { value: string; source: "customer" | "assumption" } | null {
  const trimmed = raw.trim();
  const assumed = /^assume:\s*(.+)$/i.exec(trimmed);
  if (assumed?.[1]) {
    const value = assumed[1].trim();
    return value.length > 0 ? { value, source: "assumption" } : null;
  }
  return trimmed.length > 0 ? { value: trimmed, source: "customer" } : null;
}

export function answerIssue(key: QuestionKey, raw: string | undefined): string | null {
  if (raw === undefined || raw.trim().length === 0) return "An answer is required.";
  const classified = classifyAnswer(raw);
  if (!classified) return "An answer is required.";
  if (VAGUE.test(classified.value)) return "This answer is too vague to become a requirement.";
  if (key === "success_metric" && !/\d/.test(classified.value)) {
    return "Include a number and a unit so the outcome can be measured.";
  }
  return null;
}

export function openQuestions(answers: AnswerMap): string[] {
  return discoveryQuestions
    .filter((question) => answerIssue(question.key, answers[question.key]) !== null)
    .map((question) => question.prompt);
}

export function extractFacts(problem: string): Sourced[] {
  const facts: Sourced[] = [];
  const duration = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|days?|weeks?)/i.exec(problem);
  if (duration?.[0]) {
    facts.push(sourced(`The problem statement mentions ${duration[0]}.`, "extracted", duration[0]));
  }
  const lower = problem.toLowerCase();
  for (const term of SYSTEM_TERMS) {
    if (lower.includes(term)) {
      facts.push(sourced(`The problem statement mentions ${term}.`, "extracted", term));
    }
  }
  for (const term of SECURITY_TERMS) {
    if (lower.includes(term)) {
      facts.push(sourced(`The problem statement mentions ${term}.`, "extracted", term));
    }
  }
  return facts;
}

function securityFromText(text: string, source: Sourced["source"]): Sourced[] {
  const lower = text.toLowerCase();
  return SECURITY_TERMS.filter((term) => lower.includes(term)).map((term) =>
    sourced(`Customer material mentions ${term}.`, source, term),
  );
}

function isNone(value: string): boolean {
  return /^(none|no|nothing|no systems?)$/i.test(value.trim());
}

export function buildRequirements(problem: string, answers: AnswerMap): RequirementsSpec {
  const issues = openQuestions(answers);
  const read = (key: QuestionKey): Sourced => {
    const raw = answers[key] ?? "";
    const classified = classifyAnswer(raw);
    if (!classified || answerIssue(key, raw)) {
      return sourced("", "customer", null);
    }
    return sourced(classified.value, classified.source, raw.trim());
  };

  const currentWork = read("current_work");
  const successMetric = read("success_metric");
  const existingSystems = read("existing_systems");
  const constraints = read("constraints");
  const approver = read("approver");
  const objective = sourced(problem.trim(), "customer", problem.trim());
  const assumptions = [currentWork, successMetric, existingSystems, constraints, approver].filter(
    (item) => item.source === "assumption" && item.value.length > 0,
  );

  const integrations =
    !existingSystems.value || isNone(existingSystems.value) ? [] : [existingSystems];
  const securityRequirements = [
    ...securityFromText(problem, "extracted"),
    ...securityFromText(constraints.value, constraints.source),
  ].filter(
    (item, index, all) => all.findIndex((other) => other.evidence === item.evidence) === index,
  );

  const requirements = [currentWork, successMetric, existingSystems, constraints, approver].filter(
    (item) => item.value.length > 0,
  );

  return {
    vertical: "operational-runbook",
    objective,
    answers: { currentWork, successMetric, existingSystems, constraints, approver },
    requirements,
    constraints: constraints.value ? [constraints] : [],
    integrations,
    securityRequirements,
    successMetrics: successMetric.value ? [successMetric] : [],
    assumptions,
    facts: extractFacts(problem),
    openQuestions: issues,
  };
}

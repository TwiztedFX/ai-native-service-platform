import type { PriceQuote } from "./pricing.ts";
import type { SolutionSpec } from "./solution.ts";
import type { RequirementsSpec, Sourced } from "./types.ts";

export const proposalExclusions = [
  "Custom software development",
  "Production access to customer systems",
  "Payment collection",
  "Building the integrations that were only identified",
  "Automatic promotion of a blueprint into production",
] as const;

export interface ProposalDocument {
  customerObjective: string;
  requirements: Sourced[];
  proposedSolution: string;
  scope: string[];
  exclusions: string[];
  deliverables: string[];
  stages: string[];
  timelineDays: number;
  priceCents: number;
  currency: "USD";
  pricingModel: "fixed_project";
  recurringMonthlyCents: number;
  recurringStatus: "quoted_not_billed";
  costBreakdown: PriceQuote;
  assumptions: Sourced[];
  dependencies: Sourced[];
  acceptanceCriteria: Sourced[];
}

export function buildProposal(
  requirements: RequirementsSpec,
  solution: SolutionSpec,
  price: PriceQuote,
): ProposalDocument {
  return {
    customerObjective: requirements.objective.value,
    requirements: requirements.requirements,
    proposedSolution: solution.summary,
    scope: solution.components.map((component) => component.name),
    exclusions: [...proposalExclusions],
    deliverables: [
      "Operational runbook",
      "Acceptance checklist",
      "Metric baseline",
      "Verification report",
    ],
    stages: solution.dataFlow,
    timelineDays: solution.durationDays,
    priceCents: price.priceCents,
    currency: price.currency,
    pricingModel: price.model,
    recurringMonthlyCents: price.maintenanceMonthlyCents,
    recurringStatus: price.recurringStatus,
    costBreakdown: price,
    assumptions: requirements.assumptions,
    dependencies: requirements.integrations,
    acceptanceCriteria: requirements.successMetrics,
  };
}

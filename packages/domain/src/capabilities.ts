export const capabilityTypes = [
  "workflow",
  "template",
  "service",
  "ai_agent",
  "human_specialist",
] as const;

export type CapabilityType = (typeof capabilityTypes)[number];

export interface Capability {
  id: string;
  type: CapabilityType;
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
  requirements: string[];
  dependencies: string[];
  costCents: number;
  securityRequirements: string[];
  reliability: string;
  version: string;
  owner: string;
  provider: string;
  executionMethod: string;
  validationTests: string[];
  vertical: "operational-runbook";
}

export const capabilityCatalog: readonly Capability[] = [
  {
    id: "cap.runbook.authoring",
    type: "workflow",
    name: "Operational runbook authoring",
    description: "Turns finalized requirements into a procedure the named approver can follow.",
    inputs: ["requirements_spec"],
    outputs: ["runbook_markdown"],
    requirements: ["finalized_requirements"],
    dependencies: [],
    costCents: 15000,
    securityRequirements: ["tenant_isolation", "customer_text_is_data"],
    reliability: "deterministic",
    version: "1.0.0",
    owner: "platform",
    provider: "internal",
    executionMethod: "agent:documentation",
    validationTests: ["runbook_contains_objective", "runbook_contains_metric"],
    vertical: "operational-runbook",
  },
  {
    id: "cap.checklist.acceptance",
    type: "template",
    name: "Acceptance checklist",
    description: "Builds the acceptance checklist from the same requirements as the runbook.",
    inputs: ["requirements_spec"],
    outputs: ["checklist_markdown"],
    requirements: ["finalized_requirements"],
    dependencies: ["cap.runbook.authoring"],
    costCents: 5000,
    securityRequirements: ["tenant_isolation"],
    reliability: "deterministic",
    version: "1.0.0",
    owner: "platform",
    provider: "internal",
    executionMethod: "agent:documentation",
    validationTests: ["checklist_has_required_items"],
    vertical: "operational-runbook",
  },
  {
    id: "cap.metrics.baseline",
    type: "template",
    name: "Metric baseline",
    description:
      "Records the customer success metric as the baseline for later outcome measurement.",
    inputs: ["requirements_spec"],
    outputs: ["metrics_markdown"],
    requirements: ["success_metric"],
    dependencies: ["cap.runbook.authoring"],
    costCents: 4000,
    securityRequirements: ["tenant_isolation"],
    reliability: "deterministic",
    version: "1.0.0",
    owner: "platform",
    provider: "internal",
    executionMethod: "agent:documentation",
    validationTests: ["metrics_include_success_metric"],
    vertical: "operational-runbook",
  },
  {
    id: "cap.verification.independent",
    type: "service",
    name: "Independent package verification",
    description: "A separate executor checks the package against the requirements.",
    inputs: ["runbook_markdown", "checklist_markdown", "metrics_markdown", "requirements_spec"],
    outputs: ["verification_report"],
    requirements: ["builder_verifier_separation"],
    dependencies: ["cap.runbook.authoring", "cap.checklist.acceptance", "cap.metrics.baseline"],
    costCents: 3000,
    securityRequirements: ["builder_cannot_self_approve"],
    reliability: "deterministic",
    version: "1.0.0",
    owner: "platform",
    provider: "internal",
    executionMethod: "agent:verifier",
    validationTests: ["verifier_agent_differs_from_builder"],
    vertical: "operational-runbook",
  },
  {
    id: "cap.delivery.package",
    type: "service",
    name: "Deliver verified package",
    description: "Publishes the verified artifacts and records the outcome baseline.",
    inputs: ["verification_report"],
    outputs: ["delivery_manifest", "outcome_baseline", "blueprint_candidate"],
    requirements: ["verification_passed"],
    dependencies: ["cap.verification.independent"],
    costCents: 2000,
    securityRequirements: ["tenant_isolation"],
    reliability: "deterministic",
    version: "1.0.0",
    owner: "platform",
    provider: "internal",
    executionMethod: "agent:delivery",
    validationTests: ["delivery_requires_passing_verification"],
    vertical: "operational-runbook",
  },
];

export function capabilitiesForVertical(): readonly Capability[] {
  return capabilityCatalog.filter((capability) => capability.vertical === "operational-runbook");
}

export function capabilityById(id: string): Capability {
  const found = capabilityCatalog.find((capability) => capability.id === id);
  if (!found) throw new Error(`Unknown capability: ${id}`);
  return found;
}

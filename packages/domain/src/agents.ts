export const agentIds = [
  "discovery",
  "solution_architect",
  "pricing",
  "proposal",
  "documentation",
  "verifier",
  "delivery",
  "optimization",
] as const;

export type AgentId = (typeof agentIds)[number];

export interface AgentDefinition {
  id: AgentId;
  role: string;
  permissions: readonly string[];
  tools: readonly string[];
  budgetCents: number;
  executionLimitCents: number;
  maxAttempts: number;
  environment: "development";
  prohibited: readonly string[];
  escalation: string;
}

const universalProhibited = ["secret.read", "production.deploy", "proposal.accept"] as const;

export const agents: Record<AgentId, AgentDefinition> = {
  discovery: {
    id: "discovery",
    role: "Discover missing requirements",
    permissions: ["discovery.write"],
    tools: ["extract_facts", "list_questions"],
    budgetCents: 0,
    executionLimitCents: 0,
    maxAttempts: 1,
    environment: "development",
    prohibited: [...universalProhibited, "artifact.write", "blueprint.promote"],
    escalation: "Leave the question open for the user.",
  },
  solution_architect: {
    id: "solution_architect",
    role: "Compose a solution from the capability registry",
    permissions: ["solution.compose"],
    tools: ["read_requirements", "read_capabilities"],
    budgetCents: 0,
    executionLimitCents: 0,
    maxAttempts: 1,
    environment: "development",
    prohibited: [...universalProhibited, "artifact.write"],
    escalation: "Stop when required answers are missing.",
  },
  pricing: {
    id: "pricing",
    role: "Calculate price from the cost policy",
    permissions: ["pricing.calculate"],
    tools: ["read_capabilities", "read_pricing_policy"],
    budgetCents: 0,
    executionLimitCents: 0,
    maxAttempts: 1,
    environment: "development",
    prohibited: [...universalProhibited],
    escalation: "Reject invalid cost inputs.",
  },
  proposal: {
    id: "proposal",
    role: "Render a proposal from the solution and quote",
    permissions: ["proposal.create"],
    tools: ["read_solution", "read_quote"],
    budgetCents: 0,
    executionLimitCents: 0,
    maxAttempts: 1,
    environment: "development",
    prohibited: [...universalProhibited],
    escalation: "A person accepts or rejects the proposal.",
  },
  documentation: {
    id: "documentation",
    role: "Author delivery artifacts",
    permissions: ["artifact.write"],
    tools: ["write_artifact"],
    budgetCents: 20000,
    executionLimitCents: 20000,
    maxAttempts: 3,
    environment: "development",
    prohibited: [...universalProhibited, "verification.write", "blueprint.promote"],
    escalation: "The verifier or a person reviews the artifact.",
  },
  verifier: {
    id: "verifier",
    role: "Independently verify artifacts",
    permissions: ["verification.write"],
    tools: ["read_artifact", "write_verification"],
    budgetCents: 5000,
    executionLimitCents: 5000,
    maxAttempts: 2,
    environment: "development",
    prohibited: [...universalProhibited, "artifact.write", "blueprint.promote"],
    escalation: "Open a human review after repeated verification failure.",
  },
  delivery: {
    id: "delivery",
    role: "Publish a verified package",
    permissions: ["delivery.publish"],
    tools: ["write_delivery", "write_outcome"],
    budgetCents: 5000,
    executionLimitCents: 5000,
    maxAttempts: 1,
    environment: "development",
    prohibited: [...universalProhibited, "blueprint.promote"],
    escalation: "Stop if verification has not passed.",
  },
  optimization: {
    id: "optimization",
    role: "Extract a candidate blueprint",
    permissions: ["blueprint.write"],
    tools: ["write_blueprint"],
    budgetCents: 1000,
    executionLimitCents: 1000,
    maxAttempts: 1,
    environment: "development",
    prohibited: [...universalProhibited, "blueprint.promote"],
    escalation: "Leave the blueprint at candidate.",
  },
};

export class AgentAuthorizationError extends Error {
  readonly code = "AGENT_FORBIDDEN";

  constructor(agentId: string, action: string) {
    super(`Agent ${agentId} cannot ${action}.`);
    this.name = "AgentAuthorizationError";
  }
}

export function getAgent(agentId: AgentId): AgentDefinition {
  return agents[agentId];
}

export function assertAllowed(agentId: AgentId, action: string): void {
  const agent = agents[agentId];
  if (agent.prohibited.includes(action) || !agent.permissions.includes(action)) {
    throw new AgentAuthorizationError(agentId, action);
  }
}

export function assertSchedulable(agentId: AgentId, budgetCents: number, costCents: number): void {
  const agent = agents[agentId];
  if (budgetCents > agent.executionLimitCents) {
    throw new AgentAuthorizationError(agentId, "exceed_execution_limit");
  }
  if (costCents > budgetCents) {
    throw new AgentAuthorizationError(agentId, "exceed_task_budget");
  }
}

export const BUILDER_AGENT: AgentId = "documentation";
export const VERIFIER_AGENT: AgentId = "verifier";

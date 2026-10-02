export interface BlueprintSpec {
  vertical: "operational-runbook";
  stage: "candidate";
  projectId: string;
  reusableComponents: string[];
  capabilities: string[];
  artifactKinds: string[];
  workflows: string[];
  prompts: string[];
  agents: string[];
  qaTests: string[];
  promotion: "candidate";
}

export function buildBlueprint(input: {
  projectId: string;
  capabilityIds: string[];
  artifactKinds: string[];
}): BlueprintSpec {
  return {
    vertical: "operational-runbook",
    stage: "candidate",
    projectId: input.projectId,
    reusableComponents: [
      "operational-runbook-template",
      "acceptance-checklist",
      "metric-baseline",
      "independent-verification",
    ],
    capabilities: input.capabilityIds,
    artifactKinds: input.artifactKinds,
    workflows: ["discover", "compose", "approve", "fulfill", "verify", "deliver"],
    prompts: [],
    agents: ["documentation", "verifier", "delivery", "optimization"],
    qaTests: ["package_contains_success_metric", "builder_is_not_verifier"],
    promotion: "candidate",
  };
}

export function assertCanPromote(): void {
  throw new Error(
    "PROMOTION_GATE: a candidate blueprint cannot move forward until an evaluation environment and a separate approval exist.",
  );
}

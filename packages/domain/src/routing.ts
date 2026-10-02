export interface RoutingRequest {
  reasoningRequired: boolean;
  codingRequired: boolean;
  latencyRequirement: "low" | "standard";
  costSensitivity: "low" | "standard" | "high";
  privacyRequirement: "standard" | "restricted";
  aiConfigured: boolean;
}

export interface RoutingDecision {
  provider: "internal-deterministic" | "openai-compatible";
  modelClass: "deterministic" | "cheap" | "standard" | "premium";
  reason: string;
}

export function routeModel(input: RoutingRequest): RoutingDecision {
  if (!input.aiConfigured) {
    return {
      provider: "internal-deterministic",
      modelClass: "deterministic",
      reason: "No AI provider is configured.",
    };
  }
  if (input.privacyRequirement === "restricted") {
    return {
      provider: "internal-deterministic",
      modelClass: "deterministic",
      reason: "Restricted customer data stays on the deterministic engine.",
    };
  }
  if (input.costSensitivity === "high" || input.latencyRequirement === "low") {
    return {
      provider: "openai-compatible",
      modelClass: "cheap",
      reason: "The request is cost or latency sensitive. One configured endpoint is available.",
    };
  }
  if (input.reasoningRequired || input.codingRequired) {
    return {
      provider: "openai-compatible",
      modelClass: "premium",
      reason: "The request asks for reasoning or coding. One configured endpoint is available.",
    };
  }
  return {
    provider: "openai-compatible",
    modelClass: "standard",
    reason: "Default class for the single configured endpoint.",
  };
}

import { type AgentId, assertSchedulable } from "./agents.ts";
import { capabilityById } from "./capabilities.ts";

export const taskKeys = [
  "author_runbook",
  "author_checklist",
  "author_metrics",
  "verify_package",
  "publish_delivery",
  "human_review",
] as const;

export type TaskKey = (typeof taskKeys)[number];

export type TaskKind = "author" | "verify" | "deliver" | "approval";

export interface TaskDraft {
  key: TaskKey;
  title: string;
  kind: TaskKind;
  executor: AgentId | "human";
  dependsOn: TaskKey[];
  budgetCents: number;
  capabilityId: string | null;
}

const taskCapability: Record<Exclude<TaskKey, "human_review">, string> = {
  author_runbook: "cap.runbook.authoring",
  author_checklist: "cap.checklist.acceptance",
  author_metrics: "cap.metrics.baseline",
  verify_package: "cap.verification.independent",
  publish_delivery: "cap.delivery.package",
};

export function executionCostCents(taskKey: TaskKey): number {
  if (taskKey === "human_review") return 0;
  return capabilityById(taskCapability[taskKey]).costCents;
}

export function agentForTask(taskKey: TaskKey): AgentId | "human" {
  switch (taskKey) {
    case "author_runbook":
    case "author_checklist":
    case "author_metrics":
      return "documentation";
    case "verify_package":
      return "verifier";
    case "publish_delivery":
      return "delivery";
    case "human_review":
      return "human";
    default: {
      const exhaustive: never = taskKey;
      throw new Error(`Unknown task ${String(exhaustive)}`);
    }
  }
}

export function createDefaultTaskGraph(): TaskDraft[] {
  const drafts: TaskDraft[] = [
    {
      key: "author_runbook",
      title: "Author operational runbook",
      kind: "author",
      executor: "documentation",
      dependsOn: [],
      budgetCents: executionCostCents("author_runbook"),
      capabilityId: taskCapability.author_runbook,
    },
    {
      key: "author_checklist",
      title: "Author acceptance checklist",
      kind: "author",
      executor: "documentation",
      dependsOn: ["author_runbook"],
      budgetCents: executionCostCents("author_checklist"),
      capabilityId: taskCapability.author_checklist,
    },
    {
      key: "author_metrics",
      title: "Author metric baseline",
      kind: "author",
      executor: "documentation",
      dependsOn: ["author_runbook"],
      budgetCents: executionCostCents("author_metrics"),
      capabilityId: taskCapability.author_metrics,
    },
    {
      key: "verify_package",
      title: "Verify delivery package",
      kind: "verify",
      executor: "verifier",
      dependsOn: ["author_runbook", "author_checklist", "author_metrics"],
      budgetCents: executionCostCents("verify_package"),
      capabilityId: taskCapability.verify_package,
    },
    {
      key: "publish_delivery",
      title: "Publish verified package",
      kind: "deliver",
      executor: "delivery",
      dependsOn: ["verify_package"],
      budgetCents: executionCostCents("publish_delivery"),
      capabilityId: taskCapability.publish_delivery,
    },
  ];
  for (const draft of drafts) {
    if (draft.executor !== "human") {
      assertSchedulable(draft.executor, draft.budgetCents, executionCostCents(draft.key));
    }
  }
  return drafts;
}

export function isTaskKey(value: string): value is TaskKey {
  return (taskKeys as readonly string[]).includes(value);
}

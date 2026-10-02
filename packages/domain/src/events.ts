export const domainEventTypes = [
  "CustomerCreated",
  "RequirementSubmitted",
  "RequirementValidated",
  "SolutionGenerated",
  "ProposalCreated",
  "ProposalAccepted",
  "ProjectCreated",
  "TaskCreated",
  "TaskStarted",
  "TaskCompleted",
  "TaskFailed",
  "HumanApprovalRequested",
  "HumanApprovalGranted",
  "SolutionCompleted",
  "BlueprintCreated",
  "OutcomeRecorded",
  "ProjectCancelled",
] as const;

export type DomainEventType = (typeof domainEventTypes)[number];

export const eventLabels: Record<DomainEventType, string> = {
  CustomerCreated: "Customer created",
  RequirementSubmitted: "Problem submitted",
  RequirementValidated: "Requirements validated",
  SolutionGenerated: "Solution generated",
  ProposalCreated: "Proposal created",
  ProposalAccepted: "Proposal accepted",
  ProjectCreated: "Project created",
  TaskCreated: "Task created",
  TaskStarted: "Task started",
  TaskCompleted: "Task completed",
  TaskFailed: "Task failed",
  HumanApprovalRequested: "Human approval requested",
  HumanApprovalGranted: "Human approval granted",
  SolutionCompleted: "Solution delivered",
  BlueprintCreated: "Blueprint candidate created",
  OutcomeRecorded: "Outcome recorded",
  ProjectCancelled: "Project cancelled",
};

export function assertEventType(value: string): asserts value is DomainEventType {
  if (!(domainEventTypes as readonly string[]).includes(value)) {
    throw new Error(`Unknown event type: ${value}`);
  }
}

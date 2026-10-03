# Data architecture

## Control database

`data/control.sqlite` stores users, sessions, organizations, memberships, and auth audit rows. It does not store customer problem text.

## Tenant database

`data/tenants/{organizationId}.sqlite` stores customers, engagements, answers, requirements, solutions, proposals, approvals, projects, payments, tasks, executions, artifacts, outcomes, blueprints, domain events, agent runs, and tenant audit rows.

The file path is accepted only when the organization id is a UUID. Opening the file requires a membership row. Queries still include `organization_id`, so a row written with another organization's id is invisible to the API.

## Requirements provenance

Every stored requirement carries `source`: `customer`, `extracted`, `assumption`, `policy`, or `recommendation`. The runbook vertical uses the first four. Recommendations are reserved for later composer choices.

## Events that are written

`CustomerCreated`, `RequirementSubmitted`, `RequirementValidated`, `SolutionGenerated`, `ProposalCreated`, `ProposalAccepted`, `ProjectCreated`, `TaskCreated`, `TaskStarted`, `TaskCompleted`, `TaskFailed`, `HumanApprovalRequested`, `HumanApprovalGranted`, `SolutionCompleted`, `BlueprintCreated`, `OutcomeRecorded`, `ProjectCancelled`.

`PaymentReceived`, `DeploymentStarted`, `DeploymentCompleted`, `IncidentCreated`, and `OptimizationProposed` are not emitted. A verified Stripe webhook can set `projects.commercial_status` to `paid`. That update is not a `PaymentReceived` domain event.

## Planned entities that are not tables

Brand, subscription, invoice, credential vault, and incident. They are listed in the product roadmap and are not created as empty tables. `payments` stores a checkout session and becomes paid only from a verified provider event.

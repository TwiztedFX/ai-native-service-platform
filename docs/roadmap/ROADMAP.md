# Roadmap

Advance a phase only when its acceptance checks are true. A page or a type existing is not enough.

## Phase 0 — Foundation

Implemented in 0.1.0: repository layout, ADRs, CI workflow, loopback server, auth, per-tenant SQLite, and the domain model for the first vertical.

Still blocked: the GitHub repository was not created. The available token returned `403` on create.

## Phase 1 — Vertical slice

Implemented for operational runbooks: discovery, requirements, solution, price, proposal, acceptance, task graph, execution, repair, escalation, verification, delivery, outcome baseline, and candidate blueprint.

Acceptance is the test suite in `apps/platform/test/loop.test.ts` plus the domain tests. Browser confirmation of the workspace is recorded in the changelog notes for the commit that verified it.

## Phase 2 — Agent platform

Planned. Model routing currently chooses a class and, when a key exists, one configured endpoint. It does not choose among several live providers. Evaluation datasets are not built.

## Phase 3 — Solution platform

Partly started. The capability registry and blueprint candidate exist for one vertical. A marketplace and a composer that can choose among verticals are planned.

## Phase 4 — Commercial platform

Planned. Needs a payment-provider account. Do not mark invoices as paid before that exists.

## Phase 5 — Provider network

Planned. Human specialists are represented only as the human review task.

## Phase 6 — Autonomous fulfillment

Not started. This vertical delivers documents. It does not deploy customer software.

## Phase 7 — Optimization

Promotion requires a stored passing report for `eval-operational-runbook-1` and a non-empty human approval note from a role that is not the customer. The note is an explicit approval. Automatic promotion stays rejected, and promotion does not deploy anything.

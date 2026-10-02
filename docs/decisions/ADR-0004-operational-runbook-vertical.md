# ADR-0004: Operational runbook vertical

- Status: accepted
- Date: 2026-10-03

## Decision

The first end-to-end vertical produces an operational runbook, an acceptance checklist, a metric baseline, and a verification report.

## Alternatives

- Custom software delivery. It needs a sandbox, a repository host, and a deployment target that are not available.
- A regulated workflow such as medical billing. The compliance bar is too high for the first slice.
- Several verticals at once. That would leave all of them shallow.

## Rationale

The deliverable is real text produced from the customer's answers. A separate verifier can reject it when the success metric or approver is missing. No payment account or production credential is required.

## Consequences

The capability registry currently contains only this vertical. A second vertical should add capabilities and tests rather than branching the orchestrator on ad hoc conditionals.

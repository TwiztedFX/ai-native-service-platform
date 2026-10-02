# ADR-0007: Closed blueprint promotion

- Status: accepted
- Date: 2026-10-03

## Decision

A completed project writes a blueprint at stage `candidate`. `assertCanPromote` always rejects promotion.

## Alternatives

- Automatically mark successful blueprints as production-ready.
- Skip blueprint extraction until the learning system exists.

## Rationale

The flywheel needs a reusable record, and it also needs a gate so an agent cannot promote its own idea. The record is the extraction. The closed gate is the control. An evaluation environment does not exist yet, so there is no honest next stage.

## Consequences

The promote endpoint returns `409 PROMOTION_GATE`. A future ADR must define sandbox, evaluation, and the human approval required before a candidate can move.

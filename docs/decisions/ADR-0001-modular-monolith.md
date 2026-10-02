# ADR-0001: Modular monolith

- Status: accepted
- Date: 2026-10-03

## Decision

Ship the first system as one Node.js process with module boundaries, not as microservices.

## Alternatives

- Microservices for API, orchestrator, and portal.
- A serverless split across hosted functions.

## Rationale

The vertical slice needs shared transactions more than independent deploys. The development machine has no Docker and limited CPU. A monolith can still enforce provider, permission, and tenant boundaries in code.

## Consequences

Services are not separately deployable. Extract one only when scale, security isolation, or release cadence requires it. The `services/` directory documents that choice instead of holding empty services.

# System architecture

Status: implemented as a modular monolith on 2026-10-03.

## Why this shape

The machine available for the first build has 4 logical processors, 11.8 GB of RAM, Node.js 24, and no Docker. A single process with clear modules can run the vertical slice and still keep provider, permission, and tenant boundaries enforceable. Separate network services would add process management without a scaling requirement.

## Runtime

- `apps/platform/src/server.ts` listens on `127.0.0.1:8787`.
- `apps/platform/src/app.ts` is the HTTP boundary used by tests without opening a port.
- `@platform/domain` is pure TypeScript. It does not open a database or a network connection.
- `@platform/providers` is the only place that builds an AI HTTP request.

## Request path

1. Session cookie is hashed and looked up in the control database.
2. The organization id in the URL is checked against membership.
3. Only then is that organization's SQLite file opened.
4. Domain functions produce requirements, solutions, quotes, proposals, artifacts, and verification results.
5. The orchestrator checkpoints each task. A task left in `running` is returned to `pending` on the next run.

## Enforcement versus reasoning

Deterministic code enforces permissions, budgets, price, verification, and tenant scope. The optional completion client may store a narrative summary. That summary is not an input to pricing or acceptance.

## Target, not current

A later version can extract the orchestrator or the portal if deployment, scale, or security isolation requires it. That extraction is not justified yet. See ADR-0001.

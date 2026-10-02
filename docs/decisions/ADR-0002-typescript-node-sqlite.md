# ADR-0002: TypeScript, Node 24, and SQLite

- Status: accepted
- Date: 2026-10-03

## Decision

Use TypeScript on Node.js 24, npm workspaces, Fastify, Zod, and `node:sqlite`. One database file per organization plus a control database.

## Alternatives

- Postgres in Docker. Docker is not installed, and installing it is heavier than the isolation we need for the first slice.
- A document file per engagement. That would make queries and transactions harder to test.
- Python. It is installed, and the Node ecosystem is a better fit for the HTTP API and the existing test tools.

## Rationale

`node:sqlite` ships with Node 24, so the app does not need a native database driver. Separate files give each organization its own database, which is a stronger boundary than a `WHERE` clause alone. Queries still filter `organization_id`.

## Consequences

SQLite is not encrypted at rest. A later hosted environment can replace the database adapter if Postgres row-level security becomes the isolation mechanism. That adapter does not exist yet.

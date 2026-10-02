# Architecture

Outcome OS 0.1.0 is a modular monolith. One Node.js process serves the API and the workspace. Domain rules live in `@platform/domain`. AI vendor calls live in `@platform/providers`. Tenant state lives in one SQLite file per organization.

The long-term picture — a separate orchestrator, provider network, and learning loop — is a target, not the running system. See `docs/architecture/SYSTEM_ARCHITECTURE.md` and `docs/roadmap/ROADMAP.md`.

```text
Workspace UI
    │
    ▼
HTTP API ── session and membership ── control database
    │
    ▼
Tenant database
    │
    ├── discovery, solution, pricing, proposal
    └── task graph ── documentation agent
                    └── verifier agent
                        └── delivery agent
                            └── candidate blueprint
```

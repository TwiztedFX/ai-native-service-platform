# Outcome OS

Outcome OS is an AI-native service production platform. A business describes a problem. The platform turns that problem into requirements, a solution, a price, a proposal, a project, and a verified deliverable.

The first vertical is **operational runbook production**. It is a real loop, not a mocked status board. Discovery, pricing, fulfillment, verification, and blueprint extraction run in this repository. Live model calls and production deployment do not. A project is marked paid only after a verified Stripe event.

## Status

| Area | State |
| --- | --- |
| Account, organization, and role checks | Implemented and tested |
| One SQLite database per organization | Implemented and tested |
| Structured discovery and requirements | Implemented and tested |
| Capability registry, solution, price, proposal | Implemented and tested |
| Task graph, execution, repair, human escalation | Implemented and tested |
| Independent verification and delivery package | Implemented and tested |
| Outcome baseline and candidate blueprint | Implemented and tested |
| OpenAI-compatible narrative adapter | Implemented and tested with a fake network client. Inactive unless `AI_API_KEY` is set in the process environment or a gitignored `.env`. It cannot change price or permissions |
| Billing | Checkout and webhook are implemented. Without both Stripe secrets, acceptance stays `accepted_unbilled`. `paid` requires a verified Stripe event whose amount matches the proposal |
| Subscriptions and white-label brands | Planned |
| GitHub remote | Blocked. The signed-in token can read repositories for `TwiztedFX` and cannot create one (`403`) |

## Run locally

```bash
npm install
npm test
npm run dev
```

Open `http://127.0.0.1:8787`. Node.js 24 or newer is required. Docker is not required.

## Layout

- `apps/platform` — HTTP API, workspace UI, tenant databases, orchestrator
- `packages/domain` — requirements, pricing, artifacts, agent permissions, verification
- `packages/providers` — replaceable AI completion clients
- `docs` — product, architecture, decisions, and operations

`services/`, `agents/`, and `infrastructure/` explain why those boundaries are still inside the modular monolith.

## License

MIT. See [LICENSE](LICENSE).

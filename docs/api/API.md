# HTTP API

The route list below matches `apps/platform/src/app.ts`. Errors use `{ "error": { "code", "message", "details" } }`.

Authenticated routes use the `session` cookie.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness. Reports whether an AI key is set, not the key. Does not require a key |
| GET | `/api/ready` | Readiness. `200` only when the control schema is reachable; otherwise `503` |
| GET | `/api/capabilities` | Capability registry for the runbook vertical |
| POST | `/api/auth/register` | Create a user and session |
| POST | `/api/auth/login` | Open a session |
| POST | `/api/auth/logout` | Delete the session |
| GET | `/api/session` | Current user and organizations |
| POST | `/api/organizations` | Create an organization owned by the caller |
| POST | `/api/organizations/:orgId/customers` | Create a customer |
| GET | `/api/organizations/:orgId/customers` | List customers |
| POST | `/api/organizations/:orgId/engagements` | Submit a problem |
| GET | `/api/organizations/:orgId/engagements` | List engagements |
| GET | `/api/organizations/:orgId/engagements/:engagementId` | Discovery, requirements, and proposal |
| POST | `.../answers` | Save discovery answers |
| POST | `.../requirements` | Finalize requirements, or `409 OPEN_QUESTIONS` |
| POST | `.../solution` | Compose solution, quote, and proposal |
| POST | `.../narrative` | Optional model summary. `409` when no provider is allowed |
| POST | `/api/organizations/:orgId/proposals/:proposalId/accept` | Accept and create the project |
| GET | `/api/organizations/:orgId/projects/:projectId` | Tasks, executions, artifacts, outcome, blueprint |
| POST | `/api/organizations/:orgId/projects/:projectId/checkout` | Open Stripe Checkout for the proposal price. `409 PAYMENT_NOT_CONFIGURED` when Stripe secrets are missing |
| POST | `/api/billing/webhook` | Verify a Stripe signature. Sets `paid` only for a matching `checkout.session.completed` event |
| POST | `.../run` | Execute until delivered, blocked, or idle |
| POST | `.../outcomes` | Record the measured after-value |
| POST | `.../reviews/:taskId` | `retry` or `stop` a human review |
| POST | `.../blueprint/promote` | Always `409 PROMOTION_GATE` in this version |
| GET | `.../artifacts/:artifactId` | One artifact, scoped to the organization |

`fault` on the run route is refused unless the process was constructed with `allowFaults`. The normal server does not set that flag. Tests use it to force a missing metric.

The workspace is served from `/`, `/styles.css`, and `/app.js`.

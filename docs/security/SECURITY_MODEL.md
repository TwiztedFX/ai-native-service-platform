# Security model

## Trust boundaries

- The browser is untrusted. Cookies are HttpOnly. A mutating request that sends an `Origin` must match the `Host`.
- Customer problem text and model output are untrusted data. They are stored and displayed as text. They are not parsed as instructions, SQL, or tool calls.
- Agents receive an action name. `assertAllowed` checks that action against a fixed permission list.
- The AI adapter places the system instruction and the customer text in separate messages. Tool calls in a provider payload are ignored. Only string content can be stored, and only as narrative.
- Restricted privacy routes the narrative request back to the deterministic engine and does not call the provider.

## Tenant isolation

Membership is checked in the control database. The tenant file is then opened by UUID. Application queries also filter `organization_id`. Tests cover a non-member, a different organization's database, a poisoned row inside the right file, and a rejected path.

## Secrets

No customer credential vault exists yet. Agents have `secret.read` prohibited. Do not add a tool that returns raw secrets to an agent. When a vault is added, tools should receive a capability handle.

## Budgets

Each task has a budget in cents equal to its capability cost. If the recorded cost is greater than the budget, the task fails and a human review is opened. Agent execution limits are checked when the graph is built.

## Known limits

Local SQLite files are not encrypted at rest. `npm run backup` copies them with SQLite's backup API and does not encrypt the copies. The process listens on `HOST`, which defaults to `127.0.0.1`. Set `HOST=0.0.0.0` only behind a TLS proxy, with `COOKIE_SECURE=1`. Responses set `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and a same-origin content security policy without inline scripts. There is no public production host and no external audit pipeline in this version.

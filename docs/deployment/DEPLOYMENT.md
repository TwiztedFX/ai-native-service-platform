# Deployment

## Current

Local process:

```bash
npm start
```

`HOST` defaults to `127.0.0.1`. `PORT` defaults to `8787`. Set `HOST=0.0.0.0` only when a TLS proxy is in front of the process. Set `COOKIE_SECURE=1` only behind HTTPS. Set `DATABASE_DIR` to a persistent directory.

`npm run backup` copies `control.sqlite` and each tenant SQLite file under `DATABASE_DIR` into a timestamped directory under `BACKUP_DIR` (default `./backups`). The copy uses SQLite's backup API. It does not encrypt the files. Keep `BACKUP_DIR` outside `DATABASE_DIR`.

## Container image

`Dockerfile` builds a Node 24 bookworm-slim image, installs dependencies with `npm ci`, and runs as the `node` user:

```text
node apps/platform/src/server.ts
```

The image sets `HOST=0.0.0.0` so the process is reachable inside the container. Publish it only behind a TLS proxy. The image contains no secrets. GitHub Actions builds `outcome-os:ci` and does not push it.

Docker is not required on a development machine.

## Payments

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are optional. Leave both empty in `.env.example` and in any committed file. Copy the names into a gitignored `.env` or the process environment when a Stripe account exists.

If either value is missing, `POST /api/organizations/:orgId/projects/:projectId/checkout` and `POST /api/billing/webhook` return `409 PAYMENT_NOT_CONFIGURED`. The project stays `accepted_unbilled`.

When both are set, checkout creates a Stripe Checkout Session for the stored proposal amount in integer cents. `commercial_status` becomes `checkout_open` only after Stripe returns a session id. It becomes `paid` only after `POST /api/billing/webhook` verifies the `Stripe-Signature` header and the event is `checkout.session.completed` with an amount that matches the proposal. Other events do not change status. The browser cannot mark a project paid.

## Not deployed

There is no public production host, staging host, domain, or rollback pipeline. GitHub Actions runs lint, typecheck, audit, tests, and the image build. It does not deploy.

Do not describe a preview URL as available.

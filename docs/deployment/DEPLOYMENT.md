# Deployment

## Current

Local process only:

```bash
npm start
```

It binds to `127.0.0.1`. Set `COOKIE_SECURE=1` only behind HTTPS. Set `DATABASE_DIR` to a persistent directory.

## Payments

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are optional. Leave both empty in `.env.example` and in any committed file. Copy the names into a gitignored `.env` or the process environment when a Stripe account exists.

If either value is missing, `POST /api/organizations/:orgId/projects/:projectId/checkout` and `POST /api/billing/webhook` return `409 PAYMENT_NOT_CONFIGURED`. The project stays `accepted_unbilled`.

When both are set, checkout creates a Stripe Checkout Session for the stored proposal amount in integer cents. `commercial_status` becomes `checkout_open` only after Stripe returns a session id. It becomes `paid` only after `POST /api/billing/webhook` verifies the `Stripe-Signature` header and the event is `checkout.session.completed` with an amount that matches the proposal. Other events do not change status. The browser cannot mark a project paid.

## Not deployed

There is no staging host, production host, domain, or rollback pipeline. GitHub Actions runs lint, typecheck, audit, and tests when the repository exists. It does not deploy.

Do not describe a preview URL as available.

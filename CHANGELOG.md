# Changelog

## 0.1.0 - 2026-10-03

### Added

- Outcome OS foundation: modular monolith, per-organization SQLite, session auth, and CI.
- Operational runbook vertical from problem statement through verified delivery, outcome baseline, and a candidate blueprint.
- Provider interface for an OpenAI-compatible completion API. Narrative text cannot change price or permissions.

### Not in this version

- White-label brands, production deployment, and multi-model routing beyond one configured endpoint.
- Marking a project paid without `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and a verified `checkout.session.completed` event.

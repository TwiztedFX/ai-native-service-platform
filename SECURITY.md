# Security

## Reporting

Report vulnerabilities privately to the repository owner. Do not open a public issue that includes exploit detail.

## Implemented in this version

- Password hashing with scrypt. Session tokens are stored as SHA-256 hashes in an HttpOnly cookie.
- Organization membership is required before a tenant database is opened.
- Tenant data lives in a separate SQLite file per organization. Queries also filter on `organization_id`.
- Agent permissions are checked in code. Customer text is stored as data and cannot grant `proposal.accept`, artifact approval, or secret access.
- The builder agent and the verifier agent are different identities.
- Mutating browser requests with a mismatched `Origin` are rejected.
- Auth routes are rate limited.
- Logs redact cookies and authorization headers.
- `.env` is gitignored. `.env.example` contains empty placeholders.
- Blueprint promotion past `candidate` is rejected.

## Not implemented yet

- OAuth, SSO, and external secret managers
- Payment-provider security review
- Sandboxed code execution for a software-delivery vertical
- Production network policies, backups, and a hosted staging environment

This repository has not had an independent penetration test.

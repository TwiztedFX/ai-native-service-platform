# Contributing

1. Read `docs/engineering/DEVELOPMENT_GUIDE.md` and the ADRs in `docs/decisions`.
2. Keep provider-specific code inside `packages/providers`.
3. Do not let an agent approve its own artifact. The documentation agent writes. The verifier agent checks.
4. Do not invent customer requirements. Missing answers stay open.
5. Mark planned behavior as planned in the docs. Do not describe it as shipped.
6. Run `npm run lint`, `npm run typecheck`, and `npm test` before pushing.
7. Use commit prefixes: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `security`, `infra`.

There is no separate staging environment yet. Do not point this app at production customer credentials.

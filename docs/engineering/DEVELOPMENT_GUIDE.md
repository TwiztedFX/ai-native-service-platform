# Development guide

## Requirements

- Node.js 24 or newer
- npm workspaces

Python is installed on the original development machine and is not used. Docker is not required.

## Commands

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run lint
```

`npm run dev` serves `http://127.0.0.1:8787` and stores databases under `data/`.

On startup the server reads a gitignored `.env` in the project root. Existing process environment variables win. Copy `.env.example` to `.env` and set `AI_API_KEY` plus `AI_MODEL` when you want narrative summaries. Leave the key empty to stay deterministic. Restart the server after changing `.env`. Do not commit `.env`.

Tests use in-memory SQLite and a reduced scrypt cost. The server uses scrypt cost 16384. Tests do not call a live model. The provider test injects `fetch`.

## Change rules

- Put business rules that must stay deterministic in `packages/domain`.
- Put vendor HTTP details in `packages/providers`.
- Add a migration SQL file for schema changes. Do not edit a migration that has already shipped; add the next one.
- Update the ADR and the architecture page when a boundary changes.
- Keep the status table in the README accurate.

## Commit identity

This environment has no global Git config, and the project does not write one. Set `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, and `GIT_COMMITTER_EMAIL` for the commit if Git would otherwise refuse it.

# Schema

The executable schema is:

- `apps/platform/migrations/001_control.sql`
- `apps/platform/migrations/001_tenant.sql`
- `apps/platform/migrations/002_tenant.sql`
- `apps/platform/migrations/003_tenant.sql`

`schema_migrations` records which script has been applied. Change the schema by adding `002_*.sql` and teaching `apps/platform/src/db/database.ts` to run it. Do not rewrite `001` after release.

Column and isolation notes are in `docs/architecture/DATA_ARCHITECTURE.md`.

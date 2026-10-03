# Runbook

## Start

```bash
npm start
```

The process listens on `HOST` (default `127.0.0.1`) and `PORT` (default `8787`). Set `HOST=0.0.0.0` only behind a TLS proxy, and set `COOKIE_SECURE=1` only behind HTTPS. Data is created under `DATABASE_DIR` (default `./data`).

## Health

`GET /api/health` is liveness. It returns `status: ok` and whether an AI key is present. It does not reveal the key and does not require one.

`GET /api/ready` opens the control database and returns `200` with `status: ready` only when the control schema is reachable. Otherwise it returns `503`.

## Backup

```bash
npm run backup
```

This writes a timestamped directory under `BACKUP_DIR` (default `./backups`) containing `control.sqlite` and `tenants/*.sqlite`. The copy uses SQLite's backup API so the files are consistent. It does not encrypt them. `BACKUP_DIR` must be outside `DATABASE_DIR`. There is no remote backup job.

## A project stuck in running

Run fulfillment again. Tasks left in `running` are set back to `pending` and executed from their last committed attempt. Completed tasks are not repeated. A delivered project is left as delivered.

## A project that needs a person

The workspace shows the human review. An owner or operator can approve another attempt or stop the project. A customer cannot make that decision. Stopping writes `ProjectCancelled`.

## Outcome after delivery

The baseline is recorded automatically from the customer's metric or hours. Record the measured after-value from the project screen. Do not invent it.

## What this runbook does not cover

Hosted staging, rollback of a production deploy, or payment-provider outages. Those environments do not exist yet.

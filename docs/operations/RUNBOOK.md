# Runbook

## Start

```bash
npm start
```

The process listens on `127.0.0.1` and the port in `PORT` (default `8787`). Data is created under `DATABASE_DIR` (default `./data`).

## Health

`GET /api/health` returns `status: ok` and whether an AI key is present. It does not reveal the key.

## A project stuck in running

Run fulfillment again. Tasks left in `running` are set back to `pending` and executed from their last committed attempt. Completed tasks are not repeated. A delivered project is left as delivered.

## A project that needs a person

The workspace shows the human review. An owner or operator can approve another attempt or stop the project. A customer cannot make that decision. Stopping writes `ProjectCancelled`.

## Outcome after delivery

The baseline is recorded automatically from the customer's metric or hours. Record the measured after-value from the project screen. Do not invent it.

## Backup

Copy `data/control.sqlite` and `data/tenants/` while the process is stopped. There is no remote backup job.

## What this runbook does not cover

Hosted staging, rollback of a production deploy, or payment-provider outages. Those environments do not exist yet.

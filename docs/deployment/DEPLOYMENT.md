# Deployment

## Current

Local process only:

```bash
npm start
```

It binds to `127.0.0.1`. Set `COOKIE_SECURE=1` only behind HTTPS. Set `DATABASE_DIR` to a persistent directory.

## Not deployed

There is no staging host, production host, domain, or rollback pipeline. GitHub Actions runs lint, typecheck, audit, and tests when the repository exists. It does not deploy.

Do not describe a preview URL as available.

# Hotel Reservation Backend

Simple Node.js + Express backend for a hotel reservation system. This repository is configured to use **PostgreSQL** as the single supported database.

Quick start (local):
1. Copy `.env.example` to `.env` and set local Postgres creds (or use existing `.env`).
2. Install dependencies: `npm install`
3. Seed the DB (optional): `npm run seed`
4. Start the server: `npm start` (or `npm run dev` for nodemon)
5. Health check: `GET /api/health` — confirms server and DB connectivity

Deployment:
See `DEPLOYMENT.md` for Render and hosted Postgres deployment instructions and environment variable checklist.

Notes:
- MySQL and MongoDB support have been removed; if you relied on those before, migrate data to Postgres before deploying.
- For any issues, check the server logs for diagnostics and reach out with details.

Hardening commands:
- `npm run backup` -> create Postgres SQL backup in `backups/`
- `npm run restore -- <path-to-backup.sql>` -> restore database from SQL file
- `npm run e2e:full` -> full flow smoke test (booking -> KOT -> billing -> trends -> invoice PDF)

Backup scheduler + health alert webhook:
- `npm run monitor:run` -> run scheduler + health monitor as standalone worker
- `ENABLE_BACKUP_SCHEDULER=true` -> enables periodic SQL backups
- `BACKUP_INTERVAL_HOURS=24` -> backup interval in hours
- `BACKUP_RETENTION_DAYS=7` -> auto-delete old backups from `backups/`
- `BACKUP_ON_STARTUP=true` -> run one backup immediately at boot
- `HEALTH_MONITOR_ENABLED=true` -> runs DB health checks in background
- `HEALTH_CHECK_INTERVAL_SECONDS=60` -> monitor interval
- `HEALTH_ALERT_COOLDOWN_MINUTES=30` -> cooldown to avoid alert spam
- `HEALTH_ALERT_WEBHOOK_URL=https://...` -> POST webhook for `health_down`, `health_recovered`, `backup_failed`

Note:
- Scheduler/monitor run only in non-serverless runtime (`!VERCEL`), because serverless instances are not reliable for timers.

Production checklist:
- Set strong `JWT_SECRET` (16+ chars), `FRONTEND_URL`, and optional `RATE_LIMIT_MAX`
- Keep `REQUIRE_HTTPS=true` in production
- Run periodic backups and test restore monthly

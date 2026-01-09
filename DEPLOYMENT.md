Deployment — PostgreSQL only

This project is now **PostgreSQL-only**. MySQL and MongoDB support has been removed. Before deploying, ensure your Render (or other host) environment is configured for Postgres.

Required environment variables (Render dashboard / host environment):
- `DATABASE_URL` — full Postgres connection string for your managed DB (required)
- `PG_SSL` — set to `true` for hosted Postgres that requires TLS (e.g., Render). For local dev use `PG_SSL=false`.
- `NODE_ENV=production` — set in production
- `JWT_SECRET` — strong secret used for auth
- Optionally: `SMTP_*`, `REDIS_URL`, and other service-specific env vars

Important notes:
- Do NOT point `DATABASE_URL` to `localhost` in production — the app will fail early.
- Do NOT set `PORT` to `5432` (Postgres default). Let the platform provide `PORT` or set your web port appropriately.
- The app supports automatic SSL fallback for local dev (it will retry without SSL if the server does not support SSL), but production should use `PG_SSL=true` when required.

Health and diagnostics:
- `GET /api/health` — basic health check including DB connection status
- `GET /api/db-test` — runs a simple SQL query against Postgres

Seeding and migrations:
- Seed the database locally with: `npm run seed` or `node src/scripts/seedDatabase.js`
- The project currently uses Sequelize. In development the app may `sync` models; in production migrations should be applied via your migration workflow.

Regenerate lockfile (recommended):
- Locally: `del package-lock.json && npm install` (Windows) or `rm package-lock.json && npm install` (Unix)

Troubleshooting:
- Check the service logs for masked DB URL and SSL decisions printed by the app.
- If you see "server does not support SSL", set `PG_SSL=false` locally or let the automatic SSL fallback handle it.

If you want, I can add Render-specific step-by-step instructions and a sample service environment configuration.

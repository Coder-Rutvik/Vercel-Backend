Deploy notes — PostgreSQL (Render)

- Use Render's dashboard to set the DATABASE_URL environment variable (Render provides this automatically for managed Postgres services).
- If your managed Postgres requires SSL (Render does), set the environment variable `PG_SSL=true` in the Render service settings.
- Do NOT commit database credentials to source control; keep them in Render's secret environment variables or your `.env` for local development.

Local development:
- You can keep `DATABASE_URL` pointing to your local Postgres, or keep the `POSTGRES_*` variables and leave `PG_SSL=false`.

Quick checklist before deploy:
1. Ensure `DATABASE_URL` is set in Render (or `POSTGRES_*` if you prefer a different setup).
2. Add `PG_SSL=true` if connecting to a hosted DB with TLS.
3. Add `JWT_SECRET` and other secrets in Render's environment variables (do not store them in the repo).
4. Deploy and watch the logs for connection diagnostics (the app prints masked DB URL and SSL decisions).

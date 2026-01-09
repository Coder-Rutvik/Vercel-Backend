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
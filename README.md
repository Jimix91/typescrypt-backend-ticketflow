# TicketFlow – Internal IT Support Management System (Backend API)

Internal Helpdesk backend built with Express + TypeScript + Prisma + PostgreSQL.

## Requirements coverage

- REST API with Express + TypeScript
- PostgreSQL via Prisma ORM
- Models: `User`, `Ticket`, `Comment`
- Full CRUD for `Ticket`

## Endpoints

- `GET /api/health`
- `GET /api/users`
- `POST /api/users`
- `GET /api/tickets`
- `GET /api/tickets/:ticketId`
- `POST /api/tickets`
- `PUT /api/tickets/:ticketId`
- `DELETE /api/tickets/:ticketId`

## Setup

1. Create `.env` from `.env.example`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate Prisma client and run migrations:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate -- --name init
   ```
4. Run dev server:
   ```bash
   npm run dev
   ```

## Deploy notes

- Deploy to Render/Railway/Fly.io.
- Add managed PostgreSQL and set `DATABASE_URL`.
- Set `FRONTEND_URL` to deployed frontend URL.

## Vercel latency considerations

Production cold starts can make the first auth/dashboard request slower than local.

Backend mitigation already implemented:

- Prisma client singleton pattern in `src/lib/prisma.ts` to reduce repeated client initialization overhead.

Recommended Vercel checks:

1. Functions region is close to your database region.
2. Database connection string supports pooling (if provider offers it).
3. Environment variables are correctly set for Production.
4. Review first-request timing in Deployment logs.

Useful endpoint for warm-up/health check:

- `GET /api/health`

## Keep backend awake on free tier

If your Render service sleeps due to inactivity, the first request can take 20-60s.

This repo includes a GitHub Actions workflow to ping the backend every 10 minutes:

- File: `.github/workflows/render-keep-alive.yml`
- Schedule: `*/10 * * * *`

Setup steps:

1. In your backend GitHub repo, go to `Settings > Secrets and variables > Actions`.
2. Create secret `RENDER_HEALTHCHECK_URL` with value:
   - `https://<your-render-domain>/api/health`
3. Enable GitHub Actions for the repository.
4. Optional: run it once from `Actions > Render Keep Alive > Run workflow`.

Notes:

- This is the most common workaround on free tiers, but uptime is not strictly guaranteed.
- If you still see occasional cold starts, consider Render paid instance (no sleep).

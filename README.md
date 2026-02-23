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

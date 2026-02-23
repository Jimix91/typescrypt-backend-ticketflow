# TypeScript Backend API

Express + TypeScript + Prisma + PostgreSQL backend.

## Requirements coverage

- REST API with Express + TypeScript
- PostgreSQL via Prisma ORM
- 2 models: `User` and `Task`
- Full CRUD for `Task`

## Endpoints

- `GET /api/health`
- `GET /api/users`
- `POST /api/users`
- `GET /api/tasks`
- `GET /api/tasks/:taskId`
- `POST /api/tasks`
- `PUT /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`

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

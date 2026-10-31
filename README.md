# SubLoop

Subscription-management product prototype for the Odoo x CUSAT hackathon.

The repository now contains two workstreams:

- **`apps/web`** — the Role D Next.js frontend experience (finance dashboard and customer portal), which shows labeled sample data by default.
- **`apps/api`** — the backend core (member A): authentication, RBAC, catalog and the subscription lifecycle, built on NestJS + Prisma + PostgreSQL.

Billing, payments, reports and the portal API endpoints are still owned by the other workstreams; `docs/deployment.md` records the contract the frontend expects from them.

## Quick start

### Docker Compose

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open:

- Dashboard: <http://localhost:3000>
- Customer portal: <http://localhost:3000/portal>
- Mailpit: <http://localhost:8025>

The dashboard and portal deliberately show labeled sample data by default. Demo actions are not persisted.

### API (backend core)

```bash
npm install                # root workspaces: apps/api + packages/shared
docker compose up -d       # Postgres, Redis, Mailpit
cp .env.example .env
npm run prisma:generate
npm run prisma:deploy      # applies prisma/migrations
npm run db:seed            # 1 admin, 2 staff, customers, Brightloop catalog
npm run dev                # http://localhost:3001/api/v1 (Swagger at /api/docs)
```

Seeded logins:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@subloop.local` | `Admin@12345` |
| Staff | `staff@subloop.local` | `Staff@12345` |
| Customer | `customer@subloop.local` | `Customer@12345` |

Backend scripts: `npm run build`, `npm run typecheck`, `npm run lint`,
`npm test`, `npm run prisma:generate | prisma:migrate | prisma:deploy`,
`npm run db:seed`.

### Web app directly

```powershell
Set-Location apps/web
npm ci
npm run dev
```

## Web quality checks

Run from `apps/web`:

```powershell
npm run lint
npm run typecheck
npm run build
```

## API surface (backend core)

Base URL `/api/v1`. Everything requires `Authorization: Bearer <accessToken>`
except the routes marked *public*.

| Area | Routes |
|---|---|
| Auth | `POST /auth/signup`*, `/auth/login`*, `/auth/refresh`*, `/auth/logout`, `/auth/forgot-password`*, `/auth/reset-password`*, `GET /auth/me` |
| Users | `POST /users/staff`, `GET /users`, `PATCH /users/:id` (admin only) |
| Catalog | `/customers`, `/products` (+ `/products/:id/variants`), `/plans`, `/taxes`, `/discounts`, `/quotation-templates` |
| Subscriptions | `POST /subscriptions`, `POST /subscriptions/from-template/:templateId`, `GET /subscriptions`, `GET /subscriptions/:id`, `GET /subscriptions/:id/history`, `PATCH /subscriptions/:id`, `POST /subscriptions/:id/{send-quotation,confirm,activate,pause,resume,renew,close}` |

Role rules: only admins create staff, configure discounts or delete records;
staff get read access to the catalog and full day-to-day subscription work;
customers can only read their own subscriptions (enforced by row-level
ownership filtering, not just the route guard).

## Project map

- `apps/web` — Next.js 16 dashboard and customer portal.
- `apps/api` — NestJS 10 REST API (`/api/v1`, OpenAPI at `/api/docs`).
- `packages/shared` — role/status constants, the password policy and the
  subscription state machine shared by the API and the UI.
- `prisma` — schema, first migration, and the demo seed.
- `performance/dashboard.js` — k6 smoke/load check for the reports summary endpoint.
- `docs/demo-script.md` — three-minute demo walkthrough.
- `docs/deployment.md` — local setup, API contract, and production-readiness checklist.
- `docker-compose.yml` — local PostgreSQL, Redis, Mailpit, and web app services.

For Role D scope, integration requirements, and demo limitations, read `docs/deployment.md`. See `docs/task.md` for the overall product plan.

## Backend design notes

- Emails are normalised to lower case and uniquely indexed (case-insensitive
  uniqueness without the `citext` extension).
- Refresh tokens are stored hashed per user and rotated on every refresh; a
  replayed token invalidates the session.
- Subscription numbers (`SUB-000123`) come from a Postgres sequence, so
  concurrent creates cannot collide. The invoice sequence is created in the same
  migration for the billing engine.
- The subscription state machine lives in `packages/shared`, so the UI can
  disable illegal actions using exactly the rules the API enforces. Plan flags
  (`pausable`, `closable`, `renewable`, `autoClose`) gate the transitions.
- Deletes are soft (`isActive=false`) for anything referenced by history, and
  every catalog change, staff creation and status transition is written to
  `audit_log`.
- The auto-close and quotation-expiry workers run in-process via
  `@nestjs/schedule` (batched, 200 per round) so the demo needs no Redis; they
  can move into BullMQ processors without behaviour changes.

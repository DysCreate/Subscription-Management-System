# SubLoop

> Subscription-management system — Odoo × CUSAT Hackathon

SubLoop is a full-stack subscription management platform built with NestJS, Next.js, PostgreSQL, and Redis.

---

## Architecture

```
subloop/
├── apps/
│   ├── api/        — NestJS REST API (port 3001)
│   ├── admin/      — Next.js Admin & Staff panel (port 3002)
│   └── web/        — Next.js Finance dashboard + Customer portal (port 3000)
├── packages/
│   └── shared/     — State machine, password policy, types (shared by API + UI)
└── prisma/         — Database schema, migrations, seed
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| Docker Desktop | Latest |
| npm | ≥ 10 |

---

## Option 1 — One-Command Start (Docker Compose) ⭐ Recommended

This spins up Postgres, Redis, Mailpit, and the web frontend in a single command.

```bash
# 1. Copy environment file
cp .env.example .env        # Linux / macOS
copy .env.example .env      # Windows (cmd)

# 2. Start all services
docker compose up --build
```

| Service | URL |
|---------|-----|
| Finance Dashboard & Portal | <http://localhost:3000> |
| Mailpit (email preview) | <http://localhost:8025> |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

> The API must be started separately (see Option 2) — it is not included in the Compose file to allow hot-reload during development.

---

## Option 2 — Full Local Development (all three apps)

Run each service in a separate terminal.

### Step 1 — Start infrastructure

```bash
cp .env.example .env
docker compose up -d postgres redis mailpit
```

### Step 2 — Install all dependencies

```bash
npm install           # installs root workspaces (apps/api + packages/shared)
```

### Step 3 — Set up the database

```bash
npm run prisma:generate        # generate Prisma client
npm run prisma:deploy          # apply all migrations
npm run db:seed                # seed demo data (admin, staff, customers, catalog)
```

### Step 4 — Start the API (Terminal 1)

```bash
npm run dev
# → http://localhost:3001/api/v1
# → Swagger UI at http://localhost:3001/api/docs
```

### Step 5 — Start the Admin panel (Terminal 2)

```bash
cd apps/admin
npm install
npm run dev
# → http://localhost:3002
```

### Step 6 — Start the Web / Portal (Terminal 3)

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000          (Finance dashboard)
# → http://localhost:3000/portal   (Customer portal)
```

---

## Seeded Demo Logins

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@subloop.local` | `Admin@12345` |
| Staff | `staff@subloop.local` | `Staff@12345` |
| Customer | `customer@subloop.local` | `Customer@12345` |

---

## Environment Variables

All variables live in `.env` (copied from `.env.example`). Key settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://subloop:...@localhost:5432/subloop` | Postgres connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis for billing job queue |
| `JWT_ACCESS_SECRET` | *(must change)* | Access token signing secret |
| `JWT_REFRESH_SECRET` | *(must change)* | Refresh token signing secret |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | API base URL used by the frontends |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | Set to `false` to connect to real API |
| `BILLING_CRON` | `30 0 * * *` | Daily billing job schedule (cron) |
| `INVOICE_DEFAULT_STATUS` | `CONFIRMED` | Status for billing-run invoices |
| `SMTP_HOST` | `localhost` | SMTP server (Mailpit in dev) |
| `WEB_APP_URL` | `http://localhost:3000` | Used to build password reset links |

---

## API Surface

Base URL: `/api/v1` · Auth: `Authorization: Bearer <accessToken>` (except public routes marked `*`)

| Area | Endpoints |
|------|-----------|
| **Auth** | `POST /auth/signup`\*, `/auth/login`\*, `/auth/refresh`\*, `/auth/logout`, `/auth/forgot-password`\*, `/auth/reset-password`\*, `GET /auth/me` |
| **Users** | `POST /users/staff`, `GET /users`, `PATCH /users/:id` *(admin only)* |
| **Customers** | `GET /customers`, `POST /customers`, `GET /customers/:id`, `PATCH /customers/:id` |
| **Products** | `GET/POST /products`, `GET/PATCH /products/:id`, `GET/POST /products/:id/variants`, `PATCH /products/:id/variants/:vid` |
| **Plans** | `GET/POST /plans`, `GET/PATCH /plans/:id` |
| **Taxes** | `GET/POST /taxes`, `GET/PATCH/DELETE /taxes/:id` |
| **Discounts** | `GET/POST /discounts`, `GET/PATCH/DELETE /discounts/:id` *(admin only)* |
| **Quotation Templates** | `GET/POST /quotation-templates`, `GET/PATCH /quotation-templates/:id` |
| **Subscriptions** | `POST /subscriptions`, `POST /subscriptions/from-template/:id`, `GET /subscriptions`, `GET/PATCH /subscriptions/:id`, `GET /subscriptions/:id/history`, `POST /subscriptions/:id/{send-quotation,confirm,activate,pause,resume,renew,close}` |
| **Invoices** | `GET /invoices`, `POST /invoices`, `GET/PATCH /invoices/:id`, `POST /invoices/run-billing`, `POST /invoices/:id/{confirm,cancel,send}` |
| **Payments** | `GET /payments`, `POST /payments`, `GET /payments/:id`, `GET /invoices/:id/payments` |
| **Dashboard** | `GET /dashboard/stats`, `GET /dashboard/revenue-chart`, `GET /dashboard/payments-chart` |
| **Audit Log** | `GET /audit-log` *(admin only)* |

Full interactive docs: **<http://localhost:3001/api/docs>**

---

## RBAC Rules

| Action | Admin | Staff | Customer |
|--------|-------|-------|----------|
| Create / manage staff accounts | ✅ | ❌ | ❌ |
| Configure discounts | ✅ | ❌ | ❌ |
| Full catalog CRUD | ✅ | Read | ❌ |
| Subscription day-to-day work | ✅ | ✅ | Own only |
| View invoices / payments | ✅ | ✅ | Own only |
| Run billing | ✅ | ✅ | ❌ |
| View audit log | ✅ | ❌ | ❌ |

Row-level ownership is enforced in service queries (not just route guards) so a customer cannot probe other customers' IDs.

---

## Useful Scripts (run from repo root)

```bash
npm run dev              # Start API in watch mode
npm run build            # Build shared + API
npm run typecheck        # Type-check shared + API
npm run lint             # Lint API
npm run test             # Run all unit tests

npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:migrate   # Create a new migration (dev)
npm run prisma:deploy    # Apply migrations (CI / production)
npm run prisma:studio    # Open Prisma Studio at http://localhost:5555
npm run db:seed          # Re-seed demo data
```

Admin panel (run from `apps/admin`):

```bash
npm run dev              # Start admin Next.js dev server (port 3002)
npm run build            # Production build
npm run typecheck        # Type-check admin
```

Web app (run from `apps/web`):

```bash
npm run dev              # Start web Next.js dev server (port 3000)
npm run build            # Production build
npm run lint             # Lint web app
npm run typecheck        # Type-check web app
```

---

## Performance Testing (k6)

```bash
# Install k6: https://k6.io/docs/getting-started/installation/
k6 run performance/dashboard.js
```

Target: p95 < 2 s on the seeded dataset.

---

## Project Map

```
apps/api/src/
├── auth/                 — JWT auth, signup, login, refresh, password reset
├── users/                — Staff management (admin only)
├── customers/            — Customer CRUD
├── products/             — Products + variants
├── plans/                — Subscription plans + flags
├── taxes/                — Tax rules
├── discounts/            — Discount rules (admin only)
├── quotation-templates/  — Quotation templates
├── subscriptions/        — Subscription lifecycle + scheduler
├── invoices/             — Invoice engine + billing job
├── payments/             — Payment recording (partial + full)
├── dashboard/            — KPI stats, revenue & payment charts
└── common/
    ├── audit/            — Audit log service
    ├── guards/           — JWT + Roles guards
    ├── mail/             — Nodemailer (Mailpit in dev)
    └── money/            — Decimal-safe arithmetic

apps/admin/src/           — Admin/Staff panel (Next.js + shadcn/ui)
apps/web/src/             — Finance dashboard + Customer portal (Next.js)
packages/shared/          — State machine, password policy, shared types
prisma/
├── schema.prisma         — Full database schema
├── migrations/           — Migration history
└── seed.ts               — Demo data seed
performance/dashboard.js  — k6 load test script
docs/
├── task.md               — Build plan & phase checklist
├── Architecture.md       — System design & DB indexes
├── deployment.md         — Deployment guide & API contract
└── Proposal.md           — Project proposal
```

---

## Design Notes

- **Subscription numbers** (`SUB-000123`) and **invoice numbers** (`INV-000123`) come from Postgres sequences — concurrent creates never collide.
- **Billing idempotency** — `UNIQUE(subscriptionId, periodStart, periodEnd)` prevents double-billing across repeated billing runs.
- **Refresh token rotation** — tokens are stored hashed; replaying an old token invalidates the entire session.
- **Soft deletes** — catalog items use `isActive = false` so history references never break.
- **Decimal-safe arithmetic** — all money calculations use `Prisma.Decimal` (BE) and the shared `sumDecimals` helper (FE).
- **State machine** — subscription transitions live in `packages/shared`, so the admin UI disables illegal actions using the exact same rules the API enforces.

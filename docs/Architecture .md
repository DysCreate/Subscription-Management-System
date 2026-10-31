# Architecture: Brightloop Subscription Management System (SubLoop)

## 1. Tech Stack (and why)

| Layer | Choice | Why it wins for a hackathon |
|---|---|---|
| Frontend | **Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui** | Fast to build polished UI; role-based layouts for Admin / Staff / Portal in one app |
| Charts | **Recharts** | Quick dashboards (MRR, revenue, overdue) |
| Data fetching | **TanStack Query** | Caching keeps every page well under 2s |
| Backend | **NestJS (TypeScript)** | Modular structure, built-in guards for RBAC, validation pipes, easy cron/queue integration |
| ORM | **Prisma** | Typed schema, migrations, fast iteration |
| Database | **PostgreSQL 16** | Transactions, partial/unique indexes, JSONB, strong aggregates |
| Queue / Cache | **Redis + BullMQ** | Billing-day batch jobs, retries, email queue, dashboard cache |
| Auth | **JWT (access + refresh cookie), bcrypt/argon2** | Stateless, simple RBAC |
| Email | **Nodemailer (SMTP) + Mailpit locally** (Resend in prod) | Password reset, invoice emails |
| PDF | **Puppeteer / pdfkit** | "Print / download invoice" |
| Validation | **Zod (FE) + class-validator (BE)** | Password rules enforced both sides |
| DevOps | **Docker Compose**; deploy on Render/Railway + Vercel | One-command setup, easy live demo |
| Testing | **Jest + k6** | Unit tests for billing/tax/discount; k6 load test proves the <2s requirement |

## 2. High-Level Architecture

```
            ┌────────────────────────────────────────────┐
            │          Next.js Web App (SSR/CSR)         │
            │  Admin Console | Staff Workspace | Portal  │
            └───────────────┬────────────────────────────┘
                            │ HTTPS / REST (JSON)
            ┌───────────────▼────────────────────────────┐
            │              NestJS API Gateway            │
            │  Auth/RBAC Guards · Validation · Rate limit│
            ├────────────────────────────────────────────┤
            │ Modules:                                   │
            │  Auth · Users · Customers · Products       │
            │  Plans · Quotation Templates · Subscriptions│
            │  Billing Engine · Invoices · Taxes         │
            │  Discounts · Payments · Reports · Audit    │
            └───────┬──────────────┬─────────────────────┘
                    │              │
        ┌───────────▼───┐   ┌──────▼────────┐
        │ PostgreSQL    │   │ Redis         │
        │ (source of    │   │ cache + BullMQ│
        │  truth)       │   └──────┬────────┘
        └───────────────┘          │
                            ┌──────▼─────────────────┐
                            │ Workers (same codebase)│
                            │ · Daily billing run    │
                            │ · Auto-close expired   │
                            │ · Overdue marker       │
                            │ · Email sender         │
                            └────────────────────────┘
```

## 3. Roles and Access (RBAC)

| Capability | Admin | Staff | Customer |
|---|---|---|---|
| Create staff accounts | ✅ | ❌ | ❌ |
| Products / variants / plans / taxes / discounts | ✅ | read | ❌ |
| Quotation templates | ✅ | use | ❌ |
| Customers, subscriptions, invoices, payments | ✅ | ✅ (limited, no delete/config) | own only |
| Reports | ✅ | summary | ❌ |
| Portal (view/manage own subscription, pay, download invoices) | – | – | ✅ |

Enforced via `@Roles()` guard on each route plus **row-level ownership checks** (customer queries always filtered by `customer_id = token.customerId`).

## 4. Data Model (core tables)

```
users(id, email UNIQUE, password_hash, role, customer_id?, is_active, created_at)
password_resets(id, user_id, token_hash, expires_at, used_at)
customers(id, name, email, phone, billing_address, tax_id)

products(id, name, type, sales_price, cost_price, notes, is_active)
product_variants(id, product_id, attribute, value, extra_price)   -- e.g. Brand=Odoo, +560

plans(id, name, price, billing_period ENUM(daily,weekly,monthly,yearly),
      min_quantity, available_from, available_to,
      auto_close BOOL, closable BOOL, pausable BOOL, renewable BOOL)

quotation_templates(id, name, plan_id, validity_days)
quotation_template_lines(id, template_id, product_id, variant_id?, quantity)

subscriptions(id, number UNIQUE, customer_id, plan_id, status
              ENUM(draft,quotation,confirmed,active,closed),
              start_date, expiry_date, next_billing_date,
              payment_terms, paused_at?, created_by)
subscription_lines(id, subscription_id, product_id, variant_id?,
                   quantity, unit_price, tax_id?, amount)
subscription_status_history(id, subscription_id, from, to, by, at)

taxes(id, name, type ENUM(percent,fixed), rate, is_active)

discounts(id, name, type ENUM(fixed,percent), value,
          min_purchase?, min_quantity?, start_date, end_date,
          usage_limit, times_used, scope ENUM(product,subscription))
discount_products(discount_id, product_id)

invoices(id, number UNIQUE, subscription_id, customer_id,
         period_start, period_end, status ENUM(draft,confirmed,paid,cancelled),
         subtotal, discount_total, tax_total, total, amount_paid,
         due_date, issued_at, UNIQUE(subscription_id, period_start, period_end))
invoice_lines(id, invoice_id, description, qty, unit_price, tax_amount, amount)
invoice_discounts(id, invoice_id, discount_id, amount)

payments(id, invoice_id, method ENUM(card,bank,upi,cash,cheque), amount,
         paid_on, note, recorded_by)

audit_log(id, actor_id, entity, entity_id, action, diff JSONB, at)
```

**Critical indexes** (for <2s at thousands of rows and beyond):
- `subscriptions(status)`, `subscriptions(next_billing_date) WHERE status='active'` (partial)
- `invoices(status, due_date)`, `invoices(customer_id)`, `invoices(subscription_id)`
- `payments(invoice_id)`, `payments(paid_on)`
- `users(email)` unique (case-insensitive via `citext`)

## 5. State Machines

**Subscription:** `Draft → Quotation → Confirmed → Active → Closed`
- Active can be **Paused** (if plan allows) and resumed; **Renewed** creates next term (if plan allows).
- Closed early only if `closable`; auto-closed by worker when `expiry_date` passes and `auto_close=true`.
- Every transition is validated server-side and written to `subscription_status_history`.

**Invoice:** `Draft → Confirmed → Paid` (+ `Cancelled`). Moves to Paid automatically when `amount_paid >= total`; partial payments keep it Confirmed. "Overdue" is derived: `status=confirmed AND due_date < today`.

## 6. Billing Engine (the heart of the system)

Runs as a BullMQ job daily (and manually triggerable by admin: "Run billing now").

1. Query: `subscriptions WHERE status='active' AND next_billing_date <= today` in batches of 200.
2. For each subscription, in **one DB transaction**:
   - Build invoice lines from subscription lines (+ variant extra price).
   - **Tax engine:** apply each line's tax rule → `tax_total`.
   - **Discount engine:** find applicable discounts (date window, min purchase/qty, product/subscription scope, `times_used < usage_limit`), compute amount, write `invoice_discounts`, increment `times_used` atomically (`UPDATE ... WHERE times_used < usage_limit`).
   - Insert invoice with number from a DB sequence.
   - Advance `next_billing_date` by plan period.
3. **Idempotency:** `UNIQUE(subscription_id, period_start, period_end)`. A retry or double-run can never bill twice; a crash mid-batch leaves unprocessed subs still due, so none are skipped.
4. Queue email with PDF to customer; failures retry with backoff.
5. Run summary stored (created / skipped / failed) and shown in the admin UI.

## 7. Discount and Tax Rules

- Tax: percent or fixed, assigned per product/line; totals computed with decimal-safe math (`Decimal`, never floats).
- Discount order: line-level product discounts first, then subscription-level; capped so total never goes below zero. Auto-stops on expiry or when usage limit is hit.

## 8. Reporting and Performance (<2s requirement)

- All lists are **server-side paginated, filtered and sorted**; no unbounded queries.
- Dashboard KPIs (active subs, MRR, revenue this month, outstanding, overdue count) computed with indexed aggregate SQL and **cached in Redis for 60s**, invalidated on payment/invoice events.
- Monthly revenue trend from a **materialized view** refreshed after billing runs.
- Seed script generates **10,000+ subscriptions and 30,000+ invoices**; **k6 load test** results included in the demo to prove p95 < 2s.

## 9. Security

- Password policy: >8 chars, upper, lower, special; enforced FE + BE. Email unique (case-insensitive).
- Reset tokens: random 32 bytes, stored hashed, 30 min expiry, single use; generic response to avoid email enumeration.
- argon2/bcrypt hashing, HttpOnly secure cookies, CORS allowlist, rate limiting on auth routes, Helmet.
- Audit log on all admin and money-related actions.

## 10. API Surface (REST, `/api/v1`)

```
POST /auth/signup | /auth/login | /auth/forgot-password | /auth/reset-password
POST /users/staff                      (admin only)
CRUD /products, /products/:id/variants, /plans, /taxes, /discounts
CRUD /quotation-templates
CRUD /subscriptions   POST /subscriptions/from-template/:id
POST /subscriptions/:id/{confirm|activate|pause|resume|close|renew}
POST /billing/run                      (admin)   GET /billing/runs
GET  /invoices?status=&overdue=&customer=&page=
POST /invoices/:id/{confirm|cancel|send}   GET /invoices/:id/pdf
POST /payments                         GET /payments?...
GET  /reports/summary | /reports/revenue | /reports/overdue | /reports/export.csv
GET  /portal/subscriptions | /portal/invoices   (customer scoped)
```

## 11. Folder Structure

```
subloop/
├─ apps/
│  ├─ web/            # Next.js
│  └─ api/            # NestJS (modules per domain + workers)
├─ packages/shared/   # types, zod schemas, constants
├─ prisma/            # schema.prisma, migrations, seed.ts
├─ docker-compose.yml # postgres, redis, mailpit, api, web
└─ docs/              # task.md, architecture.md, proposal.md
```
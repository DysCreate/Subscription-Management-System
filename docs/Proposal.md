# Project Proposal: SubLoop

### One platform to run plans, subscriptions and recurring billing
**Odoo x CUSAT Hackathon · Problem Statement: Subscription Management System**
**Client scenario:** Brightloop Software

---

## 1. Executive Summary
Brightloop earns its money every month, yet its subscriptions live in a spreadsheet, renewals depend on someone remembering, invoices are typed by hand and payments are matched by scrolling bank statements. The result: missed renewals, wrong invoices and no clear view of recurring revenue.

**SubLoop** is a unified platform that covers the full subscription lifecycle: catalog → quotation → subscription → automated invoicing → payment tracking → revenue reporting, with separate experiences for Admin, Staff and Customers. Billing is **automatic, idempotent (never twice, never skipped)** and every page responds in **under two seconds** at thousands of subscriptions.

## 2. The Problem
| Today at Brightloop | Consequence |
|---|---|
| Subscriptions in a spreadsheet | No single source of truth, nobody sees status |
| Renewals "remembered by whoever notices" | Missed renewals, lost revenue |
| Invoices typed by hand | Errors, wrong tax and totals |
| Payments matched manually to bank statements | Slow, error-prone collections |
| Quarterly manual reports | Nobody knows current recurring revenue |

## 3. Our Solution
| Brightloop scene | SubLoop answer |
|---|---|
| New customer signs up | Secure signup (unique email, strong password), reset by email link, role-based access (Admin / Staff / Customer portal) |
| Launching a new plan | Products with variants (e.g. Odoo brand +560), plans with daily/weekly/monthly/yearly billing, min quantity, availability dates, per-plan auto-close / pause / renew rules |
| Quote to subscription | Quotation templates, auto-numbered subscriptions, line items with tax, visible lifecycle Draft → Quotation → Confirmed → Active → Closed |
| Billing day | One-click or scheduled **billing engine** generates invoices with customer data, lines, taxes and totals; Draft → Confirmed → Paid; guaranteed no duplicates or skips |
| Better price | Admin-defined fixed/percent discounts with minimums, dates, usage limits, product or subscription scope; **applied automatically** on the next invoice and stop on expiry or limit |
| Money comes in | Record payments by method/amount/date/note per invoice; partial payments; live paid / outstanding / overdue view |
| Finance lead | One dashboard: active subscriptions, revenue, outstanding, overdue, with filters and summary, plus CSV export |

## 4. Key Features
**Core (full problem-statement coverage)**
- Authentication with enforced password policy and email reset
- Three roles with strict access boundaries (only Admin can add staff or create discounts)
- Product, variant, plan, tax and discount management
- Quotation templates and subscription lifecycle with status history
- Automated invoice generation with tax and discount engines
- Payment recording and reconciliation by invoice
- Customer self-service portal
- Finance dashboard and reports

**Differentiators (what sets us apart)**
- **MRR / ARR, churn and upcoming-renewal forecasting**: answers "how much recurring revenue do we actually have?" directly
- **Idempotent billing engine** with a run summary (created / skipped / failed) and automated tests proving no double billing
- **Dunning**: automatic reminders for overdue invoices
- **Proration** for mid-cycle changes
- **Audit log** of every money-affecting action
- **Measured performance**: k6 load test on 10k+ subscriptions showing p95 < 2s

## 5. Technology Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Recharts |
| Backend | NestJS (TypeScript), REST + OpenAPI/Swagger |
| Database | PostgreSQL 16 + Prisma ORM |
| Queue / Cache | Redis + BullMQ (billing jobs, emails, dashboard cache) |
| Auth | JWT with refresh cookies, argon2, role guards |
| Infra | Docker Compose, Vercel + Render/Railway |
| Quality | Jest, k6, ESLint/Prettier, GitHub Actions |

**Why this stack:** one language end-to-end (TypeScript) with shared types, which speeds the team up; PostgreSQL gives transactional safety essential for money; Redis/BullMQ handles billing-day spikes without blocking the API.

## 6. Architecture Overview
Next.js app (Admin, Staff, Portal) → NestJS modular API (Auth, Catalog, Subscriptions, Billing, Invoices, Payments, Reports) → PostgreSQL as source of truth, with Redis for caching and background workers for daily billing, auto-close, overdue marking and email. Full details in `architecture.md`.

## 7. How We Meet the Hard Requirements
| Requirement | Approach |
|---|---|
| "Nothing billed twice or skipped" | DB unique constraint on (subscription, period), transactional per-invoice creation, due-date driven selection, retry-safe workers |
| Discounts apply automatically and stop | Discount engine evaluated at invoice generation; atomic usage counter; date-window checks |
| Taxes calculated from admin rules | Central tax engine with decimal-safe math |
| Role-based visibility | Route guards + row-level ownership filter for customers |
| Every page < 2 seconds | Pagination, composite/partial indexes, cached aggregates, materialized view, verified by load test |

## 8. Business Impact
- Invoicing effort: hours of manual typing → seconds per billing run
- Missed renewals: eliminated through status tracking, expiry automation and renewal reminders
- Collections: overdue invoices visible instantly and chased automatically
- Reporting: quarterly manual build → live dashboard, always current
- Customers: fewer support emails thanks to self-service portal

## 9. Scalability and Future Scope
- Payment gateway integration (Razorpay/Stripe) with webhooks for auto-reconciliation
- Multi-currency and GST-compliant invoice formats
- Usage-based billing and add-on metering
- Accounting integrations (Odoo, Tally) and webhooks API
- Read replicas / partitioned invoice tables beyond millions of rows

## 10. Team and Timeline
| Role | Responsibility |
|---|---|
| Backend core | Auth, catalog, subscriptions, RBAC |
| Billing & payments | Billing engine, tax/discount engines, payments, workers |
| Frontend (Admin/Staff) | Catalog, subscription, invoice, payment screens |
| Frontend (Portal/Dashboard) + DevOps | Portal, reports, performance tests, deployment, demo |

Milestones: Foundation → Auth & Catalog → Subscriptions → Billing → Payments & Portal → Reports & Performance → Polish & Demo (see `task.md`).

## 11. Success Metrics
- 100% of problem-statement scenes demoable end-to-end
- 0 duplicate invoices across repeated billing runs (automated test)
- p95 page response < 2s with 10,000+ subscriptions and 30,000+ invoices
- Strict RBAC verified by tests (customer isolation, admin-only actions)

## 12. Conclusion
SubLoop turns Brightloop's spreadsheet-and-memory process into a reliable, automated revenue engine. It covers every scene in the brief, adds the revenue intelligence a finance lead actually needs, and proves its reliability and speed with tests rather than claims.
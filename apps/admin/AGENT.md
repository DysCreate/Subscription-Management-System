You are a senior frontend engineer and UI/UX designer. We are building the Admin/Staff web app for "SubLoop", a Subscription Management System for a company called Brightloop Software (an Odoo x CUSAT hackathon project). It manages products, plans, quotation templates, subscriptions, invoices, payments and reports.

TECH STACK (do not change):
- Next.js 14 (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn/ui + lucide-react icons
- TanStack Query for data fetching, TanStack Table for tables
- React Hook Form + Zod for forms and validation
- Recharts for charts, date-fns for dates, sonner for toasts
- Project lives in apps/web of a monorepo; the NestJS backend is built by teammates at /api/v1

RULES FOR EVERYTHING YOU BUILD:
1. DATA LAYER: the backend is not ready, so create a typed API client in src/lib/api/ where every function (e.g. getProducts, createPlan) currently returns realistic MOCK data with a simulated 300ms delay. Keep one flag NEXT_PUBLIC_USE_MOCK=true; when false the same functions call fetch to `${NEXT_PUBLIC_API_URL}/api/v1/...`. Types live in src/types/ and mirror these entities: User, Customer, Product, ProductVariant, Plan, Tax, Discount, QuotationTemplate, Subscription, SubscriptionLine, Invoice, InvoiceLine, Payment.
2. Every list page: server-side style pagination, search, filters, sortable columns (pass these as query params to the api function), loading skeletons, empty state with an illustration + call-to-action, and error state with retry.
3. Every form: Zod validation with inline error messages, disabled submit while loading, success/error toasts.
4. Role-based UI: a `useAuth()` hook exposes user.role = "admin" | "staff" | "customer". Admin-only actions must be hidden for staff (not just disabled). Create a <RoleGate allow={["admin"]}> component.
5. Money is always formatted via one helper formatCurrency() (INR, en-IN). Dates via one helper formatDate().
6. Accessible (labels, focus rings, keyboard nav), responsive (desktop first, usable on tablet), and no layout shift.
7. Clean code: small reusable components in src/components/, feature code in src/features/<module>/, no `any`.
8. Domain facts: subscription status flow is Draft -> Quotation -> Confirmed -> Active -> Closed. Invoice status flow is Draft -> Confirmed -> Paid (plus Cancelled); "Overdue" is derived (confirmed and past due date). Plan billing periods: daily, weekly, monthly, yearly. Discount types: fixed or percent. Payment methods: card, bank transfer, UPI, cash, cheque. Example variant: Brand = Odoo adds 560 to the price.

DESIGN DIRECTION (follow strictly, make it look like a premium modern SaaS product, comparable to Stripe Dashboard / Linear / Vercel):
- Light theme by default with full dark mode support via CSS variables.
- Primary color: indigo (#4F46E5) with a subtle violet gradient used sparingly (logo, primary buttons on hero areas, KPI accents). Neutral slate greys. Semantic colors: green = paid/active, amber = pending/quotation/paused, red = overdue/cancelled, blue = confirmed, grey = draft/closed.
- Font: Inter (via next/font). Tight, clear typographic hierarchy; numbers use tabular-nums.
- Rounded-xl cards, soft shadows, 1px borders, generous spacing, subtle hover and focus transitions (150ms), skeleton loaders, smooth page transitions.
- Status shown via colored pill badges with a small dot.
- Dense but breathable data tables with sticky header, row hover, row actions menu.
Confirm you understood, then wait for Module 0.
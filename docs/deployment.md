# Local operations and deployment

## Local demo

The current repository contains the Role D web app and local infrastructure only; it does not yet contain the NestJS API or database migrations. The UI therefore defaults to explicit sample-data mode.

### Run with Docker Compose

1. Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`).
2. Start the services: `docker compose up --build`.
3. Open the dashboard at `http://localhost:3000` and the email test UI at `http://localhost:8025`.
4. Stop the services with `docker compose down`. The local PostgreSQL volume is retained.

PostgreSQL and Redis are provided for the API team; the web UI currently does not connect to either service directly. Compose uses a development-only PostgreSQL password. Do not expose this setup to the public internet.

### Run the web app without Docker

```powershell
Set-Location apps/web
npm ci
npm run dev
```

Open `http://localhost:3000`. To create the production bundle, run `npm run build` and `npm start`.

## API integration

Set `NEXT_PUBLIC_DEMO_MODE=false` and point `NEXT_PUBLIC_API_URL` at the API's `/api/v1` base URL. The frontend expects:

- `GET /reports/summary` → `DashboardSummary`
- `GET /reports/revenue` → `RevenueMonth[]`
- `GET /invoices?status=&customer=&plan=&dueFrom=&dueTo=&page=&pageSize=` → `InvoicePage` (server-side filtering and pagination)
- `GET /portal/subscriptions` → `Subscription[]`
- `GET /portal/invoices` → `PortalInvoice[]`

The exact JSON fields are defined in `apps/web/src/lib/types.ts`. `DashboardSummary` includes `unpaidInvoiceCount` and `upcomingRenewalCount` in addition to KPI and payment-method fields. `InvoicePage` contains `items`, `total`, `page`, and `pageSize`; each invoice row includes its status, plan, customer, due date, and amount. Requests include browser credentials; the API must implement secure authentication, ownership filtering, and an appropriate CORS allowlist. Non-demo API errors are displayed rather than replaced with fake data. No authentication flow is implemented in this frontend yet; do not expose customer data until API authorization is in place.

## Production deployment checklist

- Deploy the Next.js app and NestJS API separately; configure the public API URL at build time.
- Turn demo mode off and confirm all report and portal endpoints return the documented response shapes.
- Configure HTTPS, secure authentication cookies, API CORS allowlist, and customer-level authorization.
- Replace all local-only infrastructure credentials with secrets in the hosting provider.
- Provision managed PostgreSQL and Redis; apply migrations and seed only non-sensitive demo data.
- Configure SMTP/provider credentials and verify email flows; Mailpit is local-only.
- Add health checks, structured logs, backups, and monitoring before public launch.
- Run the k6 check in `performance/dashboard.js` against the real, seeded API (supply `API_TOKEN` if reports require bearer authentication). Record results; do not claim the target is met until a representative run passes.

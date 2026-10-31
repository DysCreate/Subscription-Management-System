# SubLoop

Subscription-management product prototype for the Odoo x CUSAT hackathon. This repository currently contains the Role D frontend experience (finance dashboard and customer portal), local supporting services, and demo/deployment documentation. The planned NestJS API and Prisma schema are not present yet.

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

## Project map

- `apps/web` — Next.js 16 dashboard and customer portal.
- `performance/dashboard.js` — k6 smoke/load check for the reports summary endpoint.
- `docs/demo-script.md` — three-minute demo walkthrough.
- `docs/deployment.md` — local setup, API contract, and production-readiness checklist.
- `docker-compose.yml` — local PostgreSQL, Redis, Mailpit, and web app services.

For Role D scope, integration requirements, and demo limitations, read `docs/deployment.md`. See `docs/task.md` for the overall product plan.

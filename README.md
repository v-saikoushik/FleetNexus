# FleetNexus

FleetNexus is a transport ERP foundation for factories, lorry unions, fleet owners, and drivers.

## Current status

The monorepo, identity/authentication foundation, and vehicle, customer, driver, and trip APIs are implemented. Public registration always creates a `FLEET_OWNER`; public clients cannot choose or self-assign roles. The Prisma schema includes business-memory and finance models, with migrations now covering the current schema. Expense and payment APIs, document management, reporting, and integrations remain future work.

## Requirements

- Node.js 20+
- pnpm 9.15.4 (managed through Corepack)
- Docker Desktop for local PostgreSQL

If `pnpm` is not on your PATH, run once:

```powershell
corepack enable
corepack pnpm --version
```

## Setup

```powershell
Copy-Item .env.example .env
pnpm install
pnpm docker:up
pnpm prisma:generate
pnpm prisma:migrate:deploy
```

Set non-placeholder values for `POSTGRES_PASSWORD`, `DATABASE_URL`, and `JWT_SECRET` in `.env`. Do not commit `.env`. PostgreSQL uses the `fleetnexus_postgres_data` Docker volume and port `POSTGRES_PORT` (5432 by default).

## Run locally

```powershell
pnpm dev
# or separately
pnpm dev:api  # http://localhost:3000/api/health
pnpm dev:web  # http://localhost:5173
```

## Authentication API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/register` | Register a Fleet Owner and optionally create an organization |
| `POST /api/auth/login` | Authenticate using email or phone and password |
| `GET /api/auth/me` | Read the authenticated user; requires a Bearer token |
| `GET /api/auth/rbac-check` | Demonstrates the reusable `SUPER_ADMIN` role guard |

Passwords are bcrypt-hashed and never returned. JWT authentication protects `/auth/me`; the reusable `@Roles()` and `RolesGuard` enforce role-restricted routes.

## Useful commands

```powershell
pnpm build
pnpm lint
pnpm test
pnpm --filter @fleetnexus/api test:e2e
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm docker:up
pnpm docker:down
```

## Current limitations

- PostgreSQL must be running and migrations applied before live registration, login, and operational flows can be exercised.
- Expense and payment persistence models exist, but their API modules are not implemented yet.
- No administrative role-assignment API exists yet; privileged roles require a future authenticated administration workflow.
- Vite/esbuild requires normal filesystem access to its configuration. Local security restrictions can prevent the web build from starting.

# FleetNexus

## Current status

The foundation, identity schema, and authentication flow are implemented. Public registration always creates a `FLEET_OWNER`; roles cannot be selected by public clients. Vehicle, driver, trip, finance, documents, reporting, and integrations are not implemented yet.

AI-powered Transport ERP that connects factories, lorry unions, fleet owners, and drivers into a unified logistics lifecycle:

Factory → Load Request → Union Allocation → Trip → Expenses → Documents → Payments → Reports

This repository currently contains the **engineering foundation only** (monorepo, tooling, API shell, web shell, Prisma + Postgres). Domain features are intentionally not implemented yet.

## Prerequisites

- Node.js **20+**
- [pnpm](https://pnpm.io/) **9+** (`npm install -g pnpm`)
- Docker Desktop (for local PostgreSQL)

If `pnpm` is not available on your PATH, enable the Node.js Corepack shim once:

```powershell
corepack enable
corepack pnpm --version
```

## Installation

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd FleetNexus

# 2. Copy environment file
cp .env.example .env   # Windows: Copy-Item .env.example .env

# 3. Install dependencies
pnpm install

# 4. Start PostgreSQL
pnpm docker:up

# 5. Generate Prisma Client
pnpm prisma:generate

# 6. Apply the existing migration
pnpm prisma:migrate:deploy
```

Windows PowerShell one-shot bootstrap:

```powershell
.\scripts\bootstrap.ps1
```

## Running locally

```bash
# API + Web together
pnpm dev

# Or separately
pnpm dev:api    # http://localhost:3000/api/health
pnpm dev:web    # http://localhost:5173
```

Useful commands:

| Script                                | Description                         |
| ------------------------------------- | ----------------------------------- |
| `pnpm build`                          | Build shared packages, web, and API |
| `pnpm lint`                           | Lint all packages                   |
| `pnpm format`                         | Format with Prettier                |
| `pnpm test`                           | Run package tests                   |
| `pnpm prisma:migrate`                 | Create/apply Prisma migrations      |
| `pnpm prisma:generate`                | Generate Prisma Client              |
| `pnpm docker:up` / `pnpm docker:down` | Start/stop Postgres                 |

## Folder structure

```text
FleetNexus/
├── apps/
│   ├── web/                 # React + Vite frontend
│   └── api/                 # NestJS backend
├── packages/
│   ├── shared/              # Shared types, constants, utils
│   └── ui/                  # Shared UI primitives
├── prisma/                  # Prisma schema + migrations
├── docker/                  # Local infrastructure (PostgreSQL)
├── docs/                    # Product & knowledge docs
├── scripts/                 # Bootstrap / utility scripts
├── .env.example
├── package.json             # pnpm workspace root
└── pnpm-workspace.yaml
```

### Frontend (`apps/web`)

Feature-based layout:

- `src/app` — providers, router, shell
- `src/pages` — route-level pages
- `src/features` — domain features (to be added)
- `src/shared` — API client, query client, schemas, shared helpers

### Backend (`apps/api`)

- `src/modules` — feature modules (health scaffold only)
- `src/common` — filters, decorators, interceptors, DTOs
- `src/config` — env validation + config service
- `src/database` — Prisma service
- `src/auth` — placeholder module (JWT/RBAC later)

## Tech stack

| Layer          | Technology                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------- |
| Frontend       | React, TypeScript, Vite, Tailwind CSS, React Router, React Query, Axios, React Hook Form, Zod |
| Backend        | NestJS, TypeScript, Prisma ORM                                                                |
| Database       | PostgreSQL                                                                                    |
| Auth (planned) | JWT + RBAC                                                                                    |
| Tooling        | pnpm workspaces, ESLint, Prettier, EditorConfig, Docker                                       |

## Notes

- Authentication endpoints: `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/auth/me`.
- Passwords are bcrypt-hashed and never returned. Public clients cannot submit a role; privileged role assignment requires a future authenticated administration workflow.
- The API exposes a health check at `GET /api/health` to verify the foundation.
- PostgreSQL must be running and the identity migration applied for Prisma-backed authentication endpoints to work.
- Business-domain modules, administrative role assignment, and integrations are not implemented yet.
- Keep secrets out of git — use `.env` locally and never commit it.

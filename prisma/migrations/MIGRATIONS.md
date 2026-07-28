# FleetNexus Prisma Migrations

This folder contains Prisma migration history for FleetNexus.

## Workflow

| Command                  | Description                                             |
|--------------------------|---------------------------------------------------------|
| `pnpm docker:up`         | Start local PostgreSQL container                        |
| `pnpm prisma:generate`   | Re-generate Prisma Client after schema changes          |
| `pnpm prisma:migrate`    | Create a new migration and apply it (development only)  |
| `pnpm prisma:migrate:deploy` | Apply pending migrations (CI / production)          |
| `pnpm prisma:reset`      | ⚠️ Drop DB and re-apply all migrations (dev only)       |
| `pnpm prisma:studio`     | Open Prisma Studio in your browser                      |
| `pnpm prisma:seed`       | Populate DB with seed data                              |

## Status

No migrations yet — domain models have not been defined.

First migration will be created when the Identity module models (Organization, User, Role) are added to `schema.prisma`.

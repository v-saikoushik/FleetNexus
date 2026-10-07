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

## Migration history

- `20260816082540_identity_foundation`: `Organization`, `User`, and the `Role` / `OrganizationType` enums.
- `20260820093000_vehicle_management`: vehicle model, enums, indexes, and organization relation.
- `20261007090000_operational_finance_foundation`: adds the vehicle fuel-efficiency target and the operational, business-memory, and finance schema (`Driver`, `Customer`, `Trip`, `Location`, `Route`, `Commodity`, `FreightRate`, `FuelTransaction`, `Expense`, and `Payment`).
- `20261007140000_expense_driver_relation`: adds the optional direct driver association to expenses, with its index and foreign key.
- `20261007150000_payment_method`: adds an optional `PaymentMethod` enum column to payments.
- `20261007160000_load_outcome_tracking`: adds immutable decision snapshots and a nullable unique explicit Trip link; existing trip and financial records are unchanged.
- `20261007170000_trip_financial_finalization`: adds Trip financial lifecycle status and current finalization time/user metadata. Existing Trips default to `OPEN`; migration is additive and does not alter financial records.

The latest migration brings the checked-in migration history in line with the Prisma schema. Apply pending migrations with `pnpm prisma:migrate:deploy` after PostgreSQL is available.

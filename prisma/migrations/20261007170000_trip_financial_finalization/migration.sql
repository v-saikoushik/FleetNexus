CREATE TYPE "TripFinancialStatus" AS ENUM ('OPEN', 'READY_FOR_REVIEW', 'FINALIZED');

ALTER TABLE "trips"
  ADD COLUMN "financialStatus" "TripFinancialStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "financialFinalizedAt" TIMESTAMP(3),
  ADD COLUMN "financialFinalizedById" TEXT;

CREATE INDEX "trips_organizationId_financialStatus_idx"
  ON "trips"("organizationId", "financialStatus");

ALTER TABLE "trips" ADD CONSTRAINT "trips_financialFinalizedById_fkey"
  FOREIGN KEY ("financialFinalizedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

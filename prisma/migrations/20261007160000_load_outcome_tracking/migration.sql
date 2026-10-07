CREATE TYPE "LoadPredictionStatus" AS ENUM (
  'PENDING',
  'INSUFFICIENT_ACTUAL_DATA',
  'COMPLETED',
  'CANCELLED',
  'NOT_EXECUTED'
);

CREATE TABLE "load_predictions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "tripId" TEXT,
  "decision" TEXT NOT NULL,
  "outcomeStatus" "LoadPredictionStatus" NOT NULL DEFAULT 'PENDING',
  "methodVersion" TEXT NOT NULL DEFAULT 'decision-support-v1',
  "inputSnapshot" JSONB NOT NULL,
  "predictionSnapshot" JSONB NOT NULL,
  "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "load_predictions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "load_predictions_tripId_key" ON "load_predictions"("tripId");
CREATE INDEX "load_predictions_organizationId_analyzedAt_idx" ON "load_predictions"("organizationId", "analyzedAt");
CREATE INDEX "load_predictions_organizationId_decision_outcomeStatus_idx" ON "load_predictions"("organizationId", "decision", "outcomeStatus");

ALTER TABLE "load_predictions" ADD CONSTRAINT "load_predictions_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "load_predictions" ADD CONSTRAINT "load_predictions_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

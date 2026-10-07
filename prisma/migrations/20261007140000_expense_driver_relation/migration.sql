-- AddColumn
ALTER TABLE "expenses" ADD COLUMN "driverId" TEXT;

-- CreateIndex
CREATE INDEX "expenses_driverId_idx" ON "expenses"("driverId");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_driverId_fkey"
FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

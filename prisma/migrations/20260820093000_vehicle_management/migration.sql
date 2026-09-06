-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TRUCK', 'TRAILER', 'TANKER', 'TIPPER', 'CONTAINER', 'PICKUP', 'MINI_TRUCK', 'OTHER');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('DIESEL', 'PETROL', 'CNG', 'LNG', 'ELECTRIC', 'OTHER');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "manufactureYear" INTEGER NOT NULL,
    "chassisNumber" TEXT,
    "engineNumber" TEXT,
    "fuelType" "FuelType" NOT NULL,
    "capacityTons" DECIMAL(10,2) NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicles_organizationId_status_idx" ON "vehicles"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_organizationId_registrationNumber_key" ON "vehicles"("organizationId", "registrationNumber");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

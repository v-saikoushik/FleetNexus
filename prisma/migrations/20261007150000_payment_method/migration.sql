-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER');

-- AddColumn
ALTER TABLE "payments" ADD COLUMN "paymentMethod" "PaymentMethod";

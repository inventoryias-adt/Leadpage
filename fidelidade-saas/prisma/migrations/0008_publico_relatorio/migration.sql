-- CreateEnum
CREATE TYPE "PromoAudience" AS ENUM ('ALL', 'NEW', 'INACTIVE');

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "audience" "PromoAudience" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "inactiveDays" INTEGER;

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "billPoints" INTEGER;

-- CreateTable
CREATE TABLE "PromotionUse" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT,
    "restaurantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromotionUse_claimId_promotionId_key" ON "PromotionUse"("claimId", "promotionId");

-- CreateIndex
CREATE INDEX "PromotionUse_restaurantId_createdAt_idx" ON "PromotionUse"("restaurantId", "createdAt");

-- AddForeignKey
ALTER TABLE "PromotionUse" ADD CONSTRAINT "PromotionUse_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionUse" ADD CONSTRAINT "PromotionUse_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionUse" ADD CONSTRAINT "PromotionUse_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionUse" ENABLE ROW LEVEL SECURITY;

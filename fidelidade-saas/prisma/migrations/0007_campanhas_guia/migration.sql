-- CreateEnum
CREATE TYPE "PromoKind" AS ENUM ('MULTIPLIER', 'BONUS');

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "guideDoneAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "PromoKind" NOT NULL,
    "multiplier" DOUBLE PRECISION,
    "bonusPoints" INTEGER,
    "minAmountCents" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "weekdays" INTEGER[],
    "startTime" TEXT,
    "endTime" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Promotion_restaurantId_idx" ON "Promotion"("restaurantId");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Promotion" ENABLE ROW LEVEL SECURITY;

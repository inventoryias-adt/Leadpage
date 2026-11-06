-- AlterTable
ALTER TABLE "InteractionClaim" ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "googleReviewId" TEXT,
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "googleLocation" TEXT;

-- CreateTable
CREATE TABLE "GoogleConnection" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "googleEmail" TEXT,
    "locations" JSONB,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleReviewIntent" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "unitId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleReviewIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleConnection_restaurantId_key" ON "GoogleConnection"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleReviewIntent_customerId_ruleId_key" ON "GoogleReviewIntent"("customerId", "ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "InteractionClaim_restaurantId_googleReviewId_key" ON "InteractionClaim"("restaurantId", "googleReviewId");

-- AddForeignKey
ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleReviewIntent" ADD CONSTRAINT "GoogleReviewIntent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleReviewIntent" ADD CONSTRAINT "GoogleReviewIntent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "InteractionRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleReviewIntent" ADD CONSTRAINT "GoogleReviewIntent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


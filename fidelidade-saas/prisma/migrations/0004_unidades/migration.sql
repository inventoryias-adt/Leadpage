-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN     "usedUnitId" TEXT;

-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "unitId" TEXT;

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "openingSchedule" JSONB,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "googleReviewUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Unit_restaurantId_idx" ON "Unit"("restaurantId");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_usedUnitId_fkey" FOREIGN KEY ("usedUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Cada marca existente ganha uma unidade com os dados que antes ficavam na própria marca.
INSERT INTO "Unit" ("id", "restaurantId", "name", "address", "openingSchedule", "latitude", "longitude", "googleReviewUrl")
SELECT gen_random_uuid()::text, r."id", 'Unidade principal', r."address", r."openingSchedule", r."latitude", r."longitude", r."googleReviewUrl"
FROM "Restaurant" r;

UPDATE "Claim" c SET "unitId" = u."id" FROM "Unit" u WHERE u."restaurantId" = c."restaurantId" AND c."unitId" IS NULL;
UPDATE "CheckIn" k SET "unitId" = u."id" FROM "Unit" u WHERE u."restaurantId" = k."restaurantId" AND k."unitId" IS NULL;

ALTER TABLE "Unit" ENABLE ROW LEVEL SECURITY;

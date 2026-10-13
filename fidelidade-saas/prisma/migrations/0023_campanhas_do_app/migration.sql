-- Campanhas do app: a plataforma propõe (ex.: pontos em dobro terça e quinta) e cada estabelecimento adota ou não.
-- Adotar cria uma Promotion do estabelecimento ligada à campanha, então todo o motor de pontos continua o mesmo.
CREATE TABLE "AppCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" "PromoKind" NOT NULL,
    "multiplier" DOUBLE PRECISION,
    "bonusPoints" INTEGER,
    "minAmountCents" INTEGER NOT NULL DEFAULT 0,
    "weekdays" INTEGER[],
    "startTime" TEXT,
    "endTime" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppCampaign_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Promotion" ADD COLUMN "appCampaignId" TEXT;
CREATE UNIQUE INDEX "Promotion_restaurantId_appCampaignId_key" ON "Promotion"("restaurantId", "appCampaignId");
CREATE INDEX "Promotion_appCampaignId_idx" ON "Promotion"("appCampaignId");
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_appCampaignId_fkey" FOREIGN KEY ("appCampaignId") REFERENCES "AppCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

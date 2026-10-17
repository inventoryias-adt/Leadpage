-- "Já fiz": o cliente pede os pontos de uma interação (Google, Instagram…) e o dono aprova, recusa ou deixa entrar sozinho em 24 h. Só adiciona.
ALTER TABLE "InteractionRule" ADD COLUMN "approval" TEXT NOT NULL DEFAULT 'COUNTER';

CREATE TYPE "InteractionClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "InteractionClaim" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ruleId" TEXT,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "status" "InteractionClaimStatus" NOT NULL DEFAULT 'PENDING',
    "autoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    CONSTRAINT "InteractionClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InteractionClaim_restaurantId_status_idx" ON "InteractionClaim"("restaurantId", "status");
CREATE INDEX "InteractionClaim_customerId_ruleId_createdAt_idx" ON "InteractionClaim"("customerId", "ruleId", "createdAt");
ALTER TABLE "InteractionClaim" ADD CONSTRAINT "InteractionClaim_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteractionClaim" ADD CONSTRAINT "InteractionClaim_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteractionClaim" ADD CONSTRAINT "InteractionClaim_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "InteractionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Produção: tabela nova com o dono "fidelize_app" e RLS ligado sem políticas (ver 0026/0027 e o README). Em bancos sem esse papel não faz nada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fidelize_app') THEN
    ALTER TABLE "InteractionClaim" OWNER TO fidelize_app;
    ALTER TABLE "InteractionClaim" ENABLE ROW LEVEL SECURITY;
    ALTER TYPE "InteractionClaimStatus" OWNER TO fidelize_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "InteractionClaim" FROM anon, authenticated, service_role;
  END IF;
END $$;

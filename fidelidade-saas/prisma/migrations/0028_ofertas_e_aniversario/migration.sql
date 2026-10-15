-- Ofertas com prazo e estoque no cardápio, aniversário do cliente (só dia e mês) e presente de pontos do lugar. Só adiciona.
ALTER TABLE "MenuItem" ADD COLUMN "spotlight" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MenuItem" ADD COLUMN "offerEndsAt" TIMESTAMP(3);
ALTER TABLE "MenuItem" ADD COLUMN "offerStock" INTEGER;
ALTER TABLE "MenuItem" ADD COLUMN "offerStockTotal" INTEGER;

ALTER TABLE "Customer" ADD COLUMN "birthDay" INTEGER;
ALTER TABLE "Customer" ADD COLUMN "birthMonth" INTEGER;
ALTER TABLE "Restaurant" ADD COLUMN "birthdayPoints" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "BirthdayGift" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BirthdayGift_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BirthdayGift_customerId_restaurantId_year_key" ON "BirthdayGift"("customerId", "restaurantId", "year");
ALTER TABLE "BirthdayGift" ADD CONSTRAINT "BirthdayGift_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BirthdayGift" ADD CONSTRAINT "BirthdayGift_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Produção: tabela nova com o dono "fidelize_app" e RLS ligado sem políticas (ver 0026/0027 e o README). Em bancos sem esse papel não faz nada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fidelize_app') THEN
    ALTER TABLE "BirthdayGift" OWNER TO fidelize_app;
    ALTER TABLE "BirthdayGift" ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "BirthdayGift" FROM anon, authenticated, service_role;
  END IF;
END $$;

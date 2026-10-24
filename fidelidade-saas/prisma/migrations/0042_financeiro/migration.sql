-- Gestão financeira: comissão por profissional, entradas e despesas lançadas pelo dono e comissões já pagas.
ALTER TABLE "Resource" ADD COLUMN "commissionBp" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "FinanceEntry" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "recurrence" TEXT NOT NULL DEFAULT 'NONE',
    "endsOn" DATE,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FinanceEntry_kind_check" CHECK ("kind" IN ('IN', 'OUT')),
    CONSTRAINT "FinanceEntry_recurrence_check" CHECK ("recurrence" IN ('NONE', 'MONTHLY')),
    CONSTRAINT "FinanceEntry_amount_check" CHECK ("amountCents" > 0)
);

CREATE TABLE "CommissionPayout" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "resourceId" TEXT,
    "resourceName" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "commissionBp" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceEntry_refId_key" ON "FinanceEntry"("refId");
CREATE INDEX "FinanceEntry_restaurantId_date_idx" ON "FinanceEntry"("restaurantId", "date");
CREATE UNIQUE INDEX "CommissionPayout_resourceId_month_key" ON "CommissionPayout"("resourceId", "month");
CREATE INDEX "CommissionPayout_restaurantId_month_idx" ON "CommissionPayout"("restaurantId", "month");

ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Produção: tabelas do papel "fidelize_app", com RLS ligado sem políticas (ver 0026 e o README). Sem esse papel (dev, CI) não faz nada.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['FinanceEntry', 'CommissionPayout'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fidelize_app') THEN
      EXECUTE format('ALTER TABLE %I OWNER TO fidelize_app', t);
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated, service_role', t);
    END IF;
  END LOOP;
END $$;

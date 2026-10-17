-- ID da conta do cliente (FZ-XXXXXX): alternativa ao CPF para o caixa encontrar a conta e lançar pontos.
-- Aditiva: coluna nova, preenchida para quem já existe, com índice único.
ALTER TABLE "Customer" ADD COLUMN "accountCode" TEXT;

DO $$
DECLARE
  r RECORD;
  c TEXT;
BEGIN
  FOR r IN SELECT id FROM "Customer" WHERE "accountCode" IS NULL LOOP
    LOOP
      c := 'FZ-' || (SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') FROM generate_series(1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "Customer" WHERE "accountCode" = c);
    END LOOP;
    UPDATE "Customer" SET "accountCode" = c WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX "Customer_accountCode_key" ON "Customer"("accountCode");

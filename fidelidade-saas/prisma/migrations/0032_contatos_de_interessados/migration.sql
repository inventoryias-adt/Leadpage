-- Contatos de comerciantes interessados (formulário "Quero o Fidelize no meu negócio"). Só adiciona.
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "business" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "category" TEXT NOT NULL,
    "categoryOther" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'app',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactedAt" TIMESTAMP(3),
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- Produção: tabela nova com o dono "fidelize_app" e RLS ligado sem políticas (ver 0026/0027 e o README). Em bancos sem esse papel não faz nada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fidelize_app') THEN
    ALTER TABLE "Lead" OWNER TO fidelize_app;
    ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Lead" FROM anon, authenticated, service_role;
  END IF;
END $$;

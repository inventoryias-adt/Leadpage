-- Registro do aceite dos Termos de Uso e da Política de Privacidade (quando e qual versão). Contas anteriores ficam nulas.
ALTER TABLE "Restaurant" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Restaurant" ADD COLUMN "termsVersion" TEXT;
ALTER TABLE "Customer" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "termsVersion" TEXT;

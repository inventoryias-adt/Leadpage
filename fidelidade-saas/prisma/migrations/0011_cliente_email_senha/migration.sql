-- Cliente final passa a entrar com e-mail e senha. Os dois campos são opcionais porque quem já tinha
-- cadastro (CPF + telefone) cria o acesso depois, uma única vez.
ALTER TABLE "Customer" ADD COLUMN "email" TEXT;
ALTER TABLE "Customer" ADD COLUMN "passwordHash" TEXT;
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- Foto de perfil do cliente: tabela própria (uma por cliente), só o dono enxerga.
CREATE TABLE "CustomerPhoto" (
    "customerId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPhoto_pkey" PRIMARY KEY ("customerId")
);

ALTER TABLE "CustomerPhoto" ADD CONSTRAINT "CustomerPhoto_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

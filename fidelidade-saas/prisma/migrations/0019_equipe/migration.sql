-- Equipe: foto, contato e escala de cada profissional; quais serviços faz e em quanto tempo; e-mail padrão de aviso.
ALTER TABLE "Restaurant" ADD COLUMN "bookingNotifyEmail" TEXT;
ALTER TABLE "Resource" ADD COLUMN "photoImageId" TEXT;
ALTER TABLE "Resource" ADD COLUMN "email" TEXT;
ALTER TABLE "Resource" ADD COLUMN "phone" TEXT;
ALTER TABLE "Resource" ADD COLUMN "schedule" JSONB;

CREATE TABLE "ResourceService" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "durationMin" INTEGER,
    CONSTRAINT "ResourceService_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResourceService_resourceId_serviceId_key" ON "ResourceService"("resourceId", "serviceId");
CREATE INDEX "ResourceService_serviceId_idx" ON "ResourceService"("serviceId");
ALTER TABLE "ResourceService" ADD CONSTRAINT "ResourceService_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceService" ADD CONSTRAINT "ResourceService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Serviços que já tinham um profissional fixo passam a valer pela nova ligação.
INSERT INTO "ResourceService" ("id", "resourceId", "serviceId")
SELECT gen_random_uuid()::text, "resourceId", "id" FROM "Service" WHERE "resourceId" IS NOT NULL;

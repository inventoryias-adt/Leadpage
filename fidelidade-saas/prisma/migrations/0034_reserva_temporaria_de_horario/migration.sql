-- Reserva temporária de horário: ao tocar num horário, ele fica segurado para o cliente por alguns minutos.
CREATE TABLE "SlotHold" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlotHold_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SlotHold_customerId_restaurantId_key" ON "SlotHold"("customerId", "restaurantId");
CREATE INDEX "SlotHold_resourceId_expiresAt_idx" ON "SlotHold"("resourceId", "expiresAt");

ALTER TABLE "SlotHold" ADD CONSTRAINT "SlotHold_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlotHold" ADD CONSTRAINT "SlotHold_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SlotHold" ADD CONSTRAINT "SlotHold_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Produção: tabela do papel "fidelize_app", com RLS ligado sem políticas (ver 0026 e o README). Sem esse papel (dev, CI) não faz nada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fidelize_app') THEN
    ALTER TABLE "SlotHold" OWNER TO fidelize_app;
    ALTER TABLE "SlotHold" ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "SlotHold" FROM anon, authenticated, service_role;
  END IF;
END $$;

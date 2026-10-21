-- Encaixe feito pelo dono (cliente sem conta), folgas/bloqueios da agenda e intervalo entre atendimentos.
ALTER TABLE "Booking" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "Booking" ADD COLUMN "guestName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guestPhone" TEXT;
ALTER TABLE "Booking" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "bookingBufferMin" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "TimeOff" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "unitId" TEXT,
    "resourceId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeOff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimeOff_restaurantId_startsAt_idx" ON "TimeOff"("restaurantId", "startsAt");
CREATE INDEX "TimeOff_resourceId_startsAt_idx" ON "TimeOff"("resourceId", "startsAt");

ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Produção: tabela do papel "fidelize_app", com RLS ligado sem políticas (ver 0026 e o README). Sem esse papel (dev, CI) não faz nada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fidelize_app') THEN
    ALTER TABLE "TimeOff" OWNER TO fidelize_app;
    ALTER TABLE "TimeOff" ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "TimeOff" FROM anon, authenticated, service_role;
  END IF;
END $$;

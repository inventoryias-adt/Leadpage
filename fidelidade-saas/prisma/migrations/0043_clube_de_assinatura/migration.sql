-- Clube de assinatura: planos do estabelecimento, assinaturas dos clientes e o vínculo do agendamento com a assinatura.
CREATE TABLE "ClubPlan" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubPlan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClubPlan_price_check" CHECK ("priceCents" > 0)
);

CREATE TABLE "ClubPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ClubPlanItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClubPlanItem_quantity_check" CHECK ("quantity" BETWEEN 1 AND 99)
);

CREATE TABLE "ClubSubscription" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "anchorDate" DATE,
    "paidPeriods" INTEGER NOT NULL DEFAULT 0,
    "planName" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubSubscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClubSubscription_status_check" CHECK ("status" IN ('ACTIVE', 'CANCELED')),
    CONSTRAINT "ClubSubscription_requestedBy_check" CHECK ("requestedBy" IN ('CUSTOMER', 'OWNER'))
);

ALTER TABLE "Booking" ADD COLUMN "clubSubscriptionId" TEXT;

CREATE INDEX "ClubPlan_restaurantId_active_idx" ON "ClubPlan"("restaurantId", "active");
CREATE UNIQUE INDEX "ClubPlanItem_planId_serviceId_key" ON "ClubPlanItem"("planId", "serviceId");
CREATE INDEX "ClubSubscription_restaurantId_status_idx" ON "ClubSubscription"("restaurantId", "status");
CREATE INDEX "ClubSubscription_customerId_idx" ON "ClubSubscription"("customerId");
-- Um cliente só tem uma assinatura em vigor por plano (pode assinar de novo depois de cancelar).
CREATE UNIQUE INDEX "ClubSubscription_one_active_per_plan" ON "ClubSubscription"("customerId", "planId") WHERE "status" = 'ACTIVE';
CREATE INDEX "Booking_clubSubscriptionId_idx" ON "Booking"("clubSubscriptionId");

ALTER TABLE "ClubPlan" ADD CONSTRAINT "ClubPlan_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubPlanItem" ADD CONSTRAINT "ClubPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ClubPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubPlanItem" ADD CONSTRAINT "ClubPlanItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubSubscription" ADD CONSTRAINT "ClubSubscription_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubSubscription" ADD CONSTRAINT "ClubSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ClubPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubSubscription" ADD CONSTRAINT "ClubSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clubSubscriptionId_fkey" FOREIGN KEY ("clubSubscriptionId") REFERENCES "ClubSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Produção: tabelas do papel "fidelize_app", com RLS ligado sem políticas (ver 0026 e o README). Sem esse papel (dev, CI) não faz nada.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ClubPlan', 'ClubPlanItem', 'ClubSubscription'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fidelize_app') THEN
      EXECUTE format('ALTER TABLE %I OWNER TO fidelize_app', t);
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated, service_role', t);
    END IF;
  END LOOP;
END $$;

-- Pedidos pelo app: cardápio em R$, pedido para retirada (pagamento no balcão) e itens do pedido. Só adiciona; o código antigo segue funcionando.
CREATE TYPE "OrderStatus" AS ENUM ('RECEIVED', 'PREPARING', 'READY', 'PICKED_UP', 'CANCELED');

ALTER TABLE "Restaurant" ADD COLUMN "ordersEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN "orderPrepMin" INTEGER NOT NULL DEFAULT 15;

CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "promoCents" INTEGER,
    "category" TEXT NOT NULL DEFAULT 'Cardápio',
    "imageId" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "unitId" TEXT,
    "customerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "totalCents" INTEGER NOT NULL,
    "prepMin" INTEGER NOT NULL,
    "note" TEXT,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "claimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "canceledBy" TEXT,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "unitCents" INTEGER NOT NULL,
    "listCents" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "imageId" TEXT,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MenuItem_restaurantId_active_idx" ON "MenuItem"("restaurantId", "active");
CREATE UNIQUE INDEX "Order_claimId_key" ON "Order"("claimId");
CREATE UNIQUE INDEX "Order_restaurantId_code_key" ON "Order"("restaurantId", "code");
CREATE INDEX "Order_restaurantId_status_createdAt_idx" ON "Order"("restaurantId", "status", "createdAt");
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Produção: as tabelas do app pertencem ao papel "fidelize_app" e têm RLS ligado sem políticas (ver 0026 e o README).
-- Em bancos sem esse papel (desenvolvimento local, CI) esta parte não faz nada.
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fidelize_app') THEN
    FOREACH t IN ARRAY ARRAY['MenuItem', 'Order', 'OrderItem'] LOOP
      EXECUTE format('ALTER TABLE %I OWNER TO fidelize_app', t);
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
    ALTER TYPE "OrderStatus" OWNER TO fidelize_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    FOREACH t IN ARRAY ARRAY['MenuItem', 'Order', 'OrderItem'] LOOP
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated, service_role', t);
    END LOOP;
  END IF;
END $$;

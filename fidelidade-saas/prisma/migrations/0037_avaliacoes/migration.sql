-- Avaliações: o cliente avalia o lugar (e quem atendeu) depois de um atendimento concluído.
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "resourceId" TEXT,
    "placeRating" INTEGER NOT NULL,
    "staffRating" INTEGER,
    "comment" TEXT,
    "ownerReply" TEXT,
    "ownerRepliedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "reportReason" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Review_placeRating_check" CHECK ("placeRating" BETWEEN 1 AND 5),
    CONSTRAINT "Review_staffRating_check" CHECK ("staffRating" IS NULL OR "staffRating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");
CREATE INDEX "Review_restaurantId_createdAt_idx" ON "Review"("restaurantId", "createdAt");
CREATE INDEX "Review_resourceId_idx" ON "Review"("resourceId");
CREATE INDEX "Review_reportedAt_idx" ON "Review"("reportedAt");

ALTER TABLE "Review" ADD CONSTRAINT "Review_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Produção: tabela do papel "fidelize_app", com RLS ligado sem políticas (ver 0026 e o README). Sem esse papel (dev, CI) não faz nada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fidelize_app') THEN
    ALTER TABLE "Review" OWNER TO fidelize_app;
    ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Review" FROM anon, authenticated, service_role;
  END IF;
END $$;

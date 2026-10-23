-- Indicações: o cliente posta a foto de um lugar onde tem carteira, com nota e comentário; curtir e denunciar.
ALTER TABLE "Customer" ADD COLUMN "instagram" TEXT;

CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Post_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE TABLE "PostPhoto" (
    "postId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "PostPhoto_pkey" PRIMARY KEY ("postId")
);

CREATE TABLE "PostLike" (
    "postId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("postId", "customerId")
);

CREATE TABLE "PostReport" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterCustomerId" TEXT,
    "reporterRestaurantId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");
CREATE INDEX "Post_restaurantId_createdAt_idx" ON "Post"("restaurantId", "createdAt");
CREATE INDEX "Post_customerId_createdAt_idx" ON "Post"("customerId", "createdAt");
CREATE INDEX "Post_reportedAt_idx" ON "Post"("reportedAt");
CREATE INDEX "PostLike_customerId_idx" ON "PostLike"("customerId");
CREATE INDEX "PostReport_postId_idx" ON "PostReport"("postId");

ALTER TABLE "Post" ADD CONSTRAINT "Post_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostPhoto" ADD CONSTRAINT "PostPhoto_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Produção: tabelas do papel "fidelize_app", com RLS ligado sem políticas (ver 0026 e o README). Sem esse papel (dev, CI) não faz nada.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Post', 'PostPhoto', 'PostLike', 'PostReport'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fidelize_app') THEN
      EXECUTE format('ALTER TABLE %I OWNER TO fidelize_app', t);
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated, service_role', t);
    END IF;
  END LOOP;
END $$;

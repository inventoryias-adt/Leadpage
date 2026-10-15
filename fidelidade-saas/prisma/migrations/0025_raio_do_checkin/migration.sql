-- Raio do check-in por estabelecimento (m). Padrão 10: só vale estando dentro da loja. O cliente nunca vê esse número.
ALTER TABLE "Restaurant" ADD COLUMN "checkInRadiusM" INTEGER NOT NULL DEFAULT 10;

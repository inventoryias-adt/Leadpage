-- Pontos como desconto nos serviços: quanto vale cada R$ 1,00 (por estabelecimento), até quantos % cada serviço aceita
-- e o que cada agendamento usou (os pontos voltam se o agendamento for cancelado).
ALTER TABLE "Restaurant" ADD COLUMN "pointsPerRealOff" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Service" ADD COLUMN "pointsDiscountMaxPct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "pointsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;

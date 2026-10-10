-- Pontos compartilhados entre lugares: cada estabelecimento decide se os pontos ganhos nele valem em outros lugares
-- e se ele aceita pontos ganhos em outros lugares. Ambos começam desligados.
ALTER TABLE "Restaurant" ADD COLUMN "pointsShareOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN "pointsAcceptIn" BOOLEAN NOT NULL DEFAULT false;

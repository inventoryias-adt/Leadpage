-- Horário de funcionamento deixa de ser texto livre e passa a ser estruturado por dia da semana.
ALTER TABLE "Restaurant" DROP COLUMN "openingHours";
ALTER TABLE "Restaurant" ADD COLUMN "openingSchedule" JSONB;

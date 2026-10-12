-- Lembrete "está tudo certo?" ~30 min antes do horário: quando foi enviado e o que o cliente respondeu (OK = vai; NO = liberou o horário).
ALTER TABLE "Booking" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "reminderAnswer" TEXT;
ALTER TABLE "Booking" ADD COLUMN "reminderAnsweredAt" TIMESTAMP(3);
CREATE INDEX "Booking_status_startsAt_idx" ON "Booking"("status", "startsAt");

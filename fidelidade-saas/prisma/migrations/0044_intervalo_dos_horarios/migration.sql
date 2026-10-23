-- Intervalo entre os horários da agenda: 0 = automático (30 min, ou o tamanho do serviço quando ele dura outro tempo), ou 15, 30 e 60 min.
ALTER TABLE "Restaurant" ADD COLUMN "bookingSlotStepMin" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_bookingSlotStepMin_check" CHECK ("bookingSlotStepMin" IN (0, 15, 30, 60));

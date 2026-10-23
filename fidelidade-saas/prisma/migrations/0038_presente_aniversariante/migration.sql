-- Presente do aniversariante: o lugar define um item/benefício e o cliente resgata o cupom no dia do aniversário.
ALTER TABLE "Restaurant" ADD COLUMN "birthdayPerkOn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Restaurant" ADD COLUMN "birthdayPerkTitle" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "birthdayPerkMode" TEXT NOT NULL DEFAULT 'FREE';
ALTER TABLE "Restaurant" ADD COLUMN "birthdayPerkPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Restaurant" ADD COLUMN "birthdayPerkMinCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_birthdayPerkMode_check" CHECK ("birthdayPerkMode" IN ('FREE', 'POINTS', 'SPEND'));
ALTER TABLE "Reward" ADD COLUMN "birthdayOnly" BOOLEAN NOT NULL DEFAULT false;

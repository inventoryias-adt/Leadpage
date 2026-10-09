-- Prêmio "R$ + pontos": o cliente paga um valor menor no balcão e dá alguns pontos (desconto). 0 = só pontos.
ALTER TABLE "Reward" ADD COLUMN "cashCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Redemption" ADD COLUMN "cashCents" INTEGER NOT NULL DEFAULT 0;

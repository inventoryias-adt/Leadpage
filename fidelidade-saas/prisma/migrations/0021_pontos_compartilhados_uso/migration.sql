-- Pontos compartilhados em uso: movimentações próprias para a conversão entre carteiras
-- (SHARED_OUT = pontos que saíram de uma carteira; SHARED_IN = pontos equivalentes que entraram em outra).
-- Ficam fora de "pontos emitidos" e "resgatados", que só contam EARN e REDEEM.
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SHARED_IN';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SHARED_OUT';

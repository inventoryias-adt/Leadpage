-- Última vez que o dono abriu Avaliações e Indicações: o que chegou depois disso aparece como novidade no Início do painel.
-- As linhas que já existem começam como "vistas" agora (nada antigo vira novidade).
ALTER TABLE "Restaurant" ADD COLUMN "reviewsSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Restaurant" ADD COLUMN "postsSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

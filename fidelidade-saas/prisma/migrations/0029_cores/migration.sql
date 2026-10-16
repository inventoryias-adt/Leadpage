-- Cor de cada campanha de pontos e de cada profissional da equipe (chave da paleta fixa; vazio = cor padrão). Só adiciona colunas.
ALTER TABLE "Promotion" ADD COLUMN "color" TEXT;
ALTER TABLE "Resource" ADD COLUMN "color" TEXT;

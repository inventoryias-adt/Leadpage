-- Perfil personalizado do estabelecimento: cor da marca (chave da paleta), slogan e "sobre nós".
ALTER TABLE "Restaurant" ADD COLUMN "brandColor" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "tagline" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "about" TEXT;

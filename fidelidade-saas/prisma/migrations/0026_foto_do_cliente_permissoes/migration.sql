-- No banco de produção as tabelas pertencem ao papel "fidelize_app" (o que o app usa para conectar) e têm RLS ligado
-- sem políticas, fechando o acesso pela API pública do Supabase. A tabela CustomerPhoto (0024) foi criada pelo papel
-- "postgres" e o app recebia "permission denied" ao ler. Este script alinha a tabela às demais; já foi aplicado em produção.
-- Em bancos sem o papel (desenvolvimento local, CI) não faz nada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fidelize_app') THEN
    ALTER TABLE "CustomerPhoto" OWNER TO fidelize_app;
    ALTER TABLE "CustomerPhoto" ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "CustomerPhoto" FROM anon, authenticated, service_role;
  END IF;
END $$;

-- Liga o RLS (sem políticas) nas tabelas da agenda e das campanhas que ficaram sem ele. O app acessa como "fidelize_app", dono das tabelas,
-- que não é afetado; o acesso público (anon/authenticated) já era negado e agora fica negado também pelo RLS. Só adiciona proteção.
-- Em bancos sem esses papéis (desenvolvimento e testes) não faz nada.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['AppCampaign', 'Booking', 'CustomerAddress', 'PasswordReset', 'Resource', 'ResourceService', 'Service'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fidelize_app') THEN
      EXECUTE format('ALTER TABLE %I OWNER TO fidelize_app', t);
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated, service_role', t);
    END IF;
  END LOOP;
END $$;

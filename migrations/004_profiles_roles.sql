-- ============================================================
-- Migration 004: Perfis de usuário + níveis de acesso
-- Rodar no SQL Editor do Supabase APÓS a migration 003
-- ============================================================

-- 1. Tabela de perfis (vincula auth.users com nome e role)
CREATE TABLE IF NOT EXISTS profiles (
  id        UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome      TEXT        NOT NULL,
  email     TEXT        NOT NULL,
  role      TEXT        NOT NULL DEFAULT 'vendedor'
                        CHECK (role IN ('vendedor', 'superadmin')),
  ativo     BOOLEAN     NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Trigger: cria perfil automaticamente ao criar usuário no Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. RLS para profiles
DROP POLICY IF EXISTS "own_profile_select"    ON profiles;
DROP POLICY IF EXISTS "superadmin_profiles"   ON profiles;

-- Cada usuário vê seu próprio perfil
CREATE POLICY "own_profile_select" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Superadmin gerencia todos
CREATE POLICY "superadmin_profiles" ON profiles
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin'
  )
  WITH CHECK (true);

-- 4. Logs: todos podem inserir (para registrar suas ações)
--         só superadmin pode ler/deletar
DROP POLICY IF EXISTS "auth_only"              ON logs;
DROP POLICY IF EXISTS "logs_insert"            ON logs;
DROP POLICY IF EXISTS "logs_superadmin_select" ON logs;
DROP POLICY IF EXISTS "logs_superadmin_delete" ON logs;

CREATE POLICY "logs_insert" ON logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "logs_superadmin_select" ON logs
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin'
  );

CREATE POLICY "logs_superadmin_delete" ON logs
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin'
  );

-- ============================================================
-- APÓS RODAR: criar o superadmin
-- 1. Vá em Authentication > Users > "Add user" no Supabase
-- 2. Insira seu e-mail e uma senha forte
-- 3. Depois rode o comando abaixo substituindo pelo seu e-mail:
--
--    UPDATE profiles SET role = 'superadmin'
--    WHERE email = 'seu@email.com';
--
-- Vendedores/usuários normais: criar em Auth > Users > Add user
-- O perfil deles será criado automaticamente como 'vendedor'
-- ============================================================

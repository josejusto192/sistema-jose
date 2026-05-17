-- ============================================================
-- Migration 003: Follow-up, Tags, Histórico, Logs + RLS Auth
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- 1. Novos campos na tabela empresas
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS data_followup DATE,
  ADD COLUMN IF NOT EXISTS tags          TEXT[] DEFAULT '{}';

-- 2. Histórico de mudanças de status
CREATE TABLE IF NOT EXISTS status_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo     TEXT        NOT NULL,
  usuario_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome    TEXT        NOT NULL DEFAULT 'Sistema',
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_empresa
  ON status_history(empresa_id, criado_em DESC);

-- 3. Logs de auditoria
CREATE TABLE IF NOT EXISTS logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  acao         TEXT        NOT NULL,  -- 'criar' | 'atualizar' | 'deletar'
  tabela       TEXT        NOT NULL,  -- 'empresas' | 'contratos'
  registro_id  UUID,
  detalhes     JSONB,
  usuario_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome TEXT        NOT NULL DEFAULT 'Sistema',
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_criado   ON logs(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_logs_usuario  ON logs(usuario_id);

-- 4. Habilitar RLS em todas as tabelas
ALTER TABLE empresas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs            ENABLE ROW LEVEL SECURITY;

-- 5. Policies — apenas usuários autenticados têm acesso
-- (drop primeiro para evitar conflito caso já existam)
DROP POLICY IF EXISTS "auth_only" ON empresas;
DROP POLICY IF EXISTS "auth_only" ON contratos;
DROP POLICY IF EXISTS "auth_only" ON status_history;
DROP POLICY IF EXISTS "auth_only" ON logs;

CREATE POLICY "auth_only" ON empresas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_only" ON contratos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_only" ON status_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_only" ON logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

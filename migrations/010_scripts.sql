-- Migration 010: Tabela de scripts de abordagem editáveis
CREATE TABLE IF NOT EXISTS scripts (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo    TEXT        NOT NULL,
  canal     TEXT        NOT NULL DEFAULT 'whatsapp',
  texto     TEXT        NOT NULL,
  ordem     INTEGER     NOT NULL DEFAULT 0,
  ativo     BOOLEAN     NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only" ON scripts FOR ALL TO authenticated USING (true) WITH CHECK (true);

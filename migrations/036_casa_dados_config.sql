-- Config da integração com a Casa dos Dados (substitui o fluxo do n8n) —
-- guarda a api-key usada pra consultar /v4/cnpj/{cnpj} a partir do webhook
-- de monitoramento (casa-dos-dados-webhook).
CREATE TABLE IF NOT EXISTS casa_dados_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE casa_dados_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all casa_dados_config" ON casa_dados_config
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

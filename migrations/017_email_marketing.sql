-- =============================================
-- Migration 017: Email Marketing (campanhas)
-- =============================================
-- Mesmo padrão do WhatsApp: tabela de config editável pela tela de
-- Configurações (sem precisar de Edge Function Secrets) + tabelas próprias
-- para campanhas e o envio individual de cada destinatário (auditoria e
-- retomada em caso de falha parcial).

CREATE TABLE IF NOT EXISTS email_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT DEFAULT 'resend',
  api_key         TEXT,
  remetente_nome  TEXT,
  remetente_email TEXT,
  ativo           BOOLEAN DEFAULT false,
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all email_config" ON email_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO email_config (provider, ativo)
SELECT 'resend', false
WHERE NOT EXISTS (SELECT 1 FROM email_config);

-- segmento_tags = null/vazio significa "todos os leads com email válido";
-- senão, só os leads que têm pelo menos uma das tags listadas.
CREATE TABLE IF NOT EXISTS email_campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                TEXT NOT NULL,
  assunto             TEXT NOT NULL,
  corpo_html          TEXT NOT NULL,
  segmento_tags       TEXT[],
  status              TEXT NOT NULL DEFAULT 'rascunho', -- rascunho | enviando | enviado | erro
  total_destinatarios INTEGER DEFAULT 0,
  total_enviados      INTEGER DEFAULT 0,
  total_falhas        INTEGER DEFAULT 0,
  criado_por          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  enviado_em          TIMESTAMPTZ
);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all email_campaigns" ON email_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS email_campaign_envios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  lead_id      UUID REFERENCES leads(id) ON DELETE SET NULL,
  email        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pendente', -- pendente | enviado | falhou
  erro         TEXT,
  enviado_em   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_campaign_envios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all email_campaign_envios" ON email_campaign_envios FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_campaign_envios_campaign ON email_campaign_envios(campaign_id);

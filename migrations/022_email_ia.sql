-- =============================================
-- Migration 022: Geração de email por IA (Gemini), por lead
-- =============================================
-- Permite criar campanhas onde assunto e corpo são gerados individualmente
-- para cada lead por uma IA, a partir de um objetivo (prompt) definido na
-- campanha + diretrizes universais opcionais (aplicadas a todas as
-- campanhas) + todos os dados do lead/empresa.

ALTER TABLE email_config ADD COLUMN IF NOT EXISTS ia_provider TEXT DEFAULT 'gemini';
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS ia_api_key TEXT;
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS ia_modelo TEXT DEFAULT 'gemini-2.0-flash';
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS ia_diretrizes TEXT;
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS ia_intervalo_segundos INTEGER DEFAULT 60;

ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS usar_ia BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS ia_objetivo TEXT;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS ia_inicio_em TIMESTAMPTZ;

-- Em campanhas de IA, assunto/corpo_html da campanha não fazem sentido
-- (cada lead recebe um texto diferente, gerado na hora do envio).
ALTER TABLE email_campaigns ALTER COLUMN assunto DROP NOT NULL;
ALTER TABLE email_campaigns ALTER COLUMN corpo_html DROP NOT NULL;

ALTER TABLE email_campaign_envios ADD COLUMN IF NOT EXISTS assunto_gerado TEXT;
ALTER TABLE email_campaign_envios ADD COLUMN IF NOT EXISTS corpo_gerado TEXT;

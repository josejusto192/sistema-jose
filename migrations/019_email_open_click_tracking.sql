-- =============================================
-- Migration 019: Rastreio de abertura/clique nas campanhas de email
-- =============================================
-- O Resend não rastreia respostas (ele só envia, não é caixa de entrada),
-- mas envia webhooks de email.opened/email.clicked que a function
-- email-webhook recebe e grava aqui, casando pelo resend_id de cada envio.

ALTER TABLE email_campaign_envios ADD COLUMN IF NOT EXISTS resend_id TEXT;
ALTER TABLE email_campaign_envios ADD COLUMN IF NOT EXISTS aberto_em TIMESTAMPTZ;
ALTER TABLE email_campaign_envios ADD COLUMN IF NOT EXISTS clicado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_campaign_envios_resend_id ON email_campaign_envios(resend_id);

ALTER TABLE email_config ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

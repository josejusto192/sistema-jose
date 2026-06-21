-- =============================================
-- Migration 032: Rastreio de bounce/reclamação de spam/entrega nos emails
-- =============================================
-- O webhook (email-webhook) só tratava email.opened/email.clicked. Emails
-- que de fato bounçam (endereço inválido) ou geram reclamação de spam
-- ficavam marcados como "enviado" pra sempre, sem nenhum sinal no sistema.
-- Adiciona colunas pra registrar esses eventos do Resend nas duas tabelas
-- de envio (campanha manual antiga e automação atual).

ALTER TABLE email_campaign_envios ADD COLUMN IF NOT EXISTS entregue_em TIMESTAMPTZ;
ALTER TABLE email_campaign_envios ADD COLUMN IF NOT EXISTS bounced_em TIMESTAMPTZ;
ALTER TABLE email_campaign_envios ADD COLUMN IF NOT EXISTS bounce_motivo TEXT;
ALTER TABLE email_campaign_envios ADD COLUMN IF NOT EXISTS reclamado_em TIMESTAMPTZ;

ALTER TABLE email_automation_envios ADD COLUMN IF NOT EXISTS entregue_em TIMESTAMPTZ;
ALTER TABLE email_automation_envios ADD COLUMN IF NOT EXISTS bounced_em TIMESTAMPTZ;
ALTER TABLE email_automation_envios ADD COLUMN IF NOT EXISTS bounce_motivo TEXT;
ALTER TABLE email_automation_envios ADD COLUMN IF NOT EXISTS reclamado_em TIMESTAMPTZ;

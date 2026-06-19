-- =============================================
-- Migration 020: Campos extras de envio (Resend) nas campanhas
-- =============================================
-- Opções pedidas pelo usuário na etapa de Conteúdo, espelhando o que a
-- API do Resend já aceita no /emails: responder para (reply-to), cc/cco,
-- agendamento de envio e anexos.

ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS responder_para TEXT;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS cc TEXT[];
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS cco TEXT[];
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS agendado_para TIMESTAMPTZ;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS anexos JSONB;

-- =============================================
-- Migration 027: Opções avançadas por passo da automação
-- =============================================
-- As campanhas manuais (email_campaigns) já tinham responder_para/cc/cco/anexos
-- (migration 020) mas os passos de automação (email_automation_steps) nunca
-- ganharam os mesmos campos — cada email da sequência precisa poder ter seu
-- próprio reply-to/cc/cco/anexos, já que passos diferentes podem ter
-- finalidades diferentes (ex: só o último passo da sequência leva um anexo
-- com a proposta).

ALTER TABLE email_automation_steps ADD COLUMN IF NOT EXISTS responder_para TEXT;
ALTER TABLE email_automation_steps ADD COLUMN IF NOT EXISTS cc TEXT[];
ALTER TABLE email_automation_steps ADD COLUMN IF NOT EXISTS cco TEXT[];
ALTER TABLE email_automation_steps ADD COLUMN IF NOT EXISTS anexos JSONB;

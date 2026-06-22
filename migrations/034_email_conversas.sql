-- =============================================
-- Migration 034: Conversa por email (receber respostas + continuar manualmente)
-- =============================================
-- Hoje o sistema só ENVIA email (campanhas/automações via Resend) e rastreia
-- eventos de saída (aberto/clicado/entregue/bounce). Não existe como receber
-- a resposta de um lead nem continuar a conversa pelo mesmo thread.
--
-- Esta migration adiciona:
-- 1. Config de uma caixa de email dedicada (IMAP) só pra receber respostas,
--    sem precisar tocar no MX do domínio principal (a caixa é criada à parte
--    no painel de hospedagem) nem trocar o provedor de envio (continua Resend).
-- 2. Uma tabela única de mensagens (inbound/outbound) por lead, no mesmo
--    padrão já usado em whatsapp_messages — permite reconstruir a conversa
--    inteira (email original + respostas + continuação manual) numa tela só.
-- 3. O status "pausado" em email_automation_enrollments: quando um lead
--    responde, a automação dele para de mandar os próximos passos da
--    sequência automaticamente (sem precisar cancelar/perder o progresso).
--
-- O "match" de qual email está sendo respondido usa o header Message-ID:
-- cada envio (campanha ou automação) passa a sair com um Message-ID próprio
-- (gerado por nós, não o id interno do Resend), e a resposta do lead chega
-- com esse mesmo id no header In-Reply-To/References — dá pra saber exatamente
-- qual envio (e portanto qual automação/step) gerou a resposta.

ALTER TABLE email_config ADD COLUMN IF NOT EXISTS imap_host TEXT;
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993;
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS imap_user TEXT;
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS imap_password TEXT;
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS caixa_respostas_email TEXT; -- vai no Reply-To de todo envio
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS imap_ultimo_sync_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS email_conversas_mensagens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  remetente_email     TEXT NOT NULL,
  destinatario_email  TEXT NOT NULL,
  assunto             TEXT,
  corpo_texto         TEXT,
  corpo_html          TEXT,
  message_id          TEXT,            -- Message-ID desta mensagem
  in_reply_to         TEXT,            -- Message-ID da mensagem anterior do thread
  resend_id           TEXT,            -- id do Resend, só quando direction = 'outbound'
  automation_envio_id UUID REFERENCES email_automation_envios(id) ON DELETE SET NULL,
  campaign_envio_id   UUID REFERENCES email_campaign_envios(id) ON DELETE SET NULL,
  lida_pelo_agente    BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_conversas_mensagens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all email_conversas_mensagens" ON email_conversas_mensagens FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_conversas_mensagens_lead ON email_conversas_mensagens(lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_email_conversas_mensagens_message_id ON email_conversas_mensagens(message_id);
CREATE INDEX IF NOT EXISTS idx_email_conversas_mensagens_in_reply_to ON email_conversas_mensagens(in_reply_to);

-- Resumo por lead (1 linha por conversa), mesmo padrão de whatsapp_conversas_resumo.
CREATE OR REPLACE VIEW email_conversas_resumo AS
SELECT
  last.lead_id,
  last.assunto              AS ultimo_assunto,
  COALESCE(last.corpo_texto, last.corpo_html) AS ultima_mensagem,
  last.direction             AS ultima_direcao,
  last.created_at            AS ultima_mensagem_em,
  COALESCE(unread.cnt, 0)    AS nao_lidas
FROM (
  SELECT DISTINCT ON (lead_id) *
  FROM email_conversas_mensagens
  ORDER BY lead_id, created_at DESC
) last
LEFT JOIN (
  SELECT lead_id, COUNT(*) AS cnt
  FROM email_conversas_mensagens
  WHERE direction = 'inbound' AND lida_pelo_agente = false
  GROUP BY lead_id
) unread ON unread.lead_id = last.lead_id;

-- "pausado": automação para de avançar pro lead que respondeu, sem perder o
-- progresso (diferente de "cancelado", que é definitivo). Não há CHECK
-- constraint em email_automation_enrollments.status, então só documentamos
-- o novo valor aqui; o worker (email-automation-tick) passa a tratá-lo como
-- "não processar" igual já faz com 'cancelado'.
COMMENT ON COLUMN email_automation_enrollments.status IS 'ativo | pausado | concluido | cancelado';

-- pg_cron/pg_net: chama email-imap-sync periodicamente, mesmo esquema do
-- email-automation-tick (secret lido em tempo de execução de email_config,
-- pra rotacionar sem reagendar o cron).
CREATE OR REPLACE FUNCTION email_imap_sync_call() RETURNS void AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT automation_secret INTO v_secret FROM email_config WHERE ativo = true LIMIT 1;
  IF v_secret IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://prilivwxekihepvdeass.supabase.co/functions/v1/email-imap-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-automation-secret', v_secret),
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'email-imap-sync';
SELECT cron.schedule('email-imap-sync', '*/3 * * * *', 'SELECT email_imap_sync_call();');

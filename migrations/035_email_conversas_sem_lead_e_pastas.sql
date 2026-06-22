-- =============================================
-- Migration 035: Conversas de email sem lead vinculado + pastas (Inbox/Spam)
-- =============================================
-- A 034 só guardava mensagem se conseguisse casar com um lead (resposta a um
-- envio nosso ou email já cadastrado). Quem nunca recebeu nada da gente e
-- manda o primeiro contato ficava de fora da Caixa de Entrada. Esta migration:
-- 1. Torna lead_id opcional e adiciona thread_key (chave de agrupamento da
--    conversa: o próprio lead_id quando existe, senão o email da outra ponta),
--    contato_email/contato_nome (identidade de quem não é lead).
-- 2. Adiciona "pasta" (inbox | spam), preenchida pelo email-imap-sync de
--    acordo com a caixa IMAP de onde a mensagem foi lida.
-- 3. Trigger preenche thread_key automaticamente no INSERT, então o código
--    de envio/recebimento não precisa calcular isso na mão.

ALTER TABLE email_conversas_mensagens ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE email_conversas_mensagens ADD COLUMN IF NOT EXISTS thread_key TEXT;
ALTER TABLE email_conversas_mensagens ADD COLUMN IF NOT EXISTS contato_email TEXT;
ALTER TABLE email_conversas_mensagens ADD COLUMN IF NOT EXISTS contato_nome TEXT;
ALTER TABLE email_conversas_mensagens ADD COLUMN IF NOT EXISTS pasta TEXT NOT NULL DEFAULT 'inbox' CHECK (pasta IN ('inbox', 'spam'));

CREATE OR REPLACE FUNCTION email_conversas_set_thread_key() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_key IS NULL THEN
    IF NEW.lead_id IS NOT NULL THEN
      NEW.thread_key := NEW.lead_id::text;
    ELSIF NEW.direction = 'inbound' THEN
      NEW.thread_key := lower(NEW.remetente_email);
    ELSE
      NEW.thread_key := lower(NEW.destinatario_email);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_conversas_thread_key ON email_conversas_mensagens;
CREATE TRIGGER trg_email_conversas_thread_key
  BEFORE INSERT ON email_conversas_mensagens
  FOR EACH ROW EXECUTE FUNCTION email_conversas_set_thread_key();

-- Backfill de linhas que já existirem (rodando a 034 antes desta em algum
-- ambiente que já tenha dados).
UPDATE email_conversas_mensagens SET thread_key = lead_id::text WHERE thread_key IS NULL AND lead_id IS NOT NULL;
UPDATE email_conversas_mensagens SET thread_key = lower(CASE WHEN direction = 'inbound' THEN remetente_email ELSE destinatario_email END)
  WHERE thread_key IS NULL;

ALTER TABLE email_conversas_mensagens ALTER COLUMN thread_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_conversas_mensagens_thread_key ON email_conversas_mensagens(thread_key, created_at);

-- Resumo por thread (lead ou contato avulso), agora com pasta e identidade
-- de quem não está cadastrado como lead.
CREATE OR REPLACE VIEW email_conversas_resumo AS
SELECT
  last.thread_key,
  last.lead_id,
  COALESCE(last.contato_email, CASE WHEN last.direction = 'inbound' THEN last.remetente_email ELSE last.destinatario_email END) AS contato_email,
  last.contato_nome,
  last.assunto              AS ultimo_assunto,
  COALESCE(last.corpo_texto, last.corpo_html) AS ultima_mensagem,
  last.direction             AS ultima_direcao,
  last.created_at            AS ultima_mensagem_em,
  last.pasta,
  COALESCE(unread.cnt, 0)    AS nao_lidas
FROM (
  SELECT DISTINCT ON (thread_key) *
  FROM email_conversas_mensagens
  ORDER BY thread_key, created_at DESC
) last
LEFT JOIN (
  SELECT thread_key, COUNT(*) AS cnt
  FROM email_conversas_mensagens
  WHERE direction = 'inbound' AND lida_pelo_agente = false
  GROUP BY thread_key
) unread ON unread.thread_key = last.thread_key;

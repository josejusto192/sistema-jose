-- =============================================
-- Migration 013: Caixa de Entrada — WhatsApp (API oficial / Cloud API)
-- =============================================
-- A tabela whatsapp_messages já existe (criada manualmente, hoje populada
-- pelo fluxo do n8n). Esta migration só:
--   1) garante RLS + policy (a tabela foi criada fora do padrão de migrations
--      e pode não ter RLS habilitado ainda — sem isso, o PostgREST exporia
--      os dados sem controle de acesso);
--   2) adiciona um índice para listar conversas/mensagens com performance;
--   3) adiciona a coluna lida_pelo_agente (default false), usada só pela
--      Caixa de Entrada para marcar mensagens já vistas — não interfere em
--      nada que o n8n já faz;
--   4) cria a view whatsapp_conversas_resumo (1 linha por conversa: última
--      mensagem + não lidas), usada para listar as conversas na UI;
--   5) cria whatsapp_config (não sensível — phone_number_id etc; o access
--      token e o verify token do webhook ficam só como secrets da Edge
--      Function, nunca em tabela).

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all whatsapp_messages" ON whatsapp_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS lida_pelo_agente BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session ON whatsapp_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wamid   ON whatsapp_messages(wamid);

-- 1 linha por conversa (session_id): última mensagem + contagem de não lidas.
-- Sem security_invoker pq a policy de whatsapp_messages já libera tudo para
-- authenticated — não há RLS mais restritiva sendo "furada" aqui.
CREATE OR REPLACE VIEW whatsapp_conversas_resumo AS
SELECT
  last.session_id,
  last.content      AS ultima_mensagem,
  last.direction     AS ultima_direcao,
  last.created_at    AS ultima_mensagem_em,
  last.message_type  AS ultimo_tipo,
  COALESCE(unread.cnt, 0) AS nao_lidas
FROM (
  SELECT DISTINCT ON (session_id) session_id, content, direction, created_at, message_type
  FROM whatsapp_messages
  ORDER BY session_id, created_at DESC
) last
LEFT JOIN (
  SELECT session_id, COUNT(*) AS cnt
  FROM whatsapp_messages
  WHERE direction = 'inbound' AND lida_pelo_agente = false
  GROUP BY session_id
) unread ON unread.session_id = last.session_id;

GRANT SELECT ON whatsapp_conversas_resumo TO authenticated;

CREATE TABLE IF NOT EXISTS whatsapp_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id       TEXT,
  business_account_id   TEXT,
  display_phone_number  TEXT,
  ativo                 BOOLEAN DEFAULT true,
  atualizado_em         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all whatsapp_config" ON whatsapp_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO whatsapp_config (phone_number_id, business_account_id, display_phone_number, ativo)
SELECT NULL, NULL, NULL, false
WHERE NOT EXISTS (SELECT 1 FROM whatsapp_config);

-- =============================================
-- Migration 018: Seleção explícita de destinatários nas campanhas de email
-- =============================================
-- O filtro só por tag mostrava pouquíssimos leads pq a maioria não tem tag
-- cadastrada — e o usuário não tinha como ver/confirmar quem receberia a
-- campanha antes de mandar. Agora a campanha guarda a lista exata de
-- lead_ids escolhidos na tela (com filtro de status/tag/busca + preview),
-- igual ao padrão de seleção já usado no Disparo de WhatsApp. segmento_tags
-- continua existindo só pra não quebrar campanhas antigas (a function dá
-- preferência a lead_ids quando presente).

ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS lead_ids UUID[];

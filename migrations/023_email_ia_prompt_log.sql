-- =============================================
-- Migration 023: Log detalhado do envio por IA
-- =============================================
-- Guarda o prompt exato enviado para a IA em cada envio, pra permitir
-- depurar erros (ex: chave inválida, resposta fora do formato esperado)
-- abrindo o detalhe de um lead específico na campanha.

ALTER TABLE email_campaign_envios ADD COLUMN IF NOT EXISTS prompt_ia TEXT;

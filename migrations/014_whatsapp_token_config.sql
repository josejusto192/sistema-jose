-- =============================================
-- Migration 014: Token do WhatsApp configurável pela tela (não só por secret)
-- =============================================
-- Guardar o access_token na própria tabela é o mesmo modelo já usado pra
-- chave do Gemini (justo-crm-config.json) e pelo briefing_template: tudo
-- que é "authenticated" já tem acesso total a essas tabelas (RLS atual do
-- sistema é por papel autenticado, não por linha). Facilita trocar o token
-- direto pela tela de Configurações, sem precisar de CLI/dashboard do
-- Supabase.

ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS access_token TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS verify_token TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS graph_version TEXT DEFAULT 'v25.0';

UPDATE whatsapp_config SET phone_number_id = '1196393716892084', ativo = true
WHERE phone_number_id IS NULL;

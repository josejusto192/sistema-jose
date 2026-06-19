-- =============================================
-- Migration 015: Habilita Realtime para whatsapp_messages
-- =============================================
-- A tabela whatsapp_messages foi criada fora do fluxo padrão do app (via SQL
-- direto, antes da integração com o CRM) e por isso nunca entrou na
-- publicação supabase_realtime — sem isso, o channel().on('postgres_changes')
-- da Caixa de Entrada nunca recebe eventos, e mensagens recebidas só aparecem
-- depois de recarregar a página.

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

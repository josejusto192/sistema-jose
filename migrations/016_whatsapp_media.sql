-- =============================================
-- Migration 016: Suporte a mídia (áudio, foto, vídeo, documento) no WhatsApp
-- =============================================
-- Mesmo padrão já usado em avatars/comprovantes: bucket público no Storage +
-- URL salva na tabela, em vez de base64 — evita inchar whatsapp_messages e
-- mantém o carregamento do chat rápido.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  true,
  16777216, -- 16 MB (limite da própria Cloud API pra mídia, exceto vídeo que é maior — suficiente pro nosso uso)
  ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/3gpp','audio/mpeg','audio/ogg','audio/aac','audio/amr','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Qualquer usuário autenticado pode enviar mídia pela Caixa de Entrada
-- (a function whatsapp-webhook usa a service role, que já ignora RLS).
DO $$ BEGIN
  CREATE POLICY "authenticated_upload_whatsapp_media" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'whatsapp-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "public_read_whatsapp_media" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'whatsapp-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS mime_type TEXT;

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
  ARRAY['image/*','video/*','audio/*','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Lista mais aberta que a inicial: o áudio gravado pelo navegador (MediaRecorder)
-- varia o mime conforme o browser (webm, mp4, ogg...), então restringir a
-- subtipos específicos rejeitava gravações válidas.
UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/*','video/*','audio/*','application/pdf']
WHERE id = 'whatsapp-media';

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

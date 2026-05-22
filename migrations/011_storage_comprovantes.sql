-- Migration 011: Bucket de storage para comprovantes de pagamento
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprovantes',
  'comprovantes',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Política: superadmin pode fazer upload/delete
CREATE POLICY "superadmin_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "superadmin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'comprovantes'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- Política: leitura pública (bucket já é público, mas policy garante)
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'comprovantes');

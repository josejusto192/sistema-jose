-- Add profile fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sobrenome TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS foto_url  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefone  TEXT;

-- Storage bucket for avatars (public, 5MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars auth upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars auth update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars auth delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

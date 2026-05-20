-- Fix: notifications realtime filter requires REPLICA IDENTITY FULL
-- Without this, ALL clients receive ALL notification inserts in realtime
-- (the column filter user_id=eq.<uid> is ignored by Supabase without FULL identity)
--
-- Run this in the Supabase SQL Editor

ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Ensure RLS is enabled with the correct policy (re-apply in case it was missing)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own notifications" ON notifications;

CREATE POLICY "users manage own notifications"
  ON notifications FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow the Edge Function (service role) to insert without RLS restriction
-- The service role bypasses RLS by default, so no extra policy needed.

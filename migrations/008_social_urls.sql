-- Migration 008: Add social/web URL columns to leads table
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url  TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url  TEXT,
  ADD COLUMN IF NOT EXISTS site_url      TEXT;

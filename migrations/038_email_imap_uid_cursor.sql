-- =============================================
-- Migration 038: IMAP confiavel por UID/UIDVALIDITY
-- =============================================
-- A flag \\Seen pertence ao cliente de email (Roundcube etc.) e nao pode ser
-- usada como cursor de integracao. O worker passa a manter seu proprio cursor
-- por pasta e uma identidade idempotente por mensagem.

ALTER TABLE email_config
  ADD COLUMN IF NOT EXISTS imap_ultimo_erro TEXT;
ALTER TABLE email_config
  ADD COLUMN IF NOT EXISTS imap_ultimo_resultado JSONB;

CREATE TABLE IF NOT EXISTS email_imap_cursors (
  email_config_id UUID NOT NULL REFERENCES email_config(id) ON DELETE CASCADE,
  account_fingerprint TEXT NOT NULL,
  mailbox_path TEXT NOT NULL,
  uid_validity BIGINT NOT NULL,
  last_uid BIGINT NOT NULL DEFAULT 0 CHECK (last_uid >= 0),
  last_success_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (email_config_id, account_fingerprint, mailbox_path)
);

CREATE TABLE IF NOT EXISTS email_imap_sync_locks (
  email_config_id UUID PRIMARY KEY REFERENCES email_config(id) ON DELETE CASCADE,
  lease_token UUID NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_imap_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_imap_sync_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_imap_cursors FROM PUBLIC, anon, authenticated;
REVOKE ALL ON email_imap_sync_locks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_imap_cursors TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_imap_sync_locks TO service_role;

ALTER TABLE email_conversas_mensagens
  ADD COLUMN IF NOT EXISTS imap_config_id UUID REFERENCES email_config(id) ON DELETE SET NULL;
ALTER TABLE email_conversas_mensagens
  ADD COLUMN IF NOT EXISTS imap_account_fingerprint TEXT;
ALTER TABLE email_conversas_mensagens
  ADD COLUMN IF NOT EXISTS imap_mailbox_path TEXT;
ALTER TABLE email_conversas_mensagens
  ADD COLUMN IF NOT EXISTS imap_uid_validity BIGINT;
ALTER TABLE email_conversas_mensagens
  ADD COLUMN IF NOT EXISTS imap_uid BIGINT;
ALTER TABLE email_conversas_mensagens
  ADD COLUMN IF NOT EXISTS imap_source_sha256 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_imap_message_uid
  ON email_conversas_mensagens(imap_config_id, imap_account_fingerprint, imap_mailbox_path, imap_uid_validity, imap_uid)
  WHERE direction = 'inbound'
    AND imap_config_id IS NOT NULL
    AND imap_account_fingerprint IS NOT NULL
    AND imap_mailbox_path IS NOT NULL
    AND imap_uid_validity IS NOT NULL
    AND imap_uid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_imap_message_source_hash
  ON email_conversas_mensagens(imap_config_id, imap_account_fingerprint, imap_source_sha256)
  WHERE direction = 'inbound'
    AND imap_config_id IS NOT NULL
    AND imap_account_fingerprint IS NOT NULL
    AND imap_source_sha256 IS NOT NULL;

-- Mensagens recebidas sao gravadas exclusivamente pela Edge Function. O
-- navegador pode consultar a caixa e marcar como lida, mas nao forjar nem
-- apagar uma identidade IMAP para fazer o worker pular um email verdadeiro.
DROP POLICY IF EXISTS "auth all email_conversas_mensagens" ON email_conversas_mensagens;
DROP POLICY IF EXISTS "authenticated read email conversations" ON email_conversas_mensagens;
DROP POLICY IF EXISTS "authenticated mark email conversations read" ON email_conversas_mensagens;
REVOKE ALL ON email_conversas_mensagens FROM anon, authenticated;
GRANT SELECT ON email_conversas_mensagens TO authenticated;
GRANT UPDATE (lida_pelo_agente) ON email_conversas_mensagens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_conversas_mensagens TO service_role;

CREATE POLICY "authenticated read email conversations"
  ON email_conversas_mensagens
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated mark email conversations read"
  ON email_conversas_mensagens
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER VIEW email_conversas_resumo SET (security_invoker = true);
GRANT SELECT ON email_conversas_resumo TO authenticated;

-- Impede que dois ciclos do cron processem a mesma caixa simultaneamente.
CREATE OR REPLACE FUNCTION public.fn_claim_email_imap_sync(
  p_email_config_id UUID,
  p_lease_token UUID,
  p_ttl_seconds INTEGER DEFAULT 600
) RETURNS BOOLEAN AS $$
DECLARE
  v_claimed BOOLEAN;
  v_ttl INTEGER := LEAST(GREATEST(COALESCE(p_ttl_seconds, 600), 30), 900);
BEGIN
  INSERT INTO public.email_imap_sync_locks AS current_lock (
    email_config_id,
    lease_token,
    lease_expires_at,
    updated_at
  ) VALUES (
    p_email_config_id,
    p_lease_token,
    pg_catalog.now() + pg_catalog.make_interval(secs => v_ttl),
    pg_catalog.now()
  )
  ON CONFLICT (email_config_id) DO UPDATE
     SET lease_token = EXCLUDED.lease_token,
         lease_expires_at = EXCLUDED.lease_expires_at,
         updated_at = pg_catalog.now()
   WHERE current_lock.lease_expires_at <= pg_catalog.now()
      OR current_lock.lease_token = EXCLUDED.lease_token
  RETURNING TRUE INTO v_claimed;

  RETURN COALESCE(v_claimed, FALSE);
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';

CREATE OR REPLACE FUNCTION public.fn_commit_email_imap_cursor(
  p_email_config_id UUID,
  p_lease_token UUID,
  p_account_fingerprint TEXT,
  p_mailbox_path TEXT,
  p_uid_validity BIGINT,
  p_last_uid BIGINT
) RETURNS BIGINT AS $$
DECLARE
  v_last_uid BIGINT;
  v_lease_expires_at TIMESTAMPTZ;
BEGIN
  IF p_last_uid < 0
     OR p_uid_validity <= 0
     OR NULLIF(BTRIM(p_account_fingerprint), '') IS NULL
     OR NULLIF(BTRIM(p_mailbox_path), '') IS NULL THEN
    RAISE EXCEPTION 'Cursor IMAP invalido.' USING ERRCODE = '22023';
  END IF;

  -- O row lock transforma a validacao do token e o commit em uma unica
  -- operacao cercada; um novo claim nao pode trocar o owner no meio dela.
  SELECT sync_lock.lease_expires_at
    INTO v_lease_expires_at
    FROM public.email_imap_sync_locks AS sync_lock
   WHERE sync_lock.email_config_id = p_email_config_id
     AND sync_lock.lease_token = p_lease_token
   FOR UPDATE;

  IF v_lease_expires_at IS NULL OR v_lease_expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'Lease da sincronizacao IMAP expirou.' USING ERRCODE = '55000';
  END IF;

  UPDATE public.email_imap_sync_locks
     SET lease_expires_at = pg_catalog.now() + INTERVAL '10 minutes',
         updated_at = pg_catalog.now()
   WHERE email_config_id = p_email_config_id
     AND lease_token = p_lease_token;

  INSERT INTO public.email_imap_cursors AS current_cursor (
    email_config_id,
    account_fingerprint,
    mailbox_path,
    uid_validity,
    last_uid,
    last_success_at,
    updated_at
  ) VALUES (
    p_email_config_id,
    p_account_fingerprint,
    p_mailbox_path,
    p_uid_validity,
    p_last_uid,
    pg_catalog.now(),
    pg_catalog.now()
  )
  ON CONFLICT (email_config_id, account_fingerprint, mailbox_path) DO UPDATE
     SET uid_validity = EXCLUDED.uid_validity,
         last_uid = CASE
           WHEN current_cursor.uid_validity = EXCLUDED.uid_validity
             THEN GREATEST(current_cursor.last_uid, EXCLUDED.last_uid)
           ELSE EXCLUDED.last_uid
         END,
         last_success_at = pg_catalog.now(),
         updated_at = pg_catalog.now()
  RETURNING last_uid INTO v_last_uid;

  RETURN v_last_uid;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';

CREATE OR REPLACE FUNCTION public.fn_release_email_imap_sync(
  p_email_config_id UUID,
  p_lease_token UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE public.email_imap_sync_locks
     SET lease_expires_at = pg_catalog.now(),
         updated_at = pg_catalog.now()
   WHERE email_config_id = p_email_config_id
     AND lease_token = p_lease_token;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';

REVOKE ALL ON FUNCTION public.fn_claim_email_imap_sync(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_commit_email_imap_cursor(UUID, UUID, TEXT, TEXT, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_release_email_imap_sync(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_email_imap_sync(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_commit_email_imap_cursor(UUID, UUID, TEXT, TEXT, BIGINT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_release_email_imap_sync(UUID, UUID) TO service_role;

COMMENT ON TABLE email_imap_cursors IS
  'Cursor proprio do CRM por pasta IMAP; independe da flag de lida do servidor.';
COMMENT ON COLUMN email_conversas_mensagens.imap_uid IS
  'UID da mensagem dentro da combinacao pasta + UIDVALIDITY.';
COMMENT ON COLUMN email_conversas_mensagens.imap_source_sha256 IS
  'Hash do RFC822 bruto para idempotencia em movimentos de pasta e resets de UIDVALIDITY.';

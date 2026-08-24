-- =============================================
-- Migration 037: Confiabilidade e observabilidade das campanhas de email
-- =============================================
-- Cada solicitação do worker passa a ter um run persistido. Isso torna
-- visíveis falhas que acontecem antes de um envio individual ser processado
-- (cron, pg_net, autenticação, configuração e consultas do worker).

CREATE TABLE IF NOT EXISTS email_automation_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id       UUID REFERENCES email_automations(id) ON DELETE SET NULL,
  "trigger"           TEXT NOT NULL DEFAULT 'manual',
  status              TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'running', 'success', 'partial', 'failed', 'skipped')),
  requested_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  queued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  processados         INTEGER NOT NULL DEFAULT 0,
  enviados            INTEGER NOT NULL DEFAULT 0,
  falhas              INTEGER NOT NULL DEFAULT 0,
  cancelados          INTEGER NOT NULL DEFAULT 0,
  ignorados           INTEGER NOT NULL DEFAULT 0,
  pg_net_request_id   BIGINT,
  error_code          TEXT,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_automation_runs_automation_created
  ON email_automation_runs(automation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_automation_runs_status_created
  ON email_automation_runs(status, created_at DESC);

ALTER TABLE email_automation_runs ENABLE ROW LEVEL SECURITY;

-- Evita consultar profiles diretamente dentro da policy (o que herdaria as
-- próprias policies recursivas de profiles). A função só responde sobre o
-- usuário autenticado da sessão atual.
CREATE OR REPLACE FUNCTION public.fn_is_active_superadmin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles AS p
     WHERE p.id = auth.uid()
       AND p.role = 'superadmin'
       AND p.ativo = true
  );
$$ LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = '';

REVOKE ALL ON FUNCTION public.fn_is_active_superadmin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_is_active_superadmin() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_is_active_superadmin() TO authenticated;

DROP POLICY IF EXISTS "authenticated read email automation runs" ON email_automation_runs;
CREATE POLICY "authenticated read email automation runs"
  ON email_automation_runs
  FOR SELECT
  TO authenticated
  USING (public.fn_is_active_superadmin());

GRANT SELECT ON email_automation_runs TO authenticated;

ALTER TABLE email_automation_envios
  ADD COLUMN IF NOT EXISTS tentativas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_automation_envios
  ADD COLUMN IF NOT EXISTS ultima_tentativa_em TIMESTAMPTZ;
ALTER TABLE email_automation_envios
  ADD COLUMN IF NOT EXISTS processando_em TIMESTAMPTZ;
ALTER TABLE email_automation_envios
  ADD COLUMN IF NOT EXISTS provider_scheduled_at TIMESTAMPTZ;
ALTER TABLE email_automation_envios
  ADD COLUMN IF NOT EXISTS provider_payload JSONB;
ALTER TABLE email_automation_envios
  ADD COLUMN IF NOT EXISTS provider_idempotency_key TEXT;

-- Reserva no máximo p_limit envios em uma única transação. SKIP LOCKED evita
-- que duas execuções concorrentes trabalhem no mesmo registro; o lease de 15
-- minutos recupera itens abandonados caso uma Edge Function seja interrompida.
CREATE OR REPLACE FUNCTION public.fn_claim_email_automation_envios(
  p_automation_ids UUID[],
  p_limit INTEGER DEFAULT 15,
  p_min_scheduled_for TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF public.email_automation_envios AS $$
  WITH candidates AS (
    SELECT e.id
      FROM public.email_automation_envios AS e
      JOIN public.email_automation_enrollments AS enrollment
        ON enrollment.id = e.enrollment_id
       AND enrollment.status <> 'pausado'
     WHERE e.automation_id = ANY(p_automation_ids)
       AND e.scheduled_for <= pg_catalog.now()
       AND (p_min_scheduled_for IS NULL OR e.scheduled_for >= p_min_scheduled_for)
       AND (
         e.status = 'pendente'
         OR (
           e.status = 'processando'
           AND e.processando_em <= pg_catalog.now() - INTERVAL '15 minutes'
         )
       )
     ORDER BY e.scheduled_for ASC
     FOR UPDATE SKIP LOCKED
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 15), 1), 100)
  )
  UPDATE public.email_automation_envios AS e
     SET status = 'processando',
         processando_em = pg_catalog.now(),
         tentativas = e.tentativas + 1,
         ultima_tentativa_em = pg_catalog.now()
    FROM candidates AS c
   WHERE e.id = c.id
  RETURNING e.*;
$$ LANGUAGE sql
SECURITY DEFINER
SET search_path = '';

REVOKE ALL ON FUNCTION public.fn_claim_email_automation_envios(UUID[], INTEGER, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_claim_email_automation_envios(UUID[], INTEGER, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.fn_claim_email_automation_envios(UUID[], INTEGER, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_email_automation_envios(UUID[], INTEGER, TIMESTAMPTZ) TO service_role;

-- Enfileira uma execução assíncrona no pg_net. A Edge Function continua
-- validando o segredo próprio; verify_jwt=false apenas permite que a chamada
-- servidor-a-servidor atravesse o gateway do Supabase.
CREATE OR REPLACE FUNCTION public.fn_request_email_automation_tick(
  p_automation_id UUID DEFAULT NULL,
  p_trigger TEXT DEFAULT 'manual'
) RETURNS UUID AS $$
DECLARE
  v_run_id UUID;
  v_secret TEXT;
  v_request_id BIGINT;
  v_trigger TEXT := LEFT(COALESCE(NULLIF(BTRIM(p_trigger), ''), 'manual'), 64);
  v_requester UUID := auth.uid();
  v_auth_role TEXT := auth.role();
BEGIN
  -- Chamadas humanas só podem partir de um superadmin ativo. O pg_cron roda
  -- como usuário interno do Postgres, sem JWT/auth.uid(), através do wrapper
  -- privado email_automation_tick_call().
  IF v_requester IS NULL THEN
    IF v_auth_role IS DISTINCT FROM 'service_role'
       AND session_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Somente o worker interno pode solicitar uma execução sem usuário.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1
      FROM public.profiles AS p
     WHERE p.id = v_requester
       AND p.role = 'superadmin'
       AND p.ativo = true
  ) THEN
    RAISE EXCEPTION 'Somente um superadmin ativo pode iniciar campanhas de email.'
      USING ERRCODE = '42501';
  END IF;

  -- Uma resposta 401/404/timeout do pg_net não chega ao handler da Edge
  -- Function. A próxima solicitação encerra runs abandonados para que eles
  -- não permaneçam em queued/running indefinidamente.
  UPDATE public.email_automation_runs
     SET status = 'failed',
         finished_at = pg_catalog.now(),
         updated_at = pg_catalog.now(),
         error_code = 'WORKER_RESPONSE_TIMEOUT',
         error_message = 'O worker não confirmou a execução dentro de 15 minutos. Verifique pg_net e o deploy da Edge Function.'
   WHERE status IN ('queued', 'running')
     AND finished_at IS NULL
     AND COALESCE(started_at, queued_at) <= pg_catalog.now() - INTERVAL '15 minutes';

  INSERT INTO public.email_automation_runs (
    automation_id,
    "trigger",
    status,
    requested_by
  ) VALUES (
    p_automation_id,
    v_trigger,
    'queued',
    v_requester
  )
  RETURNING id INTO v_run_id;

  SELECT automation_secret
    INTO v_secret
    FROM public.email_config
   WHERE ativo = true
   ORDER BY atualizado_em DESC NULLS LAST
   LIMIT 1;

  IF v_secret IS NULL OR BTRIM(v_secret) = '' THEN
    UPDATE public.email_automation_runs
       SET status = 'failed',
           finished_at = pg_catalog.now(),
           updated_at = pg_catalog.now(),
           error_code = 'AUTOMATION_SECRET_MISSING',
           error_message = 'Ative e salve a configuração de email para gerar o segredo do worker.'
     WHERE id = v_run_id;
    RETURN v_run_id;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := 'https://prilivwxekihepvdeass.supabase.co/functions/v1/email-automation-tick',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-automation-secret', v_secret
      ),
      body := jsonb_build_object(
        'run_id', v_run_id,
        'automation_id', p_automation_id,
        'trigger', v_trigger
      ),
      timeout_milliseconds := 120000
    ) INTO v_request_id;

    UPDATE public.email_automation_runs
       SET pg_net_request_id = v_request_id,
           updated_at = pg_catalog.now()
     WHERE id = v_run_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.email_automation_runs
       SET status = 'failed',
           finished_at = pg_catalog.now(),
           updated_at = pg_catalog.now(),
           error_code = 'PG_NET_REQUEST_FAILED',
           error_message = LEFT(SQLERRM, 2000)
     WHERE id = v_run_id;
  END;

  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';

REVOKE ALL ON FUNCTION public.fn_request_email_automation_tick(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_request_email_automation_tick(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_request_email_automation_tick(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_request_email_automation_tick(UUID, TEXT) TO service_role;

-- Mantém o contrato usado pelo pg_cron, agora registrando cada chamada.
CREATE OR REPLACE FUNCTION public.email_automation_tick_call() RETURNS void AS $$
BEGIN
  -- Evita criar centenas de runs vazios por dia e, principalmente, impede
  -- que a recuperação do worker despeje automaticamente filas muito antigas.
  IF EXISTS (
    SELECT 1
      FROM public.email_automation_envios AS e
      JOIN public.email_automations AS a
        ON a.id = e.automation_id
       AND a.ativo = true
      JOIN public.email_automation_enrollments AS enrollment
        ON enrollment.id = e.enrollment_id
       AND enrollment.status <> 'pausado'
     WHERE e.scheduled_for <= pg_catalog.now()
       AND e.scheduled_for >= pg_catalog.now() - INTERVAL '24 hours'
       AND (
         e.status = 'pendente'
         OR (
           e.status = 'processando'
           AND e.processando_em <= pg_catalog.now() - INTERVAL '15 minutes'
         )
       )
  ) THEN
    PERFORM public.fn_request_email_automation_tick(NULL, 'cron');
  END IF;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '';

-- O wrapper é exclusivo do pg_cron (executado pelo usuário interno do
-- Postgres). Usuários do app devem passar pela RPC acima, que registra autor,
-- campanha e origem da solicitação.
REVOKE ALL ON FUNCTION public.email_automation_tick_call() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_automation_tick_call() FROM anon;
REVOKE ALL ON FUNCTION public.email_automation_tick_call() FROM authenticated;

COMMENT ON TABLE email_automation_runs IS
  'Execuções solicitadas do worker de campanhas de email, incluindo falhas antes do envio individual.';
COMMENT ON COLUMN email_automation_runs."trigger" IS
  'Origem da execução, por exemplo cron, manual, iniciar_agora ou retry.';
COMMENT ON COLUMN email_automation_envios.tentativas IS
  'Quantidade de vezes que o worker iniciou uma tentativa de processamento deste envio.';
COMMENT ON COLUMN email_automation_envios.processando_em IS
  'Início do lease atômico do worker; leases com mais de 15 minutos podem ser retomados.';
COMMENT ON COLUMN email_automation_envios.provider_scheduled_at IS
  'Horário estável enviado ao Resend, preservado para retries idempotentes do mesmo envio.';
COMMENT ON COLUMN email_automation_envios.provider_payload IS
  'Payload exato enviado ao Resend, preservado para repetir com segurança uma resposta ambígua.';
COMMENT ON COLUMN email_automation_envios.provider_idempotency_key IS
  'Chave de idempotência do provedor; só é renovada depois de uma falha explicitamente rejeitada.';

-- =============================================
-- Migration 024: Automação de email (sequências por gatilho)
-- =============================================
-- Permite criar fluxos automáticos: quando um lead novo bate com o filtro
-- (origem/tags) de uma automação ativa, ele é matriculado e passa a receber
-- uma sequência de emails (template ou IA) espaçados por dias, sem precisar
-- de seleção manual. A campanha manual (email_campaigns) continua existindo
-- em paralelo, sem nenhuma mudança de comportamento.
--
-- Disparo: trigger no INSERT de leads cria a matrícula + os envios futuros
-- já calculados (scheduled_for). Um "tick" periódico (pg_cron, a cada
-- 10 minutos) chama a Edge Function email-automation-tick, que processa só
-- os envios cujo scheduled_for já passou — não precisamos de precisão de
-- segundos, então isso evita ter que manter um worker/queue dedicado.

CREATE TABLE IF NOT EXISTS email_automations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  origem_filtro   TEXT[],  -- null/vazio = qualquer origem
  segmento_tags   TEXT[],  -- null/vazio = qualquer tag (sem exigir tag)
  criado_por      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_automations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all email_automations" ON email_automations FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Cada automação tem N passos em ordem; atraso_dias é relativo ao passo
-- anterior (ou à matrícula, no caso do passo 1). usar_ia decide se
-- assunto/corpo_html (template) ou ia_objetivo (gerado por IA) é usado.
CREATE TABLE IF NOT EXISTS email_automation_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
  ordem         INTEGER NOT NULL,
  atraso_dias   INTEGER NOT NULL DEFAULT 0,
  usar_ia       BOOLEAN NOT NULL DEFAULT false,
  assunto       TEXT,
  corpo_html    TEXT,
  ia_objetivo   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_automation_steps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all email_automation_steps" ON email_automation_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_automation_steps_automation ON email_automation_steps(automation_id, ordem);

-- Um lead só é matriculado uma vez por automação (mesmo que seja
-- atualizado/reinserido depois).
CREATE TABLE IF NOT EXISTS email_automation_enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'ativo', -- ativo | concluido | cancelado
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (automation_id, lead_id)
);

ALTER TABLE email_automation_enrollments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all email_automation_enrollments" ON email_automation_enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS email_automation_envios (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id  UUID NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
  step_id        UUID NOT NULL REFERENCES email_automation_steps(id) ON DELETE CASCADE,
  enrollment_id  UUID NOT NULL REFERENCES email_automation_enrollments(id) ON DELETE CASCADE,
  lead_id        UUID REFERENCES leads(id) ON DELETE SET NULL,
  email          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pendente', -- pendente | enviado | falhou | cancelado
  scheduled_for  TIMESTAMPTZ NOT NULL,
  enviado_em     TIMESTAMPTZ,
  erro           TEXT,
  resend_id      TEXT,
  assunto_gerado TEXT,
  corpo_gerado   TEXT,
  prompt_ia      TEXT,
  aberto_em      TIMESTAMPTZ,
  clicado_em     TIMESTAMPTZ,
  descadastrado_em TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_automation_envios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all email_automation_envios" ON email_automation_envios FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_automation_envios_due ON email_automation_envios(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_automation_envios_enrollment ON email_automation_envios(enrollment_id);

-- Matricula o lead recém-criado em toda automação ativa cujo filtro bate
-- (origem_filtro/segmento_tags nulos ou vazios = "qualquer"), e já cria os
-- envios futuros de cada passo com scheduled_for calculado.
CREATE OR REPLACE FUNCTION fn_enroll_lead_in_automations() RETURNS TRIGGER AS $$
DECLARE
  automation RECORD;
  step RECORD;
  v_enrollment_id UUID;
  v_acumulado_dias INTEGER;
  v_enrolled_at TIMESTAMPTZ;
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' OR COALESCE(NEW.email_opt_out, false) THEN
    RETURN NEW;
  END IF;

  FOR automation IN
    SELECT * FROM email_automations
    WHERE ativo = true
      AND (origem_filtro IS NULL OR array_length(origem_filtro, 1) IS NULL OR NEW.origem = ANY(origem_filtro))
      AND (segmento_tags IS NULL OR array_length(segmento_tags, 1) IS NULL OR NEW.tags && segmento_tags)
  LOOP
    INSERT INTO email_automation_enrollments (automation_id, lead_id)
    VALUES (automation.id, NEW.id)
    ON CONFLICT (automation_id, lead_id) DO NOTHING
    RETURNING id, enrolled_at INTO v_enrollment_id, v_enrolled_at;

    IF v_enrollment_id IS NULL THEN
      CONTINUE; -- já matriculado antes
    END IF;

    v_acumulado_dias := 0;
    FOR step IN
      SELECT * FROM email_automation_steps WHERE automation_id = automation.id ORDER BY ordem ASC
    LOOP
      v_acumulado_dias := v_acumulado_dias + step.atraso_dias;
      INSERT INTO email_automation_envios (automation_id, step_id, enrollment_id, lead_id, email, scheduled_for)
      VALUES (automation.id, step.id, v_enrollment_id, NEW.id, NEW.email, v_enrolled_at + (v_acumulado_dias || ' days')::INTERVAL);
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enroll_lead_in_automations ON leads;
CREATE TRIGGER trg_enroll_lead_in_automations
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_enroll_lead_in_automations();

-- Segredo usado pela Edge Function email-automation-tick para autenticar a
-- chamada feita pelo pg_cron (sem precisar de um JWT de usuário).
ALTER TABLE email_config ADD COLUMN IF NOT EXISTS automation_secret TEXT;
UPDATE email_config SET automation_secret = encode(gen_random_bytes(24), 'hex') WHERE automation_secret IS NULL;

-- pg_cron/pg_net: chama a Edge Function a cada 10 minutos. A função wrapper
-- lê a URL/secret em tempo de execução (de email_config), então rotacionar
-- o secret não exige reagendar o cron.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION email_automation_tick_call() RETURNS void AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT automation_secret INTO v_secret FROM email_config WHERE ativo = true LIMIT 1;
  IF v_secret IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://prilivwxekihepvdeass.supabase.co/functions/v1/email-automation-tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-automation-secret', v_secret),
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'email-automation-tick';
SELECT cron.schedule('email-automation-tick', '*/10 * * * *', 'SELECT email_automation_tick_call();');

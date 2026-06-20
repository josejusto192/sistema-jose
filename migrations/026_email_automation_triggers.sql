-- =============================================
-- Migration 026: Gatilhos múltiplos + saída automática das automações
-- =============================================
-- Até aqui a automação só matriculava o lead no momento da criação. Agora:
--
-- 1) Uma automação pode ter VÁRIOS gatilhos (qualquer um deles matricula o
--    lead — é um "OU"): lead criado, status mudou para X, tag adicionada,
--    tag removida. Os filtros (origem_filtro/segmento_tags/cnae_filtro)
--    continuam sendo um "E" aplicado por cima de qualquer gatilho — agora
--    sem sobrecarregar segmento_tags como gatilho ao mesmo tempo (o valor
--    da tag-gatilho fica em email_automation_triggers.valor).
--
-- 2) Saída automática: se parar_se_perdido = true (padrão), quando o status
--    do lead mudar para 'perdido' os envios pendentes de QUALQUER automação
--    em que ele esteja matriculado são cancelados — evita continuar
--    mandando a sequência pra quem já disse não.
--
-- Um lead só é matriculado uma vez por automação (UNIQUE em
-- email_automation_enrollments), então mesmo que vários gatilhos da mesma
-- automação disparem pro mesmo lead, não duplica a sequência.

CREATE TABLE IF NOT EXISTS email_automation_triggers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL, -- lead_criado | status_mudou | tag_adicionada | tag_removida
  valor         TEXT,          -- status (status_mudou) ou tag (tag_adicionada/tag_removida); null pra lead_criado
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_automation_triggers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth all email_automation_triggers" ON email_automation_triggers FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_automation_triggers_automation ON email_automation_triggers(automation_id);

ALTER TABLE email_automations ADD COLUMN IF NOT EXISTS parar_se_perdido BOOLEAN NOT NULL DEFAULT true;

-- Automações já existentes (migration 024/025) tinham um gatilho implícito
-- "lead_criado" — preserva esse comportamento criando a linha equivalente.
INSERT INTO email_automation_triggers (automation_id, tipo, valor)
SELECT id, 'lead_criado', NULL FROM email_automations
WHERE NOT EXISTS (SELECT 1 FROM email_automation_triggers t WHERE t.automation_id = email_automations.id);

ALTER TABLE email_automations DROP COLUMN IF EXISTS gatilho;
ALTER TABLE email_automations DROP COLUMN IF EXISTS gatilho_status;

-- Cria a matrícula (se ainda não existir) + os envios futuros de cada passo.
CREATE OR REPLACE FUNCTION fn_matricular_lead_automacao(p_automation_id UUID, p_lead_id UUID, p_email TEXT) RETURNS void AS $$
DECLARE
  step RECORD;
  v_enrollment_id UUID;
  v_enrolled_at TIMESTAMPTZ;
  v_acumulado_dias INTEGER;
BEGIN
  INSERT INTO email_automation_enrollments (automation_id, lead_id)
  VALUES (p_automation_id, p_lead_id)
  ON CONFLICT (automation_id, lead_id) DO NOTHING
  RETURNING id, enrolled_at INTO v_enrollment_id, v_enrolled_at;

  IF v_enrollment_id IS NULL THEN
    RETURN; -- já matriculado antes (por esse ou outro gatilho da mesma automação)
  END IF;

  v_acumulado_dias := 0;
  FOR step IN
    SELECT * FROM email_automation_steps WHERE automation_id = p_automation_id ORDER BY ordem ASC
  LOOP
    v_acumulado_dias := v_acumulado_dias + step.atraso_dias;
    INSERT INTO email_automation_envios (automation_id, step_id, enrollment_id, lead_id, email, scheduled_for)
    VALUES (p_automation_id, step.id, v_enrollment_id, p_lead_id, p_email, v_enrolled_at + (v_acumulado_dias || ' days')::INTERVAL);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Verifica se o lead bate com os filtros opcionais (origem/tags/cnae) de
-- uma automação — usado pelos dois triggers abaixo.
CREATE OR REPLACE FUNCTION fn_lead_bate_filtro_automacao(p_automation email_automations, p_lead leads) RETURNS BOOLEAN AS $$
BEGIN
  RETURN (p_automation.origem_filtro IS NULL OR array_length(p_automation.origem_filtro, 1) IS NULL OR p_lead.origem = ANY(p_automation.origem_filtro))
     AND (p_automation.segmento_tags IS NULL OR array_length(p_automation.segmento_tags, 1) IS NULL OR p_lead.tags && p_automation.segmento_tags)
     AND (p_automation.cnae_filtro IS NULL OR array_length(p_automation.cnae_filtro, 1) IS NULL OR p_lead.cnae_principal_descricao = ANY(p_automation.cnae_filtro));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_enroll_lead_in_automations() RETURNS TRIGGER AS $$
DECLARE
  automation RECORD;
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' OR COALESCE(NEW.email_opt_out, false) THEN
    RETURN NEW;
  END IF;

  FOR automation IN
    SELECT DISTINCT a.* FROM email_automations a
    JOIN email_automation_triggers t ON t.automation_id = a.id AND t.tipo = 'lead_criado'
    WHERE a.ativo = true
  LOOP
    IF fn_lead_bate_filtro_automacao(automation, NEW) THEN
      PERFORM fn_matricular_lead_automacao(automation.id, NEW.id, NEW.email);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gatilhos de UPDATE: status mudou para um valor específico, tag-gatilho
-- adicionada ou removida (comparando NEW.tags com OLD.tags) + saída
-- automática quando o status vira 'perdido'.
CREATE OR REPLACE FUNCTION fn_enroll_lead_on_lead_update() RETURNS TRIGGER AS $$
DECLARE
  automation RECORD;
BEGIN
  IF NEW.status_prospeccao IS DISTINCT FROM OLD.status_prospeccao AND NEW.status_prospeccao = 'perdido' THEN
    UPDATE email_automation_envios e
    SET status = 'cancelado'
    WHERE e.lead_id = NEW.id
      AND e.status = 'pendente'
      AND EXISTS (SELECT 1 FROM email_automations a WHERE a.id = e.automation_id AND a.parar_se_perdido = true);
    UPDATE email_automation_enrollments en
    SET status = 'cancelado'
    WHERE en.lead_id = NEW.id
      AND en.status = 'ativo'
      AND EXISTS (SELECT 1 FROM email_automations a WHERE a.id = en.automation_id AND a.parar_se_perdido = true);
  END IF;

  IF NEW.email IS NULL OR NEW.email = '' OR COALESCE(NEW.email_opt_out, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.status_prospeccao IS DISTINCT FROM OLD.status_prospeccao THEN
    FOR automation IN
      SELECT DISTINCT a.* FROM email_automations a
      JOIN email_automation_triggers t ON t.automation_id = a.id AND t.tipo = 'status_mudou' AND t.valor = NEW.status_prospeccao
      WHERE a.ativo = true
    LOOP
      IF fn_lead_bate_filtro_automacao(automation, NEW) THEN
        PERFORM fn_matricular_lead_automacao(automation.id, NEW.id, NEW.email);
      END IF;
    END LOOP;
  END IF;

  IF NEW.tags IS DISTINCT FROM OLD.tags THEN
    FOR automation IN
      SELECT DISTINCT a.* FROM email_automations a
      JOIN email_automation_triggers t ON t.automation_id = a.id AND t.tipo = 'tag_adicionada'
        AND t.valor = ANY(NEW.tags) AND NOT (t.valor = ANY(COALESCE(OLD.tags, '{}')))
      WHERE a.ativo = true
    LOOP
      IF fn_lead_bate_filtro_automacao(automation, NEW) THEN
        PERFORM fn_matricular_lead_automacao(automation.id, NEW.id, NEW.email);
      END IF;
    END LOOP;

    FOR automation IN
      SELECT DISTINCT a.* FROM email_automations a
      JOIN email_automation_triggers t ON t.automation_id = a.id AND t.tipo = 'tag_removida'
        AND t.valor = ANY(COALESCE(OLD.tags, '{}')) AND NOT (t.valor = ANY(COALESCE(NEW.tags, '{}')))
      WHERE a.ativo = true
    LOOP
      IF fn_lead_bate_filtro_automacao(automation, NEW) THEN
        PERFORM fn_matricular_lead_automacao(automation.id, NEW.id, NEW.email);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enroll_lead_on_lead_update ON leads;
CREATE TRIGGER trg_enroll_lead_on_lead_update
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_enroll_lead_on_lead_update();

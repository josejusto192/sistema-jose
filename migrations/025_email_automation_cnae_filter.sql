-- =============================================
-- Migration 025: Filtro por segmento (CNAE) nas automações de email
-- =============================================
-- Mesma lógica de "Segmento" já usada no filtro de Leads e na seleção de
-- destinatários das campanhas manuais: filtra pela descrição do CNAE
-- principal do lead. Vazio/null continua significando "qualquer segmento".

ALTER TABLE email_automations ADD COLUMN IF NOT EXISTS cnae_filtro TEXT[];

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
      AND (cnae_filtro IS NULL OR array_length(cnae_filtro, 1) IS NULL OR NEW.cnae_principal_descricao = ANY(cnae_filtro))
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

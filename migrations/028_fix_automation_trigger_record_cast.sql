-- =============================================
-- Migration 028: Corrige erro "cannot cast type record to email_automations"
-- =============================================
-- As funções de trigger da migration 026 (fn_enroll_lead_in_automations e
-- fn_enroll_lead_on_lead_update) declaravam a variável do FOR loop como
-- RECORD genérico e passavam ela direto pra fn_lead_bate_filtro_automacao,
-- que espera um email_automations. Com SELECT DISTINCT a.* + JOIN, o
-- Postgres monta a tupla sem os metadados de tipo necessários pro cast
-- implícito RECORD -> email_automations, e o UPDATE/INSERT em leads
-- quebrava com "ERROR: cannot cast type record to email_automations"
-- sempre que o lead batia em algum gatilho configurado (ex: tag_adicionada)
-- — foi isso que fazia uma tag "desaparecer": o UPDATE inteiro falhava.
--
-- Basta declarar a variável com o tipo da tabela (email_automations) em
-- vez de RECORD — o Postgres preserva o tipo corretamente nesse caso.

CREATE OR REPLACE FUNCTION fn_enroll_lead_in_automations() RETURNS TRIGGER AS $$
DECLARE
  automation email_automations;
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

CREATE OR REPLACE FUNCTION fn_enroll_lead_on_lead_update() RETURNS TRIGGER AS $$
DECLARE
  automation email_automations;
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

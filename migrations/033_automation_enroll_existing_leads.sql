-- =============================================
-- Migration 033: Matricular leads existentes manualmente numa automação
-- =============================================
-- Até aqui uma automação só pegava leads NOVOS que batessem com o gatilho
-- (lead_criado/status_mudou/tag_*). Não existia um jeito de rodar a
-- sequência pros leads que JÁ existem e já batem com o filtro — pra isso o
-- usuário tinha que usar Campanhas (lista fixa, sem sequência de dias) em
-- paralelo. Esta function deixa a automação também servir esse caso: roda
-- uma vez sobre os leads atuais, matricula quem bate o filtro, e a partir
-- daí ela segue funcionando normalmente via gatilhos (se algum estiver
-- configurado) sem duplicar quem já foi matriculado aqui.
--
-- Reaproveita fn_matricular_lead_automacao, que já tem ON CONFLICT
-- (automation_id, lead_id) DO NOTHING — então correr essa function de novo
-- (ou um gatilho disparar depois) nunca duplica a matrícula/envios de um
-- lead que já entrou.

CREATE OR REPLACE FUNCTION fn_matricular_leads_existentes(p_automation_id UUID) RETURNS INTEGER AS $$
DECLARE
  automation email_automations;
  lead leads;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO automation FROM email_automations WHERE id = p_automation_id;
  IF automation IS NULL THEN RETURN 0; END IF;

  FOR lead IN
    SELECT * FROM leads
    WHERE email IS NOT NULL AND email <> '' AND COALESCE(email_opt_out, false) = false
  LOOP
    IF fn_lead_bate_filtro_automacao(automation, lead)
       AND NOT EXISTS (SELECT 1 FROM email_automation_enrollments WHERE automation_id = automation.id AND lead_id = lead.id) THEN
      PERFORM fn_matricular_lead_automacao(automation.id, lead.id, lead.email);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION fn_matricular_leads_existentes(UUID) TO authenticated;

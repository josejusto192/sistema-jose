-- =============================================
-- Migration 029: "Iniciar agora" deve respeitar o gatilho, não só o filtro
-- =============================================
-- fn_lead_bate_filtro_automacao só checava origem_filtro/segmento_tags/
-- cnae_filtro (o "E" aplicado por cima de qualquer gatilho) — mas nunca
-- olhava pro VALOR do próprio gatilho (ex: automação com gatilho
-- "tag_adicionada = teste1" matriculava todo mundo no "Iniciar agora",
-- já que segmento_tags continuava vazio).
--
-- Agora fn_lead_bate_filtro_automacao também exige que o lead satisfaça
-- o estado atual de pelo menos UM gatilho configurado (mesma regra "OU"
-- já usada pros gatilhos em tempo real):
--   lead_criado      -> sempre satisfeito (não restringe nada)
--   status_mudou     -> lead.status_prospeccao = gatilho.valor
--   tag_adicionada   -> gatilho.valor está em lead.tags
--   tag_removida     -> gatilho.valor NÃO está em lead.tags
-- Isso só importa pro "Iniciar agora" (fn_matricular_leads_existentes) —
-- os triggers de INSERT/UPDATE continuam re-checando o evento real, então
-- não duplica comportamento, só fecha a brecha do botão manual.

CREATE OR REPLACE FUNCTION fn_lead_satisfaz_algum_gatilho(p_automation_id UUID, p_lead leads) RETURNS BOOLEAN AS $$
DECLARE
  t RECORD;
  tem_gatilho BOOLEAN := false;
BEGIN
  FOR t IN SELECT tipo, valor FROM email_automation_triggers WHERE automation_id = p_automation_id LOOP
    tem_gatilho := true;
    IF t.tipo = 'lead_criado' THEN
      RETURN true;
    ELSIF t.tipo = 'status_mudou' AND p_lead.status_prospeccao = t.valor THEN
      RETURN true;
    ELSIF t.tipo = 'tag_adicionada' AND t.valor = ANY(COALESCE(p_lead.tags, '{}')) THEN
      RETURN true;
    ELSIF t.tipo = 'tag_removida' AND NOT (t.valor = ANY(COALESCE(p_lead.tags, '{}'))) THEN
      RETURN true;
    END IF;
  END LOOP;
  -- Automação sem nenhum gatilho configurado (só "Iniciar agora" / filtro): não restringe.
  RETURN NOT tem_gatilho;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_lead_bate_filtro_automacao(p_automation email_automations, p_lead leads) RETURNS BOOLEAN AS $$
BEGIN
  RETURN (p_automation.origem_filtro IS NULL OR array_length(p_automation.origem_filtro, 1) IS NULL OR p_lead.origem = ANY(p_automation.origem_filtro))
     AND (p_automation.segmento_tags IS NULL OR array_length(p_automation.segmento_tags, 1) IS NULL OR p_lead.tags && p_automation.segmento_tags)
     AND (p_automation.cnae_filtro IS NULL OR array_length(p_automation.cnae_filtro, 1) IS NULL OR p_lead.cnae_principal_descricao = ANY(p_automation.cnae_filtro))
     AND fn_lead_satisfaz_algum_gatilho(p_automation.id, p_lead);
END;
$$ LANGUAGE plpgsql;

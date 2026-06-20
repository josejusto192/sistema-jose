-- =============================================
-- Migration 030: Suporte a "leads específicos" nas campanhas (ex-Automações)
-- =============================================
-- A tela antiga de Campanhas (EmailMarketing.jsx) permitia escolher leads
-- específicos pra um envio manual, em vez de filtrar por segmento. Como
-- Automação virou "Campanhas" e já cobre o caso de envio único (via
-- "Iniciar agora", sem gatilho), falta só essa forma de selecionar
-- destinatários pra eliminar a tela antiga.
--
-- leads_manual: lista fixa de lead_ids. Quando preenchida, ela MANDA — os
-- filtros de segmento (origem_filtro/segmento_tags/cnae_filtro) são
-- ignorados. O lead ainda precisa satisfazer o gatilho configurado (igual
-- antes); como esse modo normalmente é usado com "Iniciar agora" (sem
-- gatilho), na prática isso não restringe nada.

ALTER TABLE email_automations ADD COLUMN IF NOT EXISTS leads_manual UUID[];

CREATE OR REPLACE FUNCTION fn_lead_bate_filtro_automacao(p_automation email_automations, p_lead leads) RETURNS BOOLEAN AS $$
BEGIN
  IF p_automation.leads_manual IS NOT NULL AND array_length(p_automation.leads_manual, 1) IS NOT NULL THEN
    RETURN p_lead.id = ANY(p_automation.leads_manual) AND fn_lead_satisfaz_algum_gatilho(p_automation.id, p_lead);
  END IF;

  RETURN (p_automation.origem_filtro IS NULL OR array_length(p_automation.origem_filtro, 1) IS NULL OR p_lead.origem = ANY(p_automation.origem_filtro))
     AND (p_automation.segmento_tags IS NULL OR array_length(p_automation.segmento_tags, 1) IS NULL OR p_lead.tags && p_automation.segmento_tags)
     AND (p_automation.cnae_filtro IS NULL OR array_length(p_automation.cnae_filtro, 1) IS NULL OR p_lead.cnae_principal_descricao = ANY(p_automation.cnae_filtro))
     AND fn_lead_satisfaz_algum_gatilho(p_automation.id, p_lead);
END;
$$ LANGUAGE plpgsql;

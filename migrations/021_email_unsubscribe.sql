-- =============================================
-- Migration 021: Descadastro (opt-out) de email marketing
-- =============================================
-- Permite que um lead saia da lista ao clicar em "cancelar inscrição"
-- no rodapé dos emails. Leads marcados aqui nunca mais recebem
-- campanhas, mesmo que voltem a ser selecionados/segmentados.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_opt_out_em TIMESTAMPTZ;

ALTER TABLE email_campaign_envios ADD COLUMN IF NOT EXISTS descadastrado_em TIMESTAMPTZ;

-- Migration 009: Campos completos de empresa para leads
-- Endereço, contato completo, quadro societário, natureza jurídica
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS natureza_juridica_descricao TEXT,
  ADD COLUMN IF NOT EXISTS tipo_logradouro             TEXT,
  ADD COLUMN IF NOT EXISTS logradouro                  TEXT,
  ADD COLUMN IF NOT EXISTS numero                      TEXT,
  ADD COLUMN IF NOT EXISTS complemento                 TEXT,
  ADD COLUMN IF NOT EXISTS bairro                      TEXT,
  ADD COLUMN IF NOT EXISTS cep                         TEXT,
  ADD COLUMN IF NOT EXISTS latitude                    NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude                   NUMERIC,
  ADD COLUMN IF NOT EXISTS email_valido                BOOLEAN,
  ADD COLUMN IF NOT EXISTS telefone_ddd                TEXT,
  ADD COLUMN IF NOT EXISTS telefone_tipo               TEXT,
  ADD COLUMN IF NOT EXISTS quadro_societario           JSONB,
  ADD COLUMN IF NOT EXISTS cnaes_secundarios           JSONB;

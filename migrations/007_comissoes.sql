-- Commission % per vendor profile (default 10%)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comissao_percentual NUMERIC(5,2) DEFAULT 10.00;

-- Commission tracking on contracts
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS vendedor_id       UUID REFERENCES auth.users(id);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS vendedor_nome     TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS comissao_percentual NUMERIC(5,2);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS comissao_valor    NUMERIC(12,2);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS comissao_status   TEXT DEFAULT 'pendente'
  CHECK (comissao_status IN ('pendente', 'paga', 'cancelada'));
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS comissao_paga_em  TIMESTAMPTZ;

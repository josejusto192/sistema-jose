-- Migration 001: Tabela de contratos
-- Execute no SQL Editor do Supabase

create table if not exists public.contratos (
  id                    uuid          not null default gen_random_uuid(),
  empresa_id            uuid          null,

  -- Dados do cliente
  cliente_nome          text          not null,
  cliente_cnpj          text          null,
  cliente_email         text          null,
  cliente_telefone      text          null,

  -- Pacote contratado
  pacote                text          not null default 'estrutura_digital',
  -- 'estrutura_digital' | 'gestao_trafego'

  -- Valores
  valor_total           numeric(10,2) null,   -- Estrutura Digital: pagamento único
  valor_mensal          numeric(10,2) null,   -- Gestão de Tráfego: recorrente

  -- Status
  status                text          not null default 'ativo',
  -- 'ativo' | 'aguardando_pagamento' | 'concluido' | 'cancelado'

  -- Datas gerais
  data_assinatura       date          null,
  data_inicio           date          null,

  -- Específico: Estrutura Digital
  pagamento_sinal       boolean       null default false,  -- 50% inicial pago
  pagamento_final       boolean       null default false,  -- 50% final pago
  data_entrega_prevista date          null,
  data_entrega_real     date          null,

  -- Específico: Gestão de Tráfego
  duracao_meses         integer       null default 3,
  renovacao_automatica  boolean       null default true,
  proximo_faturamento   date          null,
  data_cancelamento     date          null,
  motivo_churn          text          null,

  -- Financeiro
  total_recebido        numeric(10,2) null default 0,

  -- Notas
  observacoes           text          null,

  -- Timestamps
  criado_em             timestamptz   null default now(),
  atualizado_em         timestamptz   null default now(),

  constraint contratos_pkey primary key (id),
  constraint contratos_empresa_fk foreign key (empresa_id)
    references public.empresas(id) on delete set null
);

create index if not exists idx_contratos_empresa_id on public.contratos using btree (empresa_id);
create index if not exists idx_contratos_status     on public.contratos using btree (status);
create index if not exists idx_contratos_pacote     on public.contratos using btree (pacote);
create index if not exists idx_contratos_criado_em  on public.contratos using btree (criado_em);

alter table public.contratos enable row level security;

create policy "anon_all_contratos" on public.contratos for all using (true);

-- Trigger para atualizar atualizado_em automaticamente
create trigger trigger_contratos_atualizado_em
  before update on public.contratos
  for each row execute function update_atualizado_em();

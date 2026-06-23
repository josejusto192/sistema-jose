// Webhook de monitoramento da Casa dos Dados — substitui o fluxo do n8n
// ("advogados"). Recebe o evento { data_evento, evento: [{ cnpj, ... }] },
// confere se o CNPJ já existe em leads (pela constraint unique cnpj) e, se
// não existir, consulta os dados completos na API (/v4/cnpj/{cnpj}) e
// insere o lead. Se já existe, não faz nada. Público, sem autenticação —
// mesma URL que era configurada no n8n passa a apontar pra aqui.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

function mapApiToLead(api: Record<string, any>, dataEvento: string | null) {
  return {
    cnpj: api.cnpj,
    cnpj_raiz: api.cnpj_raiz,
    filial_numero: api.filial_numero,
    razao_social: api.razao_social,
    nome_fantasia: api.nome_fantasia,
    matriz_filial: api.matriz_filial,

    situacao_cadastral: api.situacao_cadastral?.situacao_atual || null,
    situacao_motivo: api.situacao_cadastral?.motivo || null,
    situacao_data: api.situacao_cadastral?.data || null,

    porte_codigo: api.porte_empresa?.codigo || null,
    porte_descricao: api.porte_empresa?.descricao || null,
    natureza_juridica_codigo: api.codigo_natureza_juridica || null,
    natureza_juridica_descricao: api.descricao_natureza_juridica || null,
    qualificacao_responsavel_codigo: api.qualificacao_responsavel?.codigo || null,
    qualificacao_responsavel_descricao: api.qualificacao_responsavel?.descricao || null,

    eh_mei: api.mei?.optante ?? false,
    mei_data_opcao: api.mei?.data_opcao_mei || null,
    mei_data_exclusao: api.mei?.data_exclusao_mei || null,
    optante_simples: api.simples?.optante ?? false,
    simples_data_opcao: api.simples?.data_opcao_simples || null,
    simples_data_exclusao: api.simples?.data_exclusao_simples || null,

    cnae_principal_codigo: api.atividade_principal?.codigo || null,
    cnae_principal_descricao: api.atividade_principal?.descricao || null,
    cnaes_secundarios: api.atividade_secundaria ?? [],

    cep: api.endereco?.cep || null,
    tipo_logradouro: api.endereco?.tipo_logradouro || null,
    logradouro: api.endereco?.logradouro || null,
    numero: api.endereco?.numero || null,
    complemento: api.endereco?.complemento || null,
    bairro: api.endereco?.bairro || null,
    municipio: api.endereco?.municipio || null,
    uf: api.endereco?.uf || null,
    ibge_municipio: api.endereco?.ibge?.codigo_municipio ?? null,
    ibge_uf: api.endereco?.ibge?.codigo_uf ?? null,
    latitude: api.endereco?.ibge?.latitude ?? null,
    longitude: api.endereco?.ibge?.longitude ?? null,

    email: api.contato_email?.[0]?.email || null,
    email_valido: api.contato_email?.[0]?.valido ?? null,
    email_dominio: api.contato_email?.[0]?.dominio || null,
    telefone: api.contato_telefonico?.[0]?.completo || null,
    telefone_ddd: api.contato_telefonico?.[0]?.ddd || null,
    telefone_numero: api.contato_telefonico?.[0]?.numero || null,
    telefone_tipo: api.contato_telefonico?.[0]?.tipo || null,

    capital_social: api.capital_social ?? null,
    quadro_societario: api.quadro_societario ?? [],

    data_abertura: api.data_abertura || null,
    data_evento: dataEvento,
    data_consulta: api.data_consulta || null,

    payload_raw: api,
    status_prospeccao: 'novo',
  }
}

// Notifica os superadmins (sino de notificações + push), mesmo esquema já
// usado pra "lead fechou" em App.jsx — só que aqui não tem usuário logado
// disparando a ação (é o webhook), então a lista de destinatários é só os
// superadmins.
async function notificarNovoLead(nome: string) {
  try {
    const { data: admins } = await db.from('profiles').select('id').eq('role', 'superadmin')
    const userIds = (admins || []).map((a: { id: string }) => a.id)
    if (!userIds.length) return
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({
        user_ids: userIds,
        title: '🟢 Novo lead adicionado',
        body: nome,
        url: '#/leads',
        tag: 'novo-lead',
        type: 'novo_lead',
      }),
    })
  } catch (err) {
    console.error('casa-dos-dados-webhook: erro ao notificar novo lead', err)
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const body = await req.json()
    const cnpj = body?.evento?.[0]?.cnpj
    // Sem CNPJ no evento não tem o que fazer — responde 200 mesmo assim
    // (provedores externos costumam suspender o webhook se virem erro).
    if (!cnpj) return new Response('ok', { status: 200 })

    const { data: existente } = await db.from('leads').select('id').eq('cnpj', cnpj).maybeSingle()
    if (existente) return new Response('ok', { status: 200 })

    const { data: cfg } = await db.from('casa_dados_config').select('api_key').eq('ativo', true).limit(1).maybeSingle()
    if (!cfg?.api_key) {
      console.error('casa-dos-dados-webhook: api_key não configurada em casa_dados_config')
      return new Response('ok', { status: 200 })
    }

    const res = await fetch(`https://api.casadosdados.com.br/v4/cnpj/${cnpj}`, {
      headers: { 'api-key': cfg.api_key },
    })
    if (!res.ok) {
      console.error('casa-dos-dados-webhook: erro ao consultar CNPJ', cnpj, res.status)
      return new Response('ok', { status: 200 })
    }
    const api = await res.json()

    const lead = mapApiToLead(api, body?.data_evento || null)
    const { error } = await db.from('leads').insert(lead)
    // 23505 = unique_violation — corrida entre eventos simultâneos do
    // mesmo CNPJ (já inserido por outra chamada concorrente); não é erro.
    if (error && error.code !== '23505') {
      console.error('casa-dos-dados-webhook: erro ao inserir lead', error)
    } else if (!error) {
      await notificarNovoLead(lead.razao_social || lead.nome_fantasia || cnpj)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('casa-dos-dados-webhook error:', err)
    return new Response('ok', { status: 200 })
  }
})

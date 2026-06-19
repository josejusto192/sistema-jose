// Dispara uma campanha de email marketing via Resend.
// Chamado pelo frontend (Email Marketing) autenticado via supabase.functions.invoke.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Troca {{nome}}, {{empresa}}, {{email}} pelos dados do lead — mesma ideia
// das variáveis [Nome]/[Empresa] já usadas no Disparo de WhatsApp.
function personalizar(template: string, lead: Record<string, unknown>) {
  return template
    .replace(/\{\{\s*nome\s*\}\}/gi, String(lead.nome || lead.razao_social || lead.nome_fantasia || ''))
    .replace(/\{\{\s*empresa\s*\}\}/gi, String(lead.nome_fantasia || lead.razao_social || ''))
    .replace(/\{\{\s*email\s*\}\}/gi, String(lead.email || ''))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'not_authenticated' }, 401)
    const { data: userData } = await db.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!userData?.user) return json({ error: 'not_authenticated' }, 401)

    const { campaign_id } = await req.json()
    if (!campaign_id) return json({ error: 'campaign_id é obrigatório' }, 400)

    const { data: campaign } = await db.from('email_campaigns').select('*').eq('id', campaign_id).maybeSingle()
    if (!campaign) return json({ error: 'Campanha não encontrada' }, 404)
    if (campaign.status === 'enviando' || campaign.status === 'enviado') {
      return json({ error: 'Esta campanha já foi enviada ou está em andamento' }, 400)
    }

    const { data: cfg } = await db.from('email_config').select('*').eq('ativo', true).limit(1).maybeSingle()
    if (!cfg?.api_key) return json({ error: 'Email marketing não configurado. Defina a chave da API em Configurações > Email.' }, 400)
    if (!cfg.remetente_email) return json({ error: 'Defina o email do remetente em Configurações > Email.' }, 400)

    let leadsQuery = db.from('leads').select('id, nome, razao_social, nome_fantasia, email, tags').not('email', 'is', null)
    if (campaign.segmento_tags?.length) leadsQuery = leadsQuery.overlaps('tags', campaign.segmento_tags)
    const { data: leads } = await leadsQuery
    const destinatarios = (leads || []).filter(l => l.email?.includes('@'))

    if (destinatarios.length === 0) return json({ error: 'Nenhum lead com email válido encontrado para esse segmento' }, 400)

    await db.from('email_campaigns').update({ status: 'enviando', total_destinatarios: destinatarios.length }).eq('id', campaign_id)

    let enviados = 0
    let falhas = 0

    for (const lead of destinatarios) {
      const assunto = personalizar(campaign.assunto, lead)
      const html = personalizar(campaign.corpo_html, lead)

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.api_key}` },
        body: JSON.stringify({
          from: `${cfg.remetente_nome || ''} <${cfg.remetente_email}>`.trim(),
          to: lead.email,
          subject: assunto,
          html,
        }),
      })

      if (res.ok) {
        enviados++
        await db.from('email_campaign_envios').insert({
          campaign_id, lead_id: lead.id, email: lead.email, status: 'enviado', enviado_em: new Date().toISOString(),
        })
      } else {
        falhas++
        const result = await res.json().catch(() => ({}))
        await db.from('email_campaign_envios').insert({
          campaign_id, lead_id: lead.id, email: lead.email, status: 'falhou', erro: result.message || 'Erro ao enviar',
        })
      }
    }

    await db.from('email_campaigns').update({
      status: 'enviado',
      total_enviados: enviados,
      total_falhas: falhas,
      enviado_em: new Date().toISOString(),
    }).eq('id', campaign_id)

    return json({ ok: true, total: destinatarios.length, enviados, falhas })
  } catch (err) {
    console.error('email-send error:', err)
    return json({ error: String(err) }, 500)
  }
})

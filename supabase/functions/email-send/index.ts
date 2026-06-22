// Dispara uma campanha de email marketing via Resend.
// Chamado pelo frontend (Email Marketing) autenticado via supabase.functions.invoke.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, personalizar, linkDescadastro, comRodape, gerarMessageId, registrarEnvioNaConversa } from '../_shared/email.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

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
    if (campaign.usar_ia) return json({ error: 'Esta campanha usa geração por IA. Use email-send-ia.' }, 400)
    if (campaign.status === 'enviando' || campaign.status === 'enviado') {
      return json({ error: 'Esta campanha já foi enviada ou está em andamento' }, 400)
    }

    const { data: cfg } = await db.from('email_config').select('*').eq('ativo', true).limit(1).maybeSingle()
    if (!cfg?.api_key) return json({ error: 'Email marketing não configurado. Defina a chave da API em Configurações > Email.' }, 400)
    if (!cfg.remetente_email) return json({ error: 'Defina o email do remetente em Configurações > Email.' }, 400)

    let leadsQuery = db.from('leads')
      .select('id, nome, sobrenome, tipo, razao_social, nome_fantasia, email, tags, quadro_societario, email_opt_out')
      .not('email', 'is', null)
      .eq('email_opt_out', false)
    if (campaign.lead_ids?.length) leadsQuery = leadsQuery.in('id', campaign.lead_ids)
    else if (campaign.segmento_tags?.length) leadsQuery = leadsQuery.overlaps('tags', campaign.segmento_tags)
    const { data: leads } = await leadsQuery
    const destinatarios = (leads || []).filter(l => l.email?.includes('@'))

    if (destinatarios.length === 0) return json({ error: 'Nenhum lead com email válido encontrado para esse segmento' }, 400)

    await db.from('email_campaigns').update({ status: 'enviando', total_destinatarios: destinatarios.length }).eq('id', campaign_id)

    let enviados = 0
    let falhas = 0

    const anexos = (campaign.anexos || []).filter((a: any) => a?.url).map((a: any) => ({ filename: a.filename || 'anexo', path: a.url }))

    for (const lead of destinatarios) {
      const envioId = crypto.randomUUID()
      const messageId = gerarMessageId('camp', envioId, cfg.remetente_email)
      const assunto = personalizar(campaign.assunto, lead)
      const unsubLink = linkDescadastro(SUPABASE_URL, { campaignId: campaign_id }, lead.id)
      const html = comRodape(personalizar(campaign.corpo_html, lead), cfg.remetente_nome, unsubLink)

      const payload: Record<string, unknown> = {
        from: `${cfg.remetente_nome || ''} <${cfg.remetente_email}>`.trim(),
        to: lead.email,
        subject: assunto,
        html,
        headers: {
          'List-Unsubscribe': `<${unsubLink}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'Message-ID': messageId,
        },
      }
      if (campaign.responder_para) payload.reply_to = campaign.responder_para
      else if (cfg.caixa_respostas_email) payload.reply_to = cfg.caixa_respostas_email
      if (campaign.cc?.length) payload.cc = campaign.cc
      if (campaign.cco?.length) payload.bcc = campaign.cco
      if (campaign.agendado_para) payload.scheduled_at = campaign.agendado_para
      if (anexos.length) payload.attachments = anexos

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.api_key}` },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        enviados++
        const result = await res.json().catch(() => ({}))
        await db.from('email_campaign_envios').insert({
          id: envioId, campaign_id, lead_id: lead.id, email: lead.email, status: 'enviado', enviado_em: new Date().toISOString(), resend_id: result.id || null,
        })
        await registrarEnvioNaConversa(db, {
          leadId: lead.id, remetenteEmail: cfg.remetente_email, destinatarioEmail: lead.email,
          assunto, corpoHtml: html, messageId, resendId: result.id || null, campaignEnvioId: envioId,
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

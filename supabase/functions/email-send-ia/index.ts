// Dispara uma campanha de email marketing com assunto/corpo gerados por IA
// (Gemini), individualmente para cada lead. Como Edge Functions têm tempo
// de execução limitado, esta função processa um lote pequeno de leads por
// chamada — o frontend chama repetidamente até a campanha terminar.
// O espaçamento entre os envios (anti-spam) é feito via `scheduled_at` do
// Resend, não esperando dentro da função.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, nomeContato, linkDescadastro, comRodape } from '../_shared/email.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const BATCH_SIZE = 8
const PAUSA_ENTRE_GERACOES_MS = 1200 // evita sobrecarregar a API do Gemini

async function gerarEmailComIA(apiKey: string, modelo: string, diretrizes: string | null, objetivo: string, lead: Record<string, unknown>) {
  const prompt = `Você é um redator especializado em emails de prospecção comercial em português do Brasil. Escreva um email natural, direto e que pareça escrito por uma pessoa real — sem HTML estilizado, frases corridas, sem exagero de emojis ou negrito.

${diretrizes ? `Diretrizes gerais da empresa (sempre seguir):\n${diretrizes}\n\n` : ''}Objetivo desta campanha:
${objetivo}

Dados disponíveis sobre o lead/empresa (use só o que for relevante e verdadeiro; não invente nada que não esteja aqui):
${JSON.stringify(lead)}

Nome da pessoa para cumprimentar: ${nomeContato(lead)}

Responda em JSON com exatamente os campos "assunto" (curto, sem clickbait) e "corpo_html" (corpo do email; pode usar <br> para separar parágrafos, nada de markdown ou JSON dentro do texto).`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw { mensagem: `Gemini: ${res.status} ${err}`.slice(0, 2000), prompt }
  }
  const data = await res.json()
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!texto) throw { mensagem: `Gemini não retornou conteúdo. Resposta completa: ${JSON.stringify(data).slice(0, 1500)}`, prompt }
  let parsed: any
  try {
    parsed = JSON.parse(texto)
  } catch {
    throw { mensagem: `Gemini não retornou JSON válido. Texto recebido: ${texto.slice(0, 1500)}`, prompt }
  }
  if (!parsed?.assunto || !parsed?.corpo_html) throw { mensagem: `Resposta da IA sem assunto/corpo_html. Recebido: ${texto.slice(0, 1500)}`, prompt }
  return { assunto: String(parsed.assunto), corpo_html: String(parsed.corpo_html), prompt }
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
    if (!campaign.usar_ia) return json({ error: 'Esta campanha não usa geração por IA' }, 400)
    if (campaign.status === 'enviado') return json({ error: 'Esta campanha já foi enviada' }, 400)
    if (!campaign.ia_objetivo?.trim()) return json({ error: 'Defina o objetivo da campanha (prompt) antes de enviar' }, 400)

    const { data: cfg } = await db.from('email_config').select('*').eq('ativo', true).limit(1).maybeSingle()
    if (!cfg?.api_key) return json({ error: 'Email marketing não configurado. Defina a chave da API em Configurações > Email.' }, 400)
    if (!cfg.remetente_email) return json({ error: 'Defina o email do remetente em Configurações > Email.' }, 400)
    if (!cfg.ia_api_key) return json({ error: 'Defina a chave da API de IA em Configurações > Email.' }, 400)

    let leadsQuery = db.from('leads')
      .select('*')
      .not('email', 'is', null)
      .eq('email_opt_out', false)
    if (campaign.lead_ids?.length) leadsQuery = leadsQuery.in('id', campaign.lead_ids)
    else if (campaign.segmento_tags?.length) leadsQuery = leadsQuery.overlaps('tags', campaign.segmento_tags)
    const { data: leads } = await leadsQuery
    const destinatarios = (leads || []).filter(l => l.email?.includes('@'))
    if (destinatarios.length === 0) return json({ error: 'Nenhum lead com email válido encontrado para esse segmento' }, 400)

    const { data: jaEnviados } = await db.from('email_campaign_envios').select('lead_id').eq('campaign_id', campaign_id)
    const processadosIds = new Set((jaEnviados || []).map(e => e.lead_id))
    const restantes = destinatarios.filter(l => !processadosIds.has(l.id))

    let inicioEm = campaign.ia_inicio_em
    if (!inicioEm) {
      inicioEm = new Date().toISOString()
      await db.from('email_campaigns').update({ status: 'enviando', total_destinatarios: destinatarios.length, ia_inicio_em: inicioEm }).eq('id', campaign_id)
    }

    const intervaloSegundos = cfg.ia_intervalo_segundos || 60
    const baseTime = new Date(campaign.agendado_para || inicioEm).getTime()
    const jaProcessados = processadosIds.size
    const anexos = (campaign.anexos || []).filter((a: any) => a?.url).map((a: any) => ({ filename: a.filename || 'anexo', path: a.url }))

    const lote = restantes.slice(0, BATCH_SIZE)
    let enviadosLote = 0
    let falhasLote = 0

    for (let i = 0; i < lote.length; i++) {
      const lead = lote[i]
      try {
        if (i > 0) await new Promise(r => setTimeout(r, PAUSA_ENTRE_GERACOES_MS))
        const gerado = await gerarEmailComIA(cfg.ia_api_key, cfg.ia_modelo || 'gemini-2.0-flash', cfg.ia_diretrizes || null, campaign.ia_objetivo, lead)

        const unsubLink = linkDescadastro(SUPABASE_URL, campaign_id, lead.id)
        const html = comRodape(gerado.corpo_html, cfg.remetente_nome, unsubLink)
        const globalIndex = jaProcessados + i
        const scheduledAt = new Date(baseTime + globalIndex * intervaloSegundos * 1000).toISOString()

        const payload: Record<string, unknown> = {
          from: `${cfg.remetente_nome || ''} <${cfg.remetente_email}>`.trim(),
          to: lead.email,
          subject: gerado.assunto,
          html,
          scheduled_at: scheduledAt,
          headers: {
            'List-Unsubscribe': `<${unsubLink}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }
        if (campaign.responder_para) payload.reply_to = campaign.responder_para
        if (campaign.cc?.length) payload.cc = campaign.cc
        if (campaign.cco?.length) payload.bcc = campaign.cco
        if (anexos.length) payload.attachments = anexos

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.api_key}` },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          enviadosLote++
          const result = await res.json().catch(() => ({}))
          await db.from('email_campaign_envios').insert({
            campaign_id, lead_id: lead.id, email: lead.email, status: 'enviado', enviado_em: new Date().toISOString(),
            resend_id: result.id || null, assunto_gerado: gerado.assunto, corpo_gerado: gerado.corpo_html, prompt_ia: gerado.prompt,
          })
        } else {
          falhasLote++
          const result = await res.json().catch(() => ({}))
          await db.from('email_campaign_envios').insert({
            campaign_id, lead_id: lead.id, email: lead.email, status: 'falhou',
            erro: `Resend: ${res.status} ${result.message || JSON.stringify(result)}`.slice(0, 2000),
            assunto_gerado: gerado.assunto, corpo_gerado: gerado.corpo_html, prompt_ia: gerado.prompt,
          })
        }
      } catch (err: any) {
        falhasLote++
        const mensagem = err?.mensagem ? String(err.mensagem) : String(err?.message || err).slice(0, 2000)
        await db.from('email_campaign_envios').insert({
          campaign_id, lead_id: lead.id, email: lead.email, status: 'falhou', erro: mensagem, prompt_ia: err?.prompt || null,
        })
      }
    }

    const totalProcessados = jaProcessados + lote.length
    const done = totalProcessados >= destinatarios.length
    const { count: totalEnviados } = await db.from('email_campaign_envios').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign_id).eq('status', 'enviado')
    const { count: totalFalhas } = await db.from('email_campaign_envios').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign_id).eq('status', 'falhou')

    await db.from('email_campaigns').update({
      status: done ? 'enviado' : 'enviando',
      total_enviados: totalEnviados || 0,
      total_falhas: totalFalhas || 0,
      ...(done ? { enviado_em: new Date().toISOString() } : {}),
    }).eq('id', campaign_id)

    return json({
      ok: true,
      done,
      processadoNesteLote: lote.length,
      enviadosNesteLote: enviadosLote,
      falhasNesteLote: falhasLote,
      totalProcessados,
      total: destinatarios.length,
    })
  } catch (err) {
    console.error('email-send-ia error:', err)
    return json({ error: String(err) }, 500)
  }
})

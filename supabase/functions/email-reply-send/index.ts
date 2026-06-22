// Envia uma resposta manual dentro de uma conversa de email com um lead
// (continuação depois que ele respondeu uma campanha/automação, ou uma
// mensagem nova mesmo sem resposta prévia). Mantém o thread visível no
// cliente de email do lead via In-Reply-To/References, e sempre sai com
// Reply-To pra caixa de respostas dedicada (não pro remetente de marketing).
// Chamado pelo frontend (Caixa de Entrada de Email) autenticado via
// supabase.functions.invoke.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/email.ts'

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

    const { lead_id, corpo_html, assunto } = await req.json()
    if (!lead_id || !corpo_html?.trim()) return json({ error: 'lead_id e corpo_html são obrigatórios' }, 400)

    const { data: lead } = await db.from('leads').select('id, email').eq('id', lead_id).maybeSingle()
    if (!lead?.email) return json({ error: 'Lead não encontrado ou sem email' }, 404)

    const { data: cfg } = await db.from('email_config').select('*').eq('ativo', true).limit(1).maybeSingle()
    if (!cfg?.api_key || !cfg.remetente_email) return json({ error: 'Email marketing não configurado.' }, 400)

    const { data: ultima } = await db.from('email_conversas_mensagens')
      .select('message_id, assunto, in_reply_to')
      .eq('lead_id', lead_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const messageId = `<reply-${crypto.randomUUID()}@${cfg.remetente_email.split('@')[1]}>`
    const assuntoFinal = assunto?.trim() || (ultima?.assunto ? `Re: ${ultima.assunto.replace(/^Re:\s*/i, '')}` : 'Re:')

    const headers: Record<string, string> = { 'Message-ID': messageId }
    if (ultima?.message_id) {
      headers['In-Reply-To'] = ultima.message_id
      headers['References'] = ultima.in_reply_to ? `${ultima.in_reply_to} ${ultima.message_id}` : ultima.message_id
    }

    const payload: Record<string, unknown> = {
      from: `${cfg.remetente_nome || ''} <${cfg.remetente_email}>`.trim(),
      to: lead.email,
      subject: assuntoFinal,
      html: corpo_html,
      headers,
    }
    if (cfg.caixa_respostas_email) payload.reply_to = cfg.caixa_respostas_email

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.api_key}` },
      body: JSON.stringify(payload),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) return json({ error: `Resend: ${res.status} ${result.message || JSON.stringify(result)}` }, 400)

    await db.from('email_conversas_mensagens').insert({
      lead_id,
      direction: 'outbound',
      remetente_email: cfg.remetente_email,
      destinatario_email: lead.email,
      assunto: assuntoFinal,
      corpo_html,
      message_id: messageId,
      in_reply_to: ultima?.message_id || null,
      resend_id: result.id || null,
      lida_pelo_agente: true,
    })

    return json({ ok: true })
  } catch (err) {
    console.error('email-reply-send error:', err)
    return json({ error: String(err) }, 500)
  }
})

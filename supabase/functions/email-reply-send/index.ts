// Envia um email manual: continuação de uma conversa existente (lead ou
// contato avulso que já trocou mensagens, identificado por lead_id/thread_key)
// ou uma mensagem nova do zero pra um endereço que nunca recebeu nada da
// gente (só destinatario_email + assunto, sem thread prévia — usado pra
// prospecção manual). Mantém o thread visível no cliente de email da outra
// ponta via In-Reply-To/References quando há conversa prévia, e sempre sai
// com Reply-To pra caixa de respostas dedicada (não pro remetente de
// marketing). Chamado pelo frontend (Caixa de Entrada de Email) autenticado
// via supabase.functions.invoke.
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

    const { lead_id, thread_key, destinatario_email, corpo_html, assunto } = await req.json()
    if (!corpo_html?.trim()) return json({ error: 'corpo_html é obrigatório' }, 400)

    const temConversaPrevia = !!(lead_id || thread_key)
    if (!temConversaPrevia && !destinatario_email?.trim()) {
      return json({ error: 'destinatario_email é obrigatório' }, 400)
    }
    if (!temConversaPrevia && !assunto?.trim()) {
      return json({ error: 'assunto é obrigatório para uma mensagem nova (sem conversa prévia)' }, 400)
    }

    let destinoEmail: string | null = null
    if (lead_id) {
      const { data: lead } = await db.from('leads').select('id, email').eq('id', lead_id).maybeSingle()
      if (!lead?.email) return json({ error: 'Lead não encontrado ou sem email' }, 404)
      destinoEmail = lead.email
    } else {
      destinoEmail = destinatario_email.trim()
    }

    const { data: cfg } = await db.from('email_config').select('*').eq('ativo', true).limit(1).maybeSingle()
    if (!cfg?.api_key || !cfg.remetente_email) return json({ error: 'Email marketing não configurado.' }, 400)

    let ultima: { message_id: string | null; assunto: string | null; in_reply_to: string | null } | null = null
    if (temConversaPrevia) {
      const conversaQuery = db.from('email_conversas_mensagens')
        .select('message_id, assunto, in_reply_to')
        .order('created_at', { ascending: false })
        .limit(1)
      const { data } = lead_id
        ? await conversaQuery.eq('lead_id', lead_id).maybeSingle()
        : await conversaQuery.eq('thread_key', thread_key).maybeSingle()
      ultima = data
    }

    const messageId = `<reply-${crypto.randomUUID()}@${cfg.remetente_email.split('@')[1]}>`
    const assuntoFinal = assunto?.trim() || (ultima?.assunto ? `Re: ${ultima.assunto.replace(/^Re:\s*/i, '')}` : 'Re:')

    const headers: Record<string, string> = { 'Message-ID': messageId }
    if (ultima?.message_id) {
      headers['In-Reply-To'] = ultima.message_id
      headers['References'] = ultima.in_reply_to ? `${ultima.in_reply_to} ${ultima.message_id}` : ultima.message_id
    }

    const payload: Record<string, unknown> = {
      from: `${cfg.remetente_nome || ''} <${cfg.remetente_email}>`.trim(),
      to: destinoEmail,
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
      lead_id: lead_id || null,
      contato_email: lead_id ? null : destinoEmail,
      direction: 'outbound',
      remetente_email: cfg.remetente_email,
      destinatario_email: destinoEmail,
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

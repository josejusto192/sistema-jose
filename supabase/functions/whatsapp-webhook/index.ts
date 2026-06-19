// Webhook do WhatsApp Cloud API (Meta) — substitui o fluxo do n8n.
// GET  -> handshake de verificação (hub.mode / hub.verify_token / hub.challenge)
// POST -> mensagens recebidas (inbound) e atualizações de status (sent/delivered/read)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN')!
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const STATUS_FIELD: Record<string, string> = {
  sent: 'whatsapp_sent_at',
  delivered: 'whatsapp_delivered_at',
  read: 'whatsapp_read_at',
}

async function handleIncomingMessage(value: any) {
  const msg = value.messages?.[0]
  if (!msg) return

  const texto = msg.text?.body
    || msg.button?.text
    || msg.interactive?.button_reply?.title
    || msg.interactive?.list_reply?.title
    || `[${msg.type}]`

  // upsert ignorando conflito de wamid: a Meta reenvia o mesmo evento em
  // caso de timeout, então isso evita duplicar a mensagem na conversa.
  await db.from('whatsapp_messages').upsert({
    session_id: msg.from,
    direction: 'inbound',
    sent_by: null,
    wamid: msg.id,
    content: texto,
    message_type: msg.type || 'text',
  }, { onConflict: 'wamid', ignoreDuplicates: true })
}

async function handleStatusUpdate(value: any) {
  const status = value.statuses?.[0]
  if (!status) return
  const field = STATUS_FIELD[status.status]
  const patch: Record<string, unknown> = { whatsapp_status: status.status }
  if (field) patch[field] = new Date(Number(status.timestamp) * 1000).toISOString()
  await db.from('whatsapp_messages').update(patch).eq('wamid', status.id)
}

serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value
          if (value?.messages?.length) await handleIncomingMessage(value)
          if (value?.statuses?.length) await handleStatusUpdate(value)
        }
      }
      return new Response('EVENT_RECEIVED', { status: 200 })
    } catch (err) {
      console.error('whatsapp-webhook error:', err)
      // Meta espera 200 mesmo em erro interno, senão pode suspender o webhook;
      // o erro fica registrado no log da function pra investigar depois.
      return new Response('EVENT_RECEIVED', { status: 200 })
    }
  }

  return new Response('Method not allowed', { status: 405 })
})

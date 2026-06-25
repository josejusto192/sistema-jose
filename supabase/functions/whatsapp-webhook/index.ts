// Webhook do WhatsApp Cloud API (Meta) — substitui o fluxo do n8n.
// GET  -> handshake de verificação (hub.mode / hub.verify_token / hub.challenge)
// POST -> mensagens recebidas (inbound) e atualizações de status (sent/delivered/read)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { registrarLog } from '../_shared/log.ts'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const STATUS_FIELD: Record<string, string> = {
  sent: 'whatsapp_sent_at',
  delivered: 'whatsapp_delivered_at',
  read: 'whatsapp_read_at',
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/aac': 'aac', 'audio/amr': 'amr',
  'application/pdf': 'pdf',
}

// Mídia da Cloud API não vem no payload do webhook — só um media id. É
// preciso buscar a URL temporária (com o token de acesso) e baixar o
// binário antes que ela expire, daí subir pro nosso bucket público.
async function downloadMedia(mediaId: string, accessToken: string, graphVersion: string) {
  const metaRes = await fetch(`https://graph.facebook.com/${graphVersion}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const meta = await metaRes.json()
  if (!meta?.url) return null

  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const bytes = await fileRes.arrayBuffer()
  return { bytes, mimeType: meta.mime_type as string }
}

async function handleIncomingMessage(value: any) {
  const msg = value.messages?.[0]
  if (!msg) return

  const mediaField = msg.image || msg.audio || msg.video || msg.document || msg.sticker

  let mediaUrl: string | null = null
  let mimeType: string | null = null

  if (mediaField?.id) {
    const { data: cfg } = await db.from('whatsapp_config').select('access_token, graph_version').eq('ativo', true).limit(1).maybeSingle()
    if (cfg?.access_token) {
      const media = await downloadMedia(mediaField.id, cfg.access_token, cfg.graph_version || 'v25.0')
      if (media) {
        mimeType = media.mimeType
        const ext = MIME_EXT[mimeType] || mimeType.split('/')[1] || 'bin'
        const path = `${msg.from}/${msg.id}.${ext}`
        const { error: upErr } = await db.storage.from('whatsapp-media').upload(path, media.bytes, { contentType: mimeType, upsert: true })
        if (!upErr) mediaUrl = db.storage.from('whatsapp-media').getPublicUrl(path).data.publicUrl
      }
    }
  }

  const texto = msg.text?.body
    || mediaField?.caption
    || msg.button?.text
    || msg.interactive?.button_reply?.title
    || msg.interactive?.list_reply?.title
    || (mediaUrl ? null : `[${msg.type}]`)

  // upsert ignorando conflito de wamid: a Meta reenvia o mesmo evento em
  // caso de timeout, então isso evita duplicar a mensagem na conversa.
  const { data: inserida } = await db.from('whatsapp_messages').upsert({
    session_id: msg.from,
    direction: 'inbound',
    sent_by: null,
    wamid: msg.id,
    content: texto,
    message_type: msg.type || 'text',
    media_url: mediaUrl,
    mime_type: mimeType,
  }, { onConflict: 'wamid', ignoreDuplicates: true }).select('id').maybeSingle()

  // ignoreDuplicates faz o upsert não retornar nada quando já existe (reenvio
  // da Meta) — só loga quando a mensagem foi de fato inserida.
  if (inserida) {
    await registrarLog(db, {
      acao: 'receber',
      tabela: 'whatsapp_messages',
      registroId: inserida.id,
      detalhes: { session_id: msg.from, tipo: msg.type || 'text', conteudo: texto || null },
      usuarioNome: 'Webhook WhatsApp',
    })
  }
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

    const { data: cfg } = await db.from('whatsapp_config').select('verify_token').eq('ativo', true).limit(1).maybeSingle()
    const verifyToken = cfg?.verify_token

    if (mode === 'subscribe' && verifyToken && token === verifyToken) {
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

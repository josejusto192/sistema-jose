// Envia uma mensagem de texto via WhatsApp Cloud API e registra em whatsapp_messages.
// Chamado pelo frontend (Caixa de Entrada) autenticado via supabase.functions.invoke.
// Substitui o nó HTTP Request do n8n usado hoje pra envio.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Token, phone_number_id e versão da Graph API vêm todos da tabela whatsapp_config
// (editável pela tela de Configurações) — não exige configurar Edge Function Secrets.
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'not_authenticated' }, 401)
    const { data: userData } = await db.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!userData?.user) return json({ error: 'not_authenticated' }, 401)

    const { session_id, texto, media_url, media_type, mime_type } = await req.json()
    const isMedia = !!media_url
    if (!session_id || (!isMedia && !texto?.trim())) return json({ error: 'session_id e texto (ou media_url) são obrigatórios' }, 400)

    const { data: cfg } = await db.from('whatsapp_config').select('*').eq('ativo', true).limit(1).maybeSingle()
    if (!cfg?.phone_number_id) return json({ error: 'WhatsApp não configurado. Defina o phone_number_id em Configurações.' }, 400)
    const accessToken = cfg.access_token
    if (!accessToken) return json({ error: 'Token de acesso do WhatsApp não configurado. Defina em Configurações > WhatsApp.' }, 400)
    const graphVersion = cfg.graph_version || 'v25.0'

    const tipo = isMedia ? (media_type || 'document') : 'text'
    const caption = texto?.trim() || undefined
    const payload: Record<string, unknown> = isMedia
      ? { messaging_product: 'whatsapp', to: session_id, type: tipo, [tipo]: tipo === 'audio' ? { link: media_url } : { link: media_url, caption } }
      : { messaging_product: 'whatsapp', to: session_id, type: 'text', text: { body: texto.trim() } }

    const res = await fetch(`https://graph.facebook.com/${graphVersion}/${cfg.phone_number_id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    })
    const result = await res.json()

    if (!res.ok) {
      // Não grava em whatsapp_messages: se a Meta rejeitou o envio, a
      // mensagem não existe de fato e não deve aparecer no histórico da
      // conversa como se tivesse sido enviada.
      const apiMsg = result.error?.message || 'Erro ao enviar mensagem'
      return json({ error: apiMsg }, 502)
    }

    const wamid = result.messages?.[0]?.id || null

    await db.from('whatsapp_messages').insert({
      session_id,
      direction: 'outbound',
      sent_by: 'human',
      sent_by_user_id: userData.user.id,
      content: caption || null,
      message_type: tipo,
      media_url: isMedia ? media_url : null,
      mime_type: isMedia ? mime_type || null : null,
      wamid,
      whatsapp_status: 'sent',
      whatsapp_sent_at: new Date().toISOString(),
    })

    return json({ ok: true, wamid })
  } catch (err) {
    console.error('whatsapp-send error:', err)
    return json({ error: String(err) }, 500)
  }
})

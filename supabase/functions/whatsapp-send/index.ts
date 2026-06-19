// Envia uma mensagem de texto via WhatsApp Cloud API e registra em whatsapp_messages.
// Chamado pelo frontend (Caixa de Entrada) autenticado via supabase.functions.invoke.
// Substitui o nó HTTP Request do n8n usado hoje pra envio.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ACCESS_TOKEN  = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!
const GRAPH_VERSION = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v20.0'
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

    const { session_id, texto } = await req.json()
    if (!session_id || !texto?.trim()) return json({ error: 'session_id e texto são obrigatórios' }, 400)

    const { data: cfg } = await db.from('whatsapp_config').select('*').eq('ativo', true).limit(1).maybeSingle()
    if (!cfg?.phone_number_id) return json({ error: 'WhatsApp não configurado. Defina o phone_number_id em Configurações.' }, 400)
    if (!ACCESS_TOKEN) return json({ error: 'Token de acesso do WhatsApp não configurado no servidor.' }, 400)

    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phone_number_id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: session_id,
        type: 'text',
        text: { body: texto.trim() },
      }),
    })
    const result = await res.json()

    if (!res.ok) {
      const apiMsg = result.error?.message || 'Erro ao enviar mensagem'
      await db.from('whatsapp_messages').insert({
        session_id,
        direction: 'outbound',
        sent_by: 'human',
        sent_by_user_id: userData.user.id,
        content: texto.trim(),
        message_type: 'text',
        whatsapp_status: 'failed',
      })
      return json({ error: apiMsg }, 502)
    }

    const wamid = result.messages?.[0]?.id || null

    await db.from('whatsapp_messages').insert({
      session_id,
      direction: 'outbound',
      sent_by: 'human',
      sent_by_user_id: userData.user.id,
      wamid,
      content: texto.trim(),
      message_type: 'text',
      whatsapp_status: 'sent',
      whatsapp_sent_at: new Date().toISOString(),
    })

    return json({ ok: true, wamid })
  } catch (err) {
    console.error('whatsapp-send error:', err)
    return json({ error: String(err) }, 500)
  }
})

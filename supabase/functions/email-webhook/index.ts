// Recebe webhooks do Resend (email.opened / email.clicked) e atualiza o
// envio correspondente em email_campaign_envios, casando pelo resend_id
// salvo em email-send. Resend assina o payload no formato Svix
// (svix-id/svix-timestamp/svix-signature) — validamos antes de processar
// pra não deixar qualquer um forjar "abertura" de campanha.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

function base64ToBytes(b64: string) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

async function verifySignature(secret: string, svixId: string, svixTimestamp: string, body: string, svixSignature: string) {
  const secretBytes = base64ToBytes(secret.replace(/^whsec_/, ''))
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signedContent = `${svixId}.${svixTimestamp}.${body}`
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent))
  const expected = bytesToBase64(new Uint8Array(sigBytes))

  return svixSignature.split(' ').some(part => part.split(',')[1] === expected)
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })

  try {
    const body = await req.text()

    const { data: cfg } = await db.from('email_config').select('webhook_secret').eq('ativo', true).limit(1).maybeSingle()
    if (cfg?.webhook_secret) {
      const svixId = req.headers.get('svix-id')
      const svixTimestamp = req.headers.get('svix-timestamp')
      const svixSignature = req.headers.get('svix-signature')
      if (!svixId || !svixTimestamp || !svixSignature) return new Response('missing_signature', { status: 401 })
      const valid = await verifySignature(cfg.webhook_secret, svixId, svixTimestamp, body, svixSignature)
      if (!valid) return new Response('invalid_signature', { status: 401 })
    }

    const event = JSON.parse(body)
    const emailId = event.data?.email_id
    if (!emailId) return new Response('ok', { status: 200 })

    if (event.type === 'email.opened') {
      await db.from('email_campaign_envios').update({ aberto_em: new Date().toISOString() }).eq('resend_id', emailId).is('aberto_em', null)
    } else if (event.type === 'email.clicked') {
      await db.from('email_campaign_envios').update({ clicado_em: new Date().toISOString() }).eq('resend_id', emailId).is('clicado_em', null)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('email-webhook error:', err)
    return new Response('ok', { status: 200 })
  }
})

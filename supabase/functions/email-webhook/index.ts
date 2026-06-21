// Recebe webhooks do Resend (opened/clicked/bounced/complained/delivered) e
// atualiza o envio correspondente em email_campaign_envios e/ou
// email_automation_envios, casando pelo resend_id salvo no envio. Resend
// assina o payload no formato Svix (svix-id/svix-timestamp/svix-signature)
// — validamos antes de processar pra não deixar qualquer um forjar eventos.
// IMPORTANTE: os tipos de evento abaixo só chegam aqui se estiverem
// marcados no webhook configurado no painel do Resend (Webhooks > eventos).
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

// Bounce/reclamação de spam: endereço inválido ou que não nos quer mais.
// Continuar tentando enviar pra ele só prejudica a reputação do remetente —
// descadastra automaticamente, igual ao link de descadastro no rodapé.
async function marcarLeadOptOut(emailId: string) {
  const { data: envioCampanha } = await db.from('email_campaign_envios').select('lead_id').eq('resend_id', emailId).maybeSingle()
  const { data: envioAutomacao } = await db.from('email_automation_envios').select('lead_id').eq('resend_id', emailId).maybeSingle()
  const leadId = envioCampanha?.lead_id || envioAutomacao?.lead_id
  if (!leadId) return
  await db.from('leads').update({ email_opt_out: true, email_opt_out_em: new Date().toISOString() }).eq('id', leadId)
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

    // O resend_id pode ter sido salvo numa campanha manual antiga ou numa
    // automação atual — aplica em ambas as tabelas (a que não tiver o envio
    // simplesmente não atualiza nenhuma linha).
    async function marcar(coluna: string, valor: unknown, extra: Record<string, unknown> = {}) {
      await db.from('email_campaign_envios').update({ [coluna]: valor, ...extra }).eq('resend_id', emailId).is(coluna, null)
      await db.from('email_automation_envios').update({ [coluna]: valor, ...extra }).eq('resend_id', emailId).is(coluna, null)
    }

    if (event.type === 'email.opened') {
      await marcar('aberto_em', new Date().toISOString())
    } else if (event.type === 'email.clicked') {
      await marcar('clicado_em', new Date().toISOString())
    } else if (event.type === 'email.delivered') {
      await marcar('entregue_em', new Date().toISOString())
    } else if (event.type === 'email.bounced' || event.type === 'email.failed' || event.type === 'email.suppressed') {
      // failed (Resend não conseguiu enviar) e suppressed (endereço já está
      // na lista de suprimidos do Resend, geralmente por bounce anterior) na
      // prática significam a mesma coisa pro usuário: o email não chegou.
      const motivo = String(event.data?.bounce?.message || event.data?.reason || `Email não entregue (${event.type}).`).slice(0, 500)
      await marcar('bounced_em', new Date().toISOString(), { bounce_motivo: motivo })
      await marcarLeadOptOut(emailId)
    } else if (event.type === 'email.complained') {
      await marcar('reclamado_em', new Date().toISOString())
      await marcarLeadOptOut(emailId)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('email-webhook error:', err)
    return new Response('ok', { status: 200 })
  }
})

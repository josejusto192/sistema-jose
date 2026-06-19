// Link de descadastro presente no rodapé de todo email de campanha.
// Chamado diretamente pelo navegador do lead (sem autenticação), por isso
// é deployado com --no-verify-jwt.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

function pagina(mensagem: string) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cancelar inscrição</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb;">
  <div style="text-align:center;max-width:420px;padding:24px;">
    <p style="font-size:16px;color:#111827;">${mensagem}</p>
  </div>
</body></html>`
}

function html(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

serve(async (req) => {
  const url = new URL(req.url)
  const leadId = url.searchParams.get('lead_id')
  const campaignId = url.searchParams.get('campaign_id')
  const automationId = url.searchParams.get('automation_id')
  if (!leadId) return html(pagina('Link inválido.'), 400)

  try {
    await db.from('leads').update({ email_opt_out: true, email_opt_out_em: new Date().toISOString() }).eq('id', leadId)
    if (campaignId) {
      await db.from('email_campaign_envios').update({ descadastrado_em: new Date().toISOString() }).eq('campaign_id', campaignId).eq('lead_id', leadId)
    }
    if (automationId) {
      await db.from('email_automation_envios').update({ descadastrado_em: new Date().toISOString() }).eq('automation_id', automationId).eq('lead_id', leadId)
      await db.from('email_automation_enrollments').update({ status: 'cancelado' }).eq('automation_id', automationId).eq('lead_id', leadId)
    }
    return html(pagina('Você foi removido(a) da nossa lista de emails. Você não receberá mais nossas campanhas.'))
  } catch (err) {
    console.error('email-unsubscribe error:', err)
    return html(pagina('Não foi possível processar seu pedido agora. Tente novamente mais tarde.'), 500)
  }
})

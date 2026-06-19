// Helpers compartilhados entre email-send e email-send-ia.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Nome de uma pessoa para usar na saudação: para lead do tipo "pessoa" usa o
// próprio nome; para "empresa" usa o sócio/administrador do quadro
// societário (não a razão social), já que "{{nome}}" é usado para
// cumprimentar alguém, não a empresa.
export function nomeContato(lead: Record<string, unknown>) {
  if (lead.tipo === 'pessoa' && lead.nome) return String(lead.nome)
  const socios = Array.isArray(lead.quadro_societario) ? lead.quadro_societario : []
  const nomeSocio = (socios.find((s: any) => s?.nome) as any)?.nome
  if (nomeSocio) return String(nomeSocio).trim().split(/\s+/)[0]
  return String(lead.nome || lead.nome_fantasia || lead.razao_social || '')
}

// Troca {{nome}}, {{empresa}}, {{email}} pelos dados do lead — mesma ideia
// das variáveis [Nome]/[Empresa] já usadas no Disparo de WhatsApp.
export function personalizar(template: string, lead: Record<string, unknown>) {
  return template
    .replace(/\{\{\s*nome\s*\}\}/gi, nomeContato(lead))
    .replace(/\{\{\s*empresa\s*\}\}/gi, String(lead.nome_fantasia || lead.razao_social || ''))
    .replace(/\{\{\s*email\s*\}\}/gi, String(lead.email || ''))
}

export function linkDescadastro(supabaseUrl: string, campaignId: string, leadId: string) {
  return `${supabaseUrl}/functions/v1/email-unsubscribe?campaign_id=${campaignId}&lead_id=${leadId}`
}

// Rodapé padrão (prevenção de spam): toda campanha sai com um link de
// descadastro, exigido pelas políticas anti-spam do Resend/CAN-SPAM/LGPD.
export function comRodape(html: string, remetenteNome: string, unsubLink: string) {
  return `${html}
<br><br>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;">
<p style="font-size:12px;color:#9ca3af;line-height:1.5;">
  Você recebeu este email de ${remetenteNome || 'nossa empresa'}.
  Não quer mais receber essas mensagens?
  <a href="${unsubLink}" style="color:#9ca3af;text-decoration:underline;">Cancelar inscrição</a>.
</p>`
}

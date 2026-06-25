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

// Gera o Message-ID que vai no header do envio. Não usamos o id retornado
// pelo Resend (não é garantido ser o mesmo que vai no header SMTP de
// fato) — geramos o nosso próprio, vinculado ao id da linha de envio, pra
// poder casar a resposta do lead (header In-Reply-To/References) de volta
// com o envio exato que a gerou.
export function gerarMessageId(prefixo: 'camp' | 'auto', envioId: string, remetenteEmail: string) {
  const dominio = (remetenteEmail.split('@')[1] || 'localhost').trim()
  return `<${prefixo}-${envioId}@${dominio}>`
}

// Registra a cópia "outbound" do que foi enviado na conversa do lead, pra a
// caixa de email do lead (CaixaEntradaEmail) mostrar o histórico completo —
// não só as respostas dele, também o que nós mandamos.
export async function registrarEnvioNaConversa(
  db: any,
  args: {
    leadId: string
    remetenteEmail: string
    destinatarioEmail: string
    assunto: string
    corpoHtml: string
    messageId: string
    resendId: string | null
    automationEnvioId?: string
    campaignEnvioId?: string
  }
) {
  await db.from('email_conversas_mensagens').insert({
    lead_id: args.leadId,
    direction: 'outbound',
    remetente_email: args.remetenteEmail,
    destinatario_email: args.destinatarioEmail,
    assunto: args.assunto,
    corpo_html: args.corpoHtml,
    message_id: args.messageId,
    resend_id: args.resendId,
    automation_envio_id: args.automationEnvioId || null,
    campaign_envio_id: args.campaignEnvioId || null,
    lida_pelo_agente: true,
  })
}

export function linkDescadastro(supabaseUrl: string, ref: { campaignId?: string; automationId?: string }, leadId: string) {
  const params = new URLSearchParams({ lead_id: leadId })
  if (ref.campaignId) params.set('campaign_id', ref.campaignId)
  if (ref.automationId) params.set('automation_id', ref.automationId)
  return `${supabaseUrl}/functions/v1/email-unsubscribe?${params.toString()}`
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

// Gera assunto/corpo_html individualizados para um lead via Gemini, a
// partir de um objetivo (prompt da campanha/passo) + diretrizes universais
// opcionais + todos os dados do lead. Usado por email-send-ia e pelos
// passos de IA de email-automation-tick.
export async function gerarEmailComIA(apiKey: string, modelo: string, diretrizes: string | null, objetivo: string, lead: Record<string, unknown>, assuntoFixo?: string | null) {
  const prompt = `Você é um redator especializado em emails de prospecção comercial em português do Brasil. Escreva um email natural, direto e que pareça escrito por uma pessoa real — sem HTML estilizado, frases corridas, sem exagero de emojis ou negrito.

${diretrizes ? `Diretrizes gerais da empresa (sempre seguir):\n${diretrizes}\n\n` : ''}Objetivo desta campanha:
${objetivo}

Dados disponíveis sobre o lead/empresa (use só o que for relevante e verdadeiro; não invente nada que não esteja aqui):
${JSON.stringify(lead)}

Nome da pessoa para cumprimentar: ${nomeContato(lead)}

${assuntoFixo
    ? `O assunto do email já está definido como "${assuntoFixo}" — não o repita na resposta. Responda em JSON com exatamente o campo "corpo_html" (corpo do email; pode usar <br> para separar parágrafos, nada de markdown ou JSON dentro do texto).`
    : `Responda em JSON com exatamente os campos "assunto" (curto, sem clickbait) e "corpo_html" (corpo do email; pode usar <br> para separar parágrafos, nada de markdown ou JSON dentro do texto).`}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw { mensagem: `Gemini: ${res.status} ${err}`.slice(0, 2000), prompt }
  }
  const data = await res.json()
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!texto) throw { mensagem: `Gemini não retornou conteúdo. Resposta completa: ${JSON.stringify(data).slice(0, 1500)}`, prompt }
  let parsed: any
  try {
    parsed = JSON.parse(texto)
  } catch {
    throw { mensagem: `Gemini não retornou JSON válido. Texto recebido: ${texto.slice(0, 1500)}`, prompt }
  }
  if (assuntoFixo) {
    if (!parsed?.corpo_html) throw { mensagem: `Resposta da IA sem corpo_html. Recebido: ${texto.slice(0, 1500)}`, prompt }
    return { assunto: assuntoFixo, corpo_html: String(parsed.corpo_html), prompt }
  }
  if (!parsed?.assunto || !parsed?.corpo_html) throw { mensagem: `Resposta da IA sem assunto/corpo_html. Recebido: ${texto.slice(0, 1500)}`, prompt }
  return { assunto: String(parsed.assunto), corpo_html: String(parsed.corpo_html), prompt }
}

// Processa os envios de automação de email cujo horário (scheduled_for) já
// chegou. Chamada periodicamente (a cada 10 min) pelo pg_cron via
// email_automation_tick_call(), autenticada por um header próprio (não um
// JWT de usuário) já que não há uma sessão humana disparando a chamada.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, personalizar, linkDescadastro, comRodape, gerarEmailComIA } from '../_shared/email.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const BATCH_SIZE = 15
const PAUSA_ENTRE_GERACOES_MS = 1200 // evita sobrecarregar a API do Gemini quando há passos de IA

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { data: cfg } = await db.from('email_config').select('*').eq('ativo', true).limit(1).maybeSingle()
    if (!cfg?.automation_secret || req.headers.get('x-automation-secret') !== cfg.automation_secret) {
      return json({ error: 'not_authenticated' }, 401)
    }
    if (!cfg.api_key || !cfg.remetente_email) {
      return json({ ok: true, processados: 0, motivo: 'email marketing não configurado' })
    }

    const agora = new Date().toISOString()
    const { data: envios } = await db
      .from('email_automation_envios')
      .select('*, email_automation_steps(*), email_automation_enrollments(*)')
      .eq('status', 'pendente')
      .lte('scheduled_for', agora)
      .order('scheduled_for', { ascending: true })
      .limit(BATCH_SIZE)

    if (!envios?.length) return json({ ok: true, processados: 0 })

    const leadIds = [...new Set(envios.map(e => e.lead_id).filter(Boolean))]
    const { data: leads } = await db.from('leads').select('*').in('id', leadIds)
    const leadById = new Map((leads || []).map(l => [l.id, l]))

    const intervaloSegundos = cfg.ia_intervalo_segundos || 60
    let enviados = 0
    let falhas = 0
    let cancelados = 0

    for (let i = 0; i < envios.length; i++) {
      const envio = envios[i]
      const step = envio.email_automation_steps
      const enrollment = envio.email_automation_enrollments
      const lead = leadById.get(envio.lead_id)

      if (enrollment?.status !== 'ativo' || !lead || lead.email_opt_out) {
        cancelados++
        await db.from('email_automation_envios').update({ status: 'cancelado' }).eq('id', envio.id)
        continue
      }

      try {
        if (i > 0) await new Promise(r => setTimeout(r, PAUSA_ENTRE_GERACOES_MS))

        let assunto: string
        let corpoHtml: string
        let promptIa: string | null = null

        if (step.usar_ia) {
          if (!cfg.ia_api_key) throw { mensagem: 'Defina a chave da API de IA em Configurações > Email.' }
          const gerado = await gerarEmailComIA(cfg.ia_api_key, cfg.ia_modelo || 'gemini-2.0-flash', cfg.ia_diretrizes || null, step.ia_objetivo || '', lead)
          assunto = gerado.assunto
          corpoHtml = gerado.corpo_html
          promptIa = gerado.prompt
        } else {
          assunto = personalizar(step.assunto || '', lead)
          corpoHtml = personalizar(step.corpo_html || '', lead)
        }

        const unsubLink = linkDescadastro(SUPABASE_URL, { automationId: envio.automation_id }, lead.id)
        const html = comRodape(corpoHtml, cfg.remetente_nome, unsubLink)
        const scheduledAt = new Date(Date.now() + i * intervaloSegundos * 1000).toISOString()

        const payload: Record<string, unknown> = {
          from: `${cfg.remetente_nome || ''} <${cfg.remetente_email}>`.trim(),
          to: lead.email,
          subject: assunto,
          html,
          scheduled_at: scheduledAt,
          headers: {
            'List-Unsubscribe': `<${unsubLink}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.api_key}` },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          enviados++
          const result = await res.json().catch(() => ({}))
          await db.from('email_automation_envios').update({
            status: 'enviado', enviado_em: new Date().toISOString(), resend_id: result.id || null,
            assunto_gerado: assunto, corpo_gerado: corpoHtml, prompt_ia: promptIa,
          }).eq('id', envio.id)
        } else {
          falhas++
          const result = await res.json().catch(() => ({}))
          await db.from('email_automation_envios').update({
            status: 'falhou',
            erro: `Resend: ${res.status} ${result.message || JSON.stringify(result)}`.slice(0, 2000),
            assunto_gerado: assunto, corpo_gerado: corpoHtml, prompt_ia: promptIa,
          }).eq('id', envio.id)
        }
      } catch (err: any) {
        falhas++
        const mensagem = err?.mensagem ? String(err.mensagem) : String(err?.message || err).slice(0, 2000)
        await db.from('email_automation_envios').update({ status: 'falhou', erro: mensagem, prompt_ia: err?.prompt || null }).eq('id', envio.id)
      }

      const { count: pendentes } = await db.from('email_automation_envios').select('id', { count: 'exact', head: true })
        .eq('enrollment_id', envio.enrollment_id).eq('status', 'pendente')
      if (!pendentes) {
        await db.from('email_automation_enrollments').update({ status: 'concluido' }).eq('id', envio.enrollment_id)
      }
    }

    return json({ ok: true, processados: envios.length, enviados, falhas, cancelados })
  } catch (err) {
    console.error('email-automation-tick error:', err)
    return json({ error: String(err) }, 500)
  }
})

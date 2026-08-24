// Processa os envios de automação de email cujo horário (scheduled_for) já
// chegou. Chamada periodicamente pelo pg_cron ou sob demanda via
// fn_request_email_automation_tick(), autenticada por um header próprio (não
// um JWT de usuário) já que também não há sessão humana no disparo do cron.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, personalizar, linkDescadastro, comRodape, gerarEmailComIA, gerarMessageId, registrarEnvioNaConversa } from '../_shared/email.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const BATCH_SIZE = 15
// O cron automático não deve despejar um passivo antigo quando o worker volta
// de uma indisponibilidade. Envios com mais de 24 h exigem o comando manual da
// campanha; solicitações com automation_id não aplicam este corte.
const CRON_MAX_OVERDUE_MS = 24 * 60 * 60 * 1000
// O tier gratuito do Gemini limita requisições por minuto (ex.: 15 RPM no
// gemini-2.0-flash); 1.2s de pausa permitia ~50/min e esgotava a cota em
// segundos. 4.5s mantém no máx. ~13 chamadas/min, com margem de segurança.
const PAUSA_ENTRE_GERACOES_MS = 4500

type RunStatus = 'queued' | 'running' | 'success' | 'partial' | 'failed' | 'skipped'

type TickBody = {
  run_id?: string | null
  automation_id?: string | null
  trigger?: string | null
}

type RunCounts = {
  processados: number
  enviados: number
  falhas: number
  cancelados: number
  ignorados: number
}

class TickError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

// O provedor já aceitou o email, mas não conseguimos persistir a confirmação
// local. Esse caso não pode virar uma falha reenviável comum: o registro fica
// com o lease `processando` e será retomado com a mesma Idempotency-Key.
class ProviderAcceptedPersistenceError extends TickError {}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) return String((error as any).message)
  return String(error)
}

async function updateRun(runId: string | null, patch: Record<string, unknown>) {
  if (!runId) return
  const { error } = await db.from('email_automation_runs').update({
    ...patch,
    updated_at: new Date().toISOString(),
  }).eq('id', runId)
  if (error) console.error('email-automation-tick run update error:', error)
}

async function finishRun(
  runId: string | null,
  status: RunStatus,
  counts: RunCounts,
  errorCode: string | null = null,
  errorDetail: string | null = null,
) {
  await updateRun(runId, {
    status,
    finished_at: new Date().toISOString(),
    ...counts,
    error_code: errorCode,
    error_message: errorDetail ? errorDetail.slice(0, 2000) : null,
  })
}

async function startRun(body: TickBody) {
  const startedAt = new Date().toISOString()
  const trigger = String(body.trigger || (body.run_id ? 'requested' : 'legacy')).slice(0, 64)

  if (body.run_id) {
    const { data, error } = await db.from('email_automation_runs').update({
      status: 'running',
      started_at: startedAt,
      updated_at: startedAt,
      error_code: null,
      error_message: null,
    }).eq('id', body.run_id).select('id').maybeSingle()
    if (error) throw new TickError('RUN_UPDATE_FAILED', error.message)
    if (!data) throw new TickError('RUN_NOT_FOUND', `Execução ${body.run_id} não encontrada.`)
    return body.run_id
  }

  // Compatibilidade com chamadas antigas que enviam apenas `{}` ou nenhum
  // corpo: cria o run aqui e processa normalmente.
  const { data, error } = await db.from('email_automation_runs').insert({
    automation_id: body.automation_id || null,
    trigger,
    status: 'running',
    started_at: startedAt,
  }).select('id').single()
  if (error) throw new TickError('RUN_CREATE_FAILED', error.message)
  return data.id as string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: TickBody = {}
  let runId: string | null = null
  const counts: RunCounts = { processados: 0, enviados: 0, falhas: 0, cancelados: 0, ignorados: 0 }
  let confirmationPending = 0

  try {
    const rawBody = await req.text()
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody)
      } catch {
        return json({ error: 'invalid_json', message: 'O corpo da requisição não contém JSON válido.' }, 400)
      }
    }

    const { data: cfg, error: cfgError } = await db.from('email_config')
      .select('*')
      .eq('ativo', true)
      .order('atualizado_em', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    if (cfgError) {
      await finishRun(body.run_id || null, 'failed', counts, 'EMAIL_CONFIG_QUERY_FAILED', cfgError.message)
      return json({ error: 'email_config_query_failed', message: cfgError.message }, 500)
    }
    if (!cfg?.automation_secret || req.headers.get('x-automation-secret') !== cfg.automation_secret) {
      return json({ error: 'not_authenticated' }, 401)
    }

    runId = await startRun(body)

    if (!cfg.api_key || !cfg.remetente_email) {
      const message = 'Configure uma API key do Resend e um email remetente antes de iniciar campanhas.'
      await finishRun(runId, 'skipped', counts, 'EMAIL_NOT_CONFIGURED', message)
      return json({ ok: false, run_id: runId, status: 'skipped', error: 'email_not_configured', message }, 503)
    }

    let automacoesQuery = db.from('email_automations').select('id').eq('ativo', true)
    if (body.automation_id) automacoesQuery = automacoesQuery.eq('id', body.automation_id)
    const { data: automacoesAtivas, error: automacoesError } = await automacoesQuery
    if (automacoesError) throw new TickError('AUTOMATIONS_QUERY_FAILED', automacoesError.message)
    const idsAtivos = (automacoesAtivas || []).map(a => a.id)
    if (!idsAtivos.length) {
      const message = body.automation_id
        ? 'A campanha solicitada não existe ou está pausada.'
        : 'Nenhuma campanha ativa encontrada.'
      await finishRun(runId, 'skipped', counts, 'NO_ACTIVE_AUTOMATION', message)
      return json({ ok: true, run_id: runId, status: 'skipped', processados: 0, motivo: message })
    }

    const { data: claimed, error: claimError } = await db.rpc('fn_claim_email_automation_envios', {
      p_automation_ids: idsAtivos,
      p_limit: BATCH_SIZE,
      p_min_scheduled_for: body.automation_id
        ? null
        : new Date(Date.now() - CRON_MAX_OVERDUE_MS).toISOString(),
    })
    if (claimError) throw new TickError('PENDING_SENDS_CLAIM_FAILED', claimError.message)

    const claimedIds = (claimed || []).map(e => e.id)
    if (!claimedIds.length) {
      await finishRun(runId, 'skipped', counts, null, 'Nenhum envio pendente e vencido foi encontrado.')
      return json({ ok: true, run_id: runId, status: 'skipped', processados: 0 })
    }

    const { data: envios, error: enviosError } = await db
      .from('email_automation_envios')
      .select('*, email_automation_steps(*), email_automation_enrollments(*)')
      .in('id', claimedIds)
      .order('scheduled_for', { ascending: true })

    if (enviosError) throw new TickError('CLAIMED_SENDS_QUERY_FAILED', enviosError.message)
    if (!envios || envios.length !== claimedIds.length) {
      throw new TickError(
        'CLAIMED_SENDS_QUERY_INCOMPLETE',
        `Foram reservados ${claimedIds.length} envio(s), mas somente ${envios?.length || 0} puderam ser carregados.`,
      )
    }
    counts.processados = envios.length

    const leadIds = [...new Set(envios.map(e => e.lead_id).filter(Boolean))]
    const { data: leads, error: leadsError } = leadIds.length
      ? await db.from('leads').select('*').in('id', leadIds)
      : { data: [], error: null }
    if (leadsError) throw new TickError('LEADS_QUERY_FAILED', leadsError.message)
    const leadById = new Map((leads || []).map(l => [l.id, l]))

    const intervaloSegundos = cfg.ia_intervalo_segundos || 60
    let geracoesIa = 0

    for (let i = 0; i < envios.length; i++) {
      const envio = envios[i]
      const step = envio.email_automation_steps
      const enrollment = envio.email_automation_enrollments
      const lead = leadById.get(envio.lead_id)

      // 'pausado': lead respondeu, automação espera — não cancela o envio
      // (ele volta a pendente e será elegível quando a matrícula for retomada).
      if (enrollment?.status === 'pausado') {
        counts.ignorados++
        const { error } = await db.from('email_automation_envios').update({
          status: 'pendente', processando_em: null,
        }).eq('id', envio.id).eq('status', 'processando')
        if (error) throw new TickError('PAUSED_SEND_RELEASE_FAILED', error.message)
        continue
      }

      if (enrollment?.status !== 'ativo' || !lead || lead.email_opt_out) {
        counts.cancelados++
        const { error } = await db.from('email_automation_envios').update({
          status: 'cancelado', processando_em: null,
        }).eq('id', envio.id)
        if (error) throw new TickError('CANCEL_SEND_UPDATE_FAILED', error.message)
        continue
      }

      try {
        let assunto: string
        let corpoHtml: string
        let promptIa: string | null = null

        // Um lease retomado precisa repetir exatamente o payload previamente
        // enviado para que a Idempotency-Key do Resend seja válida.
        if (envio.assunto_gerado && envio.corpo_gerado) {
          assunto = envio.assunto_gerado
          corpoHtml = envio.corpo_gerado
          promptIa = envio.prompt_ia || null
        } else if (step.usar_ia) {
          if (geracoesIa > 0) await new Promise(r => setTimeout(r, PAUSA_ENTRE_GERACOES_MS))
          geracoesIa++
          if (!cfg.ia_api_key) throw { mensagem: 'Defina a chave da API de IA em Configurações > Email.' }
          const assuntoFixo = step.gerar_assunto_ia === false ? personalizar(step.assunto || '', lead) : null
          const gerado = await gerarEmailComIA(cfg.ia_api_key, cfg.ia_modelo || 'gemini-2.0-flash', cfg.ia_diretrizes || null, step.ia_objetivo || '', lead, assuntoFixo)
          assunto = gerado.assunto
          corpoHtml = gerado.corpo_html
          promptIa = gerado.prompt
        } else {
          assunto = personalizar(step.assunto || '', lead)
          corpoHtml = personalizar(step.corpo_html || '', lead)
        }

        // Margem mínima a partir de agora (não de quando o índice i foi calculado),
        // já que a geração por IA leva alguns segundos e o Resend exige scheduled_at futuro.
        const scheduledAt = envio.provider_scheduled_at
          || new Date(Date.now() + i * intervaloSegundos * 1000 + 10_000).toISOString()
        const idempotencyKey = envio.provider_idempotency_key
          || `email-automation-${envio.id}-${envio.tentativas || 1}`
        const storedPayload = envio.provider_payload
          && typeof envio.provider_payload === 'object'
          && !Array.isArray(envio.provider_payload)
          ? envio.provider_payload as Record<string, unknown>
          : null

        let payload: Record<string, unknown>
        let messageId: string
        let html: string

        if (storedPayload) {
          // Uma resposta ambígua é repetida com corpo e chave idênticos; isso
          // permite ao Resend devolver a operação original sem duplicar email.
          payload = storedPayload
          const storedHeaders = payload.headers && typeof payload.headers === 'object'
            ? payload.headers as Record<string, unknown>
            : {}
          messageId = String(storedHeaders['Message-ID'] || gerarMessageId('auto', envio.id, cfg.remetente_email))
          html = String(payload.html || corpoHtml)
        } else {
          messageId = gerarMessageId('auto', envio.id, cfg.remetente_email)
          const unsubLink = linkDescadastro(SUPABASE_URL, { automationId: envio.automation_id }, lead.id)
          html = comRodape(corpoHtml, cfg.remetente_nome, unsubLink)
          payload = {
            from: `${cfg.remetente_nome || ''} <${cfg.remetente_email}>`.trim(),
            to: lead.email,
            subject: assunto,
            html,
            scheduled_at: scheduledAt,
            headers: {
              'List-Unsubscribe': `<${unsubLink}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              'Message-ID': messageId,
            },
          }
          if (step.responder_para) payload.reply_to = step.responder_para
          else if (cfg.caixa_respostas_email) payload.reply_to = cfg.caixa_respostas_email
          if (step.cc?.length) payload.cc = step.cc
          if (step.cco?.length) payload.bcc = step.cco
          const anexos = (step.anexos || []).filter((a: any) => a?.url).map((a: any) => ({ filename: a.filename || 'anexo', path: a.url }))
          if (anexos.length) payload.attachments = anexos
        }

        const { error: preparationError } = await db.from('email_automation_envios').update({
          assunto_gerado: assunto,
          corpo_gerado: corpoHtml,
          prompt_ia: promptIa,
          provider_scheduled_at: scheduledAt,
          provider_payload: payload,
          provider_idempotency_key: idempotencyKey,
        }).eq('id', envio.id).eq('status', 'processando')
        if (preparationError) throw new TickError('SEND_PREPARATION_PERSIST_FAILED', preparationError.message)

        let res: Response
        try {
          res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cfg.api_key}`,
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify(payload),
          })
        } catch (providerError) {
          throw new ProviderAcceptedPersistenceError(
            'PROVIDER_RESPONSE_UNKNOWN',
            `Não foi possível confirmar a resposta do Resend para ${envio.id}: ${errorMessage(providerError)}`,
          )
        }

        if (res.ok) {
          const result = await res.json().catch(() => ({}))
          const { error: sentUpdateError } = await db.from('email_automation_envios').update({
            status: 'enviado', enviado_em: new Date().toISOString(), resend_id: result.id || null,
            assunto_gerado: assunto, corpo_gerado: corpoHtml, prompt_ia: promptIa, processando_em: null,
          }).eq('id', envio.id)
          if (sentUpdateError) {
            throw new ProviderAcceptedPersistenceError(
              'PROVIDER_ACCEPTED_PERSISTENCE_FAILED',
              `O Resend aceitou o envio ${envio.id}, mas a confirmação local falhou: ${sentUpdateError.message}`,
            )
          }
          counts.enviados++
          // A cópia na caixa de entrada é secundária: uma falha aqui nunca
          // pode rebaixar para "falhou" um email já aceito pelo provedor.
          try {
            await registrarEnvioNaConversa(db, {
              leadId: lead.id, remetenteEmail: cfg.remetente_email, destinatarioEmail: lead.email,
              assunto, corpoHtml: html, messageId, resendId: result.id || null, automationEnvioId: envio.id,
            })
          } catch (conversationError) {
            console.error('email-automation-tick conversation copy error:', conversationError)
          }
        } else {
          const result = await res.json().catch(() => ({}))
          if (res.status === 409) {
            throw new ProviderAcceptedPersistenceError(
              'PROVIDER_IDEMPOTENCY_CONFLICT',
              `O Resend informou conflito de idempotência para ${envio.id}. Verifique o envio no provedor antes de qualquer nova tentativa.`,
            )
          }
          const { error: failedUpdateError } = await db.from('email_automation_envios').update({
            status: 'falhou',
            erro: `Resend: ${res.status} ${result.message || JSON.stringify(result)}`.slice(0, 2000),
            assunto_gerado: assunto, corpo_gerado: corpoHtml, prompt_ia: promptIa, processando_em: null,
            provider_scheduled_at: null, provider_payload: null, provider_idempotency_key: null,
          }).eq('id', envio.id)
          if (failedUpdateError) throw new TickError('FAILED_SEND_UPDATE_FAILED', failedUpdateError.message)
          counts.falhas++
        }
      } catch (err: any) {
        if (err instanceof ProviderAcceptedPersistenceError) {
          confirmationPending++
          counts.falhas++
          const { error: uncertainPersistError } = await db.from('email_automation_envios').update({
            status: 'confirmacao_pendente', erro: err.message.slice(0, 2000), processando_em: null,
          }).eq('id', envio.id)
          if (uncertainPersistError) {
            throw new TickError('UNCERTAIN_SEND_PERSIST_FAILED', `${err.message}; persistência: ${uncertainPersistError.message}`)
          }
          continue
        }
        counts.falhas++
        const mensagem = err?.mensagem ? String(err.mensagem) : String(err?.message || err).slice(0, 2000)
        const { error: failurePersistError } = await db.from('email_automation_envios').update({
          status: 'falhou', erro: mensagem, prompt_ia: err?.prompt || null, processando_em: null,
          provider_scheduled_at: null, provider_payload: null, provider_idempotency_key: null,
        }).eq('id', envio.id)
        if (failurePersistError) {
          throw new TickError('SEND_FAILURE_PERSIST_FAILED', `${mensagem}; persistência: ${failurePersistError.message}`)
        }
      }

      const { count: pendentes, error: pendingCountError } = await db.from('email_automation_envios').select('id', { count: 'exact', head: true })
        .eq('enrollment_id', envio.enrollment_id).in('status', ['pendente', 'processando', 'confirmacao_pendente'])
      if (pendingCountError) throw new TickError('ENROLLMENT_PENDING_COUNT_FAILED', pendingCountError.message)
      if (!pendentes) {
        const { error: enrollmentUpdateError } = await db.from('email_automation_enrollments').update({ status: 'concluido' }).eq('id', envio.enrollment_id)
        if (enrollmentUpdateError) throw new TickError('ENROLLMENT_UPDATE_FAILED', enrollmentUpdateError.message)
      }
    }

    // Uma solicitação manual para uma campanha percorre toda a fila em lotes,
    // sem depender do cron global. A RPC apenas enfileira o próximo lote no
    // pg_net, portanto esta execução não fica aguardando recursivamente.
    let continuationError: string | null = null
    if (body.automation_id && envios.length === BATCH_SIZE) {
      const { error } = await db.rpc('fn_request_email_automation_tick', {
        p_automation_id: body.automation_id,
        p_trigger: 'continuation',
      })
      if (error) continuationError = error.message
    }

    const hasIssues = counts.falhas > 0 || Boolean(continuationError)
    const status: RunStatus = hasIssues
      ? (counts.enviados > 0 || counts.cancelados > 0 ? 'partial' : 'failed')
      : (counts.ignorados === envios.length ? 'skipped' : 'success')
    const errorCode = confirmationPending > 0
      ? 'SEND_CONFIRMATION_PENDING'
      : continuationError
        ? 'CONTINUATION_REQUEST_FAILED'
        : counts.falhas > 0 ? 'SEND_FAILURES' : null
    const errorDetail = confirmationPending > 0
      ? `${confirmationPending} envio(s) ficaram com confirmação pendente. Verifique o Resend antes de tentar reenviar.`
      : continuationError
        ? `Este lote terminou, mas o próximo não pôde ser enfileirado: ${continuationError}`
        : counts.falhas > 0 ? `${counts.falhas} envio(s) falharam nesta execução.` : null
    await finishRun(runId, status, counts, errorCode, errorDetail)

    return json({ ok: !hasIssues, run_id: runId, status, confirmation_pending: confirmationPending, ...counts })
  } catch (err: any) {
    console.error('email-automation-tick error:', err)
    const code = err instanceof TickError ? err.code : 'UNEXPECTED_WORKER_ERROR'
    const message = errorMessage(err).slice(0, 2000)
    await finishRun(runId || body.run_id || null, 'failed', counts, code, message)
    return json({ error: code.toLowerCase(), message, run_id: runId || body.run_id || null }, 500)
  }
})

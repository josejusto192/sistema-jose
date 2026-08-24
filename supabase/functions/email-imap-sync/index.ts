// Sincroniza a caixa dedicada de respostas por UID/UIDVALIDITY. O cursor e
// proprio do CRM: abrir uma mensagem no Roundcube nao interfere na importacao.
// A identidade IMAP + hash do RFC822 tornam retries e execucoes concorrentes
// idempotentes, inclusive para mensagens que nao possuem Message-ID.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ImapFlow } from 'npm:imapflow@1'
import { simpleParser } from 'npm:mailparser@3'
import { json } from '../_shared/email.ts'
import { planejarSincronizacaoImap, selecionarLoteUids } from '../_shared/imap-cursor.ts'
import { registrarLog } from '../_shared/log.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(SUPABASE_URL, SUPABASE_KEY)
const TAMANHO_LOTE = 50
const TAMANHO_MAXIMO_MENSAGEM = 20 * 1024 * 1024

type MensagemExistente = {
  id: string
  lead_id: string | null
  automation_envio_id: string | null
  campaign_envio_id: string | null
}

type ResultadoExistente = {
  mensagem: MensagemExistente
  match: 'uid' | 'hash' | 'message_id'
}

type DadosEmail = {
  remetenteEmail: string
  remetenteNome: string | null
  messageId: string | null
  inReplyTo: string | null
  assunto: string | null
  corpoTexto: string | null
  corpoHtml: string | null
}

function limparMessageId(v: string | string[] | undefined | null): string | null {
  if (!v) return null
  const raw = Array.isArray(v) ? v[v.length - 1] : v
  return raw ? String(raw).trim() : null
}

function mensagemErro(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error)
  return raw
    .replace(/((?:pass(?:word)?|senha)\s*[:=]\s*)[^\s,;]+/gi, '$1[oculto]')
    .replace(/\b(Basic|Bearer)\s+[A-Za-z0-9+/=._-]+/gi, '$1 [oculto]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^@\s/]+)@/gi, '$1[oculto]@')
    .replace(/((?:AUTH(?:ENTICATE)?|LOGIN)\s+(?:PLAIN\s+)?)[A-Za-z0-9+/=._-]+/gi, '$1[oculto]')
    .slice(0, 1500)
}

function falhaDb(contexto: string, error: any): never {
  const codigo = error?.code ? `:${error.code}` : ''
  const detalhe = String(error?.message || 'erro desconhecido').slice(0, 500)
  throw new Error(`${contexto}${codigo}: ${detalhe}`)
}

function dataIso(value: unknown) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function dadosDoEnvelope(envelope: any): Omit<DadosEmail, 'corpoTexto' | 'corpoHtml'> {
  const remetente = envelope?.from?.[0]
  return {
    remetenteEmail: String(remetente?.address || '').toLowerCase().trim(),
    remetenteNome: remetente?.name ? String(remetente.name) : null,
    messageId: limparMessageId(envelope?.messageId),
    inReplyTo: limparMessageId(envelope?.inReplyTo),
    assunto: envelope?.subject ? String(envelope.subject) : null,
  }
}

function dadosDeConteudoIndisponivel(envelope: any, motivo: string): DadosEmail {
  return {
    ...dadosDoEnvelope(envelope),
    corpoTexto: `Mensagem recebida via IMAP, mas o conteudo nao foi carregado (${motivo}). Consulte o original no servidor de email.`,
    corpoHtml: null,
  }
}

async function sha256Hex(source: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(source))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function buscarExistente(args: {
  configId: string
  accountFingerprint: string
  mailboxPath: string
  uidValidity: string
  uid: number
  sourceHash: string | null
  messageId: string | null
}): Promise<ResultadoExistente | null> {
  const campos = 'id, lead_id, automation_envio_id, campaign_envio_id'
  const porUid = await db.from('email_conversas_mensagens')
    .select(campos)
    .eq('direction', 'inbound')
    .eq('imap_config_id', args.configId)
    .eq('imap_account_fingerprint', args.accountFingerprint)
    .eq('imap_mailbox_path', args.mailboxPath)
    .eq('imap_uid_validity', args.uidValidity)
    .eq('imap_uid', args.uid)
    .limit(1)
    .maybeSingle()
  if (porUid.error) falhaDb('imap_dedupe_uid_failed', porUid.error)
  if (porUid.data) return { mensagem: porUid.data as MensagemExistente, match: 'uid' }

  if (args.sourceHash) {
    const porHash = await db.from('email_conversas_mensagens')
      .select(campos)
      .eq('direction', 'inbound')
      .eq('imap_config_id', args.configId)
      .eq('imap_account_fingerprint', args.accountFingerprint)
      .eq('imap_source_sha256', args.sourceHash)
      .limit(1)
      .maybeSingle()
    if (porHash.error) falhaDb('imap_dedupe_hash_failed', porHash.error)
    if (porHash.data) return { mensagem: porHash.data as MensagemExistente, match: 'hash' }
  }

  if (args.messageId) {
    const porMessageId = await db.from('email_conversas_mensagens')
      .select(campos)
      .eq('direction', 'inbound')
      .eq('message_id', args.messageId)
      .limit(1)
      .maybeSingle()
    if (porMessageId.error) falhaDb('imap_dedupe_message_id_failed', porMessageId.error)
    if (porMessageId.data) return { mensagem: porMessageId.data as MensagemExistente, match: 'message_id' }
  }

  return null
}

async function pausarAutomacaoSeNecessario(
  automationEnvioId: string | null,
  remetenteEmail: string,
  assunto: string | null,
) {
  if (!automationEnvioId) return false

  const envioResult = await db.from('email_automation_envios')
    .select('enrollment_id')
    .eq('id', automationEnvioId)
    .limit(1)
    .maybeSingle()
  if (envioResult.error) falhaDb('imap_automation_lookup_failed', envioResult.error)
  if (!envioResult.data?.enrollment_id) return false

  const pauseResult = await db.from('email_automation_enrollments')
    .update({ status: 'pausado' })
    .eq('id', envioResult.data.enrollment_id)
    .eq('status', 'ativo')
    .select('id')
  if (pauseResult.error) falhaDb('imap_automation_pause_failed', pauseResult.error)
  if (!pauseResult.data?.length) return false

  await registrarLog(db, {
    acao: 'pausar',
    tabela: 'email_automation_enrollments',
    registroId: envioResult.data.enrollment_id,
    detalhes: { motivo: 'resposta_recebida', remetente: remetenteEmail || null, assunto },
    usuarioNome: 'Sincronização de Email (IMAP)',
  })
  return true
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let configId: string | null = null
  let leaseToken: string | null = null
  let leaseObtido = false
  let pastaAtual: string | null = null
  let uidAtual: number | null = null

  try {
    const cfgResult = await db.from('email_config')
      .select('*')
      .eq('ativo', true)
      .order('atualizado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (cfgResult.error) falhaDb('imap_config_lookup_failed', cfgResult.error)
    const cfg = cfgResult.data

    if (!cfg?.automation_secret || req.headers.get('x-automation-secret') !== cfg.automation_secret) {
      return json({ error: 'not_authenticated' }, 401)
    }
    if (!cfg.imap_host || !cfg.imap_user || !cfg.imap_password) {
      return json({ ok: true, processados: 0, importados: 0, motivo: 'IMAP não configurado' })
    }

    configId = cfg.id
    const accountFingerprint = await sha256Hex(new TextEncoder().encode([
      String(cfg.imap_host).trim().toLowerCase(),
      String(cfg.imap_port || 993),
      String(cfg.imap_user).trim().toLowerCase(),
    ].join('\n')))
    leaseToken = crypto.randomUUID()
    const claimResult = await db.rpc('fn_claim_email_imap_sync', {
      p_email_config_id: configId,
      p_lease_token: leaseToken,
      p_ttl_seconds: 600,
    })
    if (claimResult.error) falhaDb('imap_lease_claim_failed', claimResult.error)
    if (!claimResult.data) {
      return json({ ok: true, processados: 0, importados: 0, motivo: 'sincronizacao_em_andamento' })
    }
    leaseObtido = true

    const client = new ImapFlow({
      host: cfg.imap_host,
      port: cfg.imap_port || 993,
      secure: true,
      auth: { user: cfg.imap_user, pass: cfg.imap_password },
      logger: false,
    })

    let processados = 0
    let importados = 0
    let duplicados = 0
    let pausados = 0
    let pendentes = 0
    let conteudosParciais = 0
    const pastas: Array<Record<string, unknown>> = []

    async function confirmarCursor(mailboxPath: string, uidValidity: string, lastUid: number) {
      const result = await db.rpc('fn_commit_email_imap_cursor', {
        p_email_config_id: configId,
        p_lease_token: leaseToken,
        p_account_fingerprint: accountFingerprint,
        p_mailbox_path: mailboxPath,
        p_uid_validity: uidValidity,
        p_last_uid: lastUid,
      })
      if (result.error) falhaDb('imap_cursor_commit_failed', result.error)
    }

    async function processarPasta(mailboxPath: string, pasta: 'inbox' | 'spam') {
      pastaAtual = mailboxPath
      uidAtual = null
      const lock = await client.getMailboxLock(mailboxPath, { readOnly: true })
      try {
        if (!client.mailbox) throw new Error(`imap_mailbox_not_open:${mailboxPath}`)

        const cursorResult = await db.from('email_imap_cursors')
          .select('uid_validity, last_uid')
          .eq('email_config_id', configId)
          .eq('account_fingerprint', accountFingerprint)
          .eq('mailbox_path', mailboxPath)
          .limit(1)
          .maybeSingle()
        if (cursorResult.error) falhaDb('imap_cursor_lookup_failed', cursorResult.error)

        const plan = planejarSincronizacaoImap(cursorResult.data, {
          uidValidity: client.mailbox.uidValidity,
          uidNext: client.mailbox.uidNext,
        })

        if (plan.firstUid > plan.highWaterUid) {
          await confirmarCursor(mailboxPath, plan.uidValidity, plan.highWaterUid)
          pastas.push({ pasta, mailboxPath, uidValidity: plan.uidValidity, encontrados: 0, importados: 0, pendentes: 0, reset: plan.reset })
          return
        }

        const searchResult = await client.search(
          { uid: `${plan.firstUid}:${plan.highWaterUid}` },
          { uid: true },
        )
        if (searchResult === false) throw new Error(`imap_search_failed:${mailboxPath}`)
        const lote = selecionarLoteUids(searchResult, plan, TAMANHO_LOTE)
        const importadosAntes = importados
        const conteudosParciaisAntes = conteudosParciais

        // Primeiro buscamos apenas metadados. Os corpos completos sao baixados
        // sequencialmente para limitar memoria, sobretudo quando ha anexos.
        const mensagens = lote.uids.length
          ? await client.fetchAll(lote.uids, {
            uid: true,
            size: true,
            envelope: true,
            internalDate: true,
          }, { uid: true })
          : []

        const uidsRetornados = new Set(mensagens.map(msg => Number(msg.uid)))
        const uidsAusentes = lote.uids.filter(uid => !uidsRetornados.has(uid))
        if (uidsAusentes.length) {
          throw new Error(`imap_fetch_partial:${mailboxPath}:${uidsAusentes.join(',')}`)
        }

        mensagens.sort((a, b) => a.uid - b.uid)
        for (const metadata of mensagens) {
          uidAtual = metadata.uid
          processados++
          let sourceHash: string | null = null
          let dados: DadosEmail

          if (Number(metadata.size || 0) > TAMANHO_MAXIMO_MENSAGEM) {
            conteudosParciais++
            dados = dadosDeConteudoIndisponivel(metadata.envelope, 'mensagem acima do limite de 20 MB')
          } else {
            const msg = await client.fetchOne(metadata.uid, {
              uid: true,
              source: true,
              envelope: true,
              internalDate: true,
              size: true,
            }, { uid: true })
            if (!msg || Number(msg.uid) !== Number(metadata.uid)) {
              throw new Error(`imap_fetch_one_failed:${mailboxPath}:${metadata.uid}`)
            }

            if (!msg.source) {
              conteudosParciais++
              dados = dadosDeConteudoIndisponivel(msg.envelope || metadata.envelope, 'fonte RFC822 indisponivel')
            } else {
              const source = new Uint8Array(msg.source)
              sourceHash = await sha256Hex(source)
              try {
                const parsed = await simpleParser(msg.source as any)
                dados = {
                  remetenteEmail: (parsed.from?.value?.[0]?.address || '').toLowerCase().trim(),
                  remetenteNome: parsed.from?.value?.[0]?.name || null,
                  messageId: limparMessageId(parsed.messageId),
                  inReplyTo: limparMessageId(parsed.inReplyTo) || limparMessageId(parsed.references as any),
                  assunto: parsed.subject || null,
                  corpoTexto: parsed.text || null,
                  corpoHtml: typeof parsed.html === 'string' ? parsed.html : null,
                }
              } catch {
                conteudosParciais++
                dados = dadosDeConteudoIndisponivel(msg.envelope || metadata.envelope, 'formato da mensagem invalido')
              }
            }
          }

          const {
            remetenteEmail,
            remetenteNome,
            messageId,
            inReplyTo,
            assunto,
            corpoTexto,
            corpoHtml,
          } = dados

          const identidade = {
            configId: configId!,
            accountFingerprint,
            mailboxPath,
            uidValidity: plan.uidValidity,
            uid: metadata.uid,
            sourceHash,
            messageId,
          }
          let existente = await buscarExistente(identidade)
          if (existente) {
            duplicados++
            // Reaplica o efeito apenas quando e o mesmo UID ainda sem cursor
            // confirmado (ex.: crash entre insert e pause). Match historico
            // por hash/Message-ID nao pode pausar novamente uma conversa.
            if (pasta === 'inbox' && existente.match === 'uid'
              && await pausarAutomacaoSeNecessario(existente.mensagem.automation_envio_id, remetenteEmail, assunto)) pausados++
            await confirmarCursor(mailboxPath, plan.uidValidity, metadata.uid)
            continue
          }

          let leadId: string | null = null
          let automationEnvioId: string | null = null
          let campaignEnvioId: string | null = null

          if (inReplyTo) {
            const originalResult = await db.from('email_conversas_mensagens')
              .select('lead_id, automation_envio_id, campaign_envio_id')
              .eq('message_id', inReplyTo)
              .limit(1)
              .maybeSingle()
            if (originalResult.error) falhaDb('imap_original_lookup_failed', originalResult.error)
            if (originalResult.data) {
              leadId = originalResult.data.lead_id
              automationEnvioId = originalResult.data.automation_envio_id
              campaignEnvioId = originalResult.data.campaign_envio_id
            }
          }

          if (!leadId && remetenteEmail) {
            const leadResult = await db.from('leads')
              .select('id')
              .eq('email', remetenteEmail)
              .limit(1)
              .maybeSingle()
            if (leadResult.error) falhaDb('imap_lead_lookup_failed', leadResult.error)
            if (leadResult.data) leadId = leadResult.data.id
          }

          const insertResult = await db.from('email_conversas_mensagens').insert({
            lead_id: leadId,
            contato_email: leadId ? null : remetenteEmail || null,
            contato_nome: leadId ? null : remetenteNome,
            direction: 'inbound',
            remetente_email: remetenteEmail || 'desconhecido',
            destinatario_email: cfg.imap_user,
            assunto,
            corpo_texto: corpoTexto,
            corpo_html: corpoHtml,
            message_id: messageId,
            in_reply_to: inReplyTo,
            automation_envio_id: automationEnvioId,
            campaign_envio_id: campaignEnvioId,
            pasta,
            lida_pelo_agente: false,
            created_at: dataIso(metadata.internalDate) || new Date().toISOString(),
            imap_config_id: configId,
            imap_account_fingerprint: accountFingerprint,
            imap_mailbox_path: mailboxPath,
            imap_uid_validity: plan.uidValidity,
            imap_uid: metadata.uid,
            imap_source_sha256: sourceHash,
          }).select('id, lead_id, automation_envio_id, campaign_envio_id').single()

          if (insertResult.error) {
            if (insertResult.error.code === '23505') existente = await buscarExistente(identidade)
            if (!existente) falhaDb('imap_message_insert_failed', insertResult.error)
            duplicados++
            if (pasta === 'inbox' && existente.match === 'uid'
              && await pausarAutomacaoSeNecessario(existente.mensagem.automation_envio_id, remetenteEmail, assunto)) pausados++
            await confirmarCursor(mailboxPath, plan.uidValidity, metadata.uid)
            continue
          }

          importados++
          await registrarLog(db, {
            acao: 'receber',
            tabela: 'email_conversas_mensagens',
            registroId: insertResult.data.id,
            detalhes: { remetente: remetenteEmail || null, assunto, pasta },
            usuarioNome: 'Sincronização de Email (IMAP)',
          })

          if (pasta === 'inbox' && await pausarAutomacaoSeNecessario(automationEnvioId, remetenteEmail, assunto)) pausados++
          // Cada UID concluido vira um checkpoint. Se a Edge Function atingir
          // o limite de tempo no meio de um lote pesado, o proximo ciclo
          // retoma da mensagem seguinte em vez de recomecar as 50.
          await confirmarCursor(mailboxPath, plan.uidValidity, metadata.uid)
        }

        await confirmarCursor(mailboxPath, plan.uidValidity, lote.confirmarAte)
        pendentes += lote.pendentes
        pastas.push({
          pasta,
          mailboxPath,
          uidValidity: plan.uidValidity,
          encontrados: mensagens.length,
          importados: importados - importadosAntes,
          pendentes: lote.pendentes,
          conteudosParciais: conteudosParciais - conteudosParciaisAntes,
          reset: plan.reset,
          cursor: lote.confirmarAte,
        })
      } finally {
        lock.release()
      }
    }

    await client.connect()
    try {
      await processarPasta('INBOX', 'inbox')

      const mailboxes = await client.list()
      const spamPaths = [...new Set(mailboxes
        .filter(mailbox => mailbox.path !== 'INBOX' && (
          String(mailbox.specialUse || '').toLowerCase() === '\\junk'
          || /(^|[./])(?:junk|spam)(?:$|[./])/i.test(mailbox.path)
        ))
        .map(mailbox => mailbox.path))]
      for (const spamPath of spamPaths) await processarPasta(spamPath, 'spam')
    } finally {
      await client.logout().catch(() => {})
    }

    const resultado = { ok: true, processados, importados, duplicados, pausados, pendentes, conteudosParciais, pastas }
    const statusResult = await db.from('email_config').update({
      imap_ultimo_sync_em: new Date().toISOString(),
      imap_ultimo_erro: null,
      imap_ultimo_resultado: resultado,
    }).eq('id', configId)
    if (statusResult.error) falhaDb('imap_status_update_failed', statusResult.error)

    return json(resultado)
  } catch (error) {
    const detalheBase = mensagemErro(error)
    const contexto = pastaAtual ? ` [pasta=${pastaAtual}${uidAtual ? ` uid=${uidAtual}` : ''}]` : ''
    const detalhe = `${detalheBase}${contexto}`.slice(0, 1500)
    console.error('email-imap-sync error:', detalhe)
    if (configId) {
      const statusResult = await db.from('email_config').update({
        imap_ultimo_erro: detalhe,
        imap_ultimo_resultado: { ok: false, erro: detalhe, em: new Date().toISOString() },
      }).eq('id', configId)
      if (statusResult.error) console.error('email-imap-sync status error:', statusResult.error)
    }
    return json({ error: 'imap_sync_failed', detalhe }, 500)
  } finally {
    if (leaseObtido && configId && leaseToken) {
      const releaseResult = await db.rpc('fn_release_email_imap_sync', {
        p_email_config_id: configId,
        p_lease_token: leaseToken,
      })
      if (releaseResult.error) console.error('email-imap-sync release error:', releaseResult.error)
    }
  }
})

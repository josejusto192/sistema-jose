// Lê a caixa de email dedicada a respostas (IMAP, fora do Resend) e grava
// cada mensagem nova em email_conversas_mensagens, casando com o envio
// original (campanha ou automação) pelo header Message-ID/In-Reply-To.
// Quando a resposta pertence a uma automação em andamento, pausa o
// enrollment (não cancela — só para de avançar a sequência até alguém
// continuar manualmente pela Caixa de Entrada de Email).
// Remetente sem lead/envio anterior associado entra mesmo assim na conversa
// (thread_key = email da outra ponta, lead_id fica nulo) — qualquer um que
// iniciar contato precisa aparecer na Caixa de Entrada, não só quem já é lead.
// Também varre a pasta de spam da caixa (quando existir), marcando pasta='spam'.
// Chamada periodicamente (mesmo esquema do email-automation-tick) via
// pg_cron, autenticada por x-automation-secret.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ImapFlow } from 'npm:imapflow@1'
import { simpleParser } from 'npm:mailparser@3'
import { json } from '../_shared/email.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

function limparMessageId(v: string | string[] | undefined | null): string | null {
  if (!v) return null
  const raw = Array.isArray(v) ? v[v.length - 1] : v
  return raw ? String(raw).trim() : null
}

serve(async (req) => {
  try {
    const { data: cfg } = await db.from('email_config').select('*').eq('ativo', true).limit(1).maybeSingle()
    if (!cfg?.automation_secret || req.headers.get('x-automation-secret') !== cfg.automation_secret) {
      return json({ error: 'not_authenticated' }, 401)
    }
    if (!cfg.imap_host || !cfg.imap_user || !cfg.imap_password) {
      return json({ ok: true, processados: 0, motivo: 'IMAP não configurado' })
    }

    const client = new ImapFlow({
      host: cfg.imap_host,
      port: cfg.imap_port || 993,
      secure: true,
      auth: { user: cfg.imap_user, pass: cfg.imap_password },
      logger: false,
    })

    await client.connect()
    let processados = 0
    let pausados = 0

    async function processarPasta(mailboxPath: string, pasta: 'inbox' | 'spam') {
      const lock = await client.getMailboxLock(mailboxPath)
      const uidsProcessados: number[] = []
      try {
        for await (const msg of client.fetch({ seen: false }, { source: true, envelope: true, uid: true })) {
          processados++
          const parsed = await simpleParser(msg.source as Buffer)

          const remetenteEmail = (parsed.from?.value?.[0]?.address || '').toLowerCase().trim()
          const remetenteNome = parsed.from?.value?.[0]?.name || null
          const messageId = limparMessageId(parsed.messageId)
          const inReplyTo = limparMessageId(parsed.inReplyTo) || limparMessageId(parsed.references as any)

          // Defesa contra reprocessar a mesma mensagem (ex: marcação de \Seen
          // não persistiu no servidor por algum motivo) — sem isso, ela
          // duplicava na conversa a cada novo ciclo do cron.
          if (messageId) {
            const { data: jaExiste } = await db.from('email_conversas_mensagens')
              .select('id').eq('message_id', messageId).eq('direction', 'inbound').maybeSingle()
            if (jaExiste) {
              uidsProcessados.push(msg.uid)
              continue
            }
          }

          // Acha o envio original pelo Message-ID que nós mesmos geramos
          // (gerarMessageId em _shared/email.ts) — é o jeito confiável de
          // saber qual automação/campanha/lead gerou essa resposta.
          let leadId: string | null = null
          let automationEnvioId: string | null = null
          let campaignEnvioId: string | null = null

          if (inReplyTo) {
            const { data: original } = await db
              .from('email_conversas_mensagens')
              .select('lead_id, automation_envio_id, campaign_envio_id')
              .eq('message_id', inReplyTo)
              .maybeSingle()
            if (original) {
              leadId = original.lead_id
              automationEnvioId = original.automation_envio_id
              campaignEnvioId = original.campaign_envio_id
            }
          }

          if (!leadId && remetenteEmail) {
            const { data: lead } = await db.from('leads').select('id').eq('email', remetenteEmail).maybeSingle()
            if (lead) leadId = lead.id
          }

          // Mesmo sem lead/envio anterior, a mensagem entra na conversa
          // (thread_key cai no fallback do email da outra ponta, via trigger).
          await db.from('email_conversas_mensagens').insert({
            lead_id: leadId,
            contato_email: leadId ? null : remetenteEmail || null,
            contato_nome: leadId ? null : remetenteNome,
            direction: 'inbound',
            remetente_email: remetenteEmail || 'desconhecido',
            destinatario_email: cfg.imap_user,
            assunto: parsed.subject || null,
            corpo_texto: parsed.text || null,
            corpo_html: parsed.html || null,
            message_id: messageId,
            in_reply_to: inReplyTo,
            automation_envio_id: automationEnvioId,
            campaign_envio_id: campaignEnvioId,
            pasta,
            lida_pelo_agente: false,
          })

          if (pasta === 'inbox' && automationEnvioId) {
            const { data: envio } = await db.from('email_automation_envios').select('enrollment_id').eq('id', automationEnvioId).maybeSingle()
            if (envio?.enrollment_id) {
              const { count } = await db.from('email_automation_enrollments')
                .update({ status: 'pausado' })
                .eq('id', envio.enrollment_id)
                .eq('status', 'ativo')
                .select('id', { count: 'exact', head: true })
              if (count) pausados++
            }
          }

          uidsProcessados.push(msg.uid)
        }
      } finally {
        // Marca \Seen depois de fechar o FETCH (em lote, fora do loop) —
        // fazer isso intercalado com o fetch ativo é o que estava deixando
        // a marcação não persistir em alguns servidores, causando reprocesso.
        if (uidsProcessados.length) {
          await client.messageFlagsAdd(uidsProcessados, ['\\Seen'], { uid: true }).catch((e) => console.error('messageFlagsAdd falhou:', e))
        }
        lock.release()
      }
    }

    try {
      await processarPasta('INBOX', 'inbox')

      // Nome da pasta de spam varia por provedor (cPanel/Horde costuma usar
      // INBOX.Junk). Detecta dinamicamente em vez de fixar um nome.
      const mailboxes = await client.list()
      const pastaSpam = mailboxes.find((m) => /junk|spam/i.test(m.path))
      if (pastaSpam) {
        await processarPasta(pastaSpam.path, 'spam')
      }
    } finally {
      await client.logout().catch(() => {})
    }

    await db.from('email_config').update({ imap_ultimo_sync_em: new Date().toISOString() }).eq('id', cfg.id)

    return json({ ok: true, processados, pausados })
  } catch (err) {
    console.error('email-imap-sync error:', err)
    return json({ error: String(err) }, 500)
  }
})

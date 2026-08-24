export type ImapCursor = {
  uid_validity: string | number
  last_uid: string | number
} | null

export type ImapSyncPlan = {
  uidValidity: string
  highWaterUid: number
  lastUid: number
  firstUid: number
  reset: boolean
}

function inteiroSeguro(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback
}

// UID só é comparável dentro da mesma geração UIDVALIDITY. Quando o servidor
// troca essa geração, voltamos ao início e deixamos os índices idempotentes
// impedirem que mensagens antigas sejam duplicadas.
export function planejarSincronizacaoImap(
  cursor: ImapCursor,
  mailbox: { uidValidity: bigint | string | number; uidNext?: number | null },
): ImapSyncPlan {
  const uidValidityNumber = Number(mailbox.uidValidity)
  const uidNext = Number(mailbox.uidNext)
  if (!Number.isSafeInteger(uidValidityNumber) || uidValidityNumber <= 0) {
    throw new Error('imap_uidvalidity_invalid')
  }
  if (!Number.isSafeInteger(uidNext) || uidNext < 1) {
    throw new Error('imap_uidnext_invalid')
  }
  const uidValidity = String(uidValidityNumber)
  const highWaterUid = uidNext - 1
  const mesmaGeracao = !!cursor && String(cursor.uid_validity) === uidValidity
  const lastUid = mesmaGeracao ? inteiroSeguro(cursor?.last_uid) : 0

  return {
    uidValidity,
    highWaterUid,
    lastUid,
    firstUid: lastUid + 1,
    reset: !!cursor && !mesmaGeracao,
  }
}

export function selecionarLoteUids(
  values: unknown,
  plan: ImapSyncPlan,
  limit = 50,
) {
  const max = Math.max(1, Math.min(inteiroSeguro(limit, 50), 200))
  const todos = Array.isArray(values)
    ? [...new Set(values
      .map(uid => inteiroSeguro(uid, -1))
      .filter(uid => uid >= plan.firstUid && uid <= plan.highWaterUid))]
      .sort((a, b) => a - b)
    : []
  const uids = todos.slice(0, max)
  const temMais = todos.length > uids.length

  return {
    uids,
    temMais,
    pendentes: Math.max(0, todos.length - uids.length),
    // Se todos os UIDs encontrados couberam no lote, também podemos avançar
    // sobre gaps causados por mensagens expurgadas.
    confirmarAte: temMais ? uids[uids.length - 1] : plan.highWaterUid,
  }
}

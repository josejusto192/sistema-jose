import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { planejarSincronizacaoImap, selecionarLoteUids } from '../supabase/functions/_shared/imap-cursor.ts'

test('continua do ultimo UID quando UIDVALIDITY nao mudou', () => {
  const plan = planejarSincronizacaoImap(
    { uid_validity: '9001', last_uid: 10 },
    { uidValidity: 9001n, uidNext: 13 },
  )

  assert.deepEqual(plan, {
    uidValidity: '9001',
    highWaterUid: 12,
    lastUid: 10,
    firstUid: 11,
    reset: false,
  })
})

test('reinicia o cursor quando UIDVALIDITY muda', () => {
  const plan = planejarSincronizacaoImap(
    { uid_validity: '1', last_uid: 500 },
    { uidValidity: 2n, uidNext: 4 },
  )

  assert.equal(plan.firstUid, 1)
  assert.equal(plan.highWaterUid, 3)
  assert.equal(plan.reset, true)
})

test('seleciona UIDs em ordem, remove repetidos e respeita o lote', () => {
  const plan = planejarSincronizacaoImap(null, { uidValidity: 7n, uidNext: 20 })
  const batch = selecionarLoteUids([8, 2, 3, 2, 22, 4], plan, 3)

  assert.deepEqual(batch.uids, [2, 3, 4])
  assert.equal(batch.temMais, true)
  assert.equal(batch.confirmarAte, 4)
})

test('avanca ate o high-water quando so existem gaps ou o lote terminou', () => {
  const plan = planejarSincronizacaoImap(
    { uid_validity: '8', last_uid: 10 },
    { uidValidity: 8n, uidNext: 21 },
  )

  assert.equal(selecionarLoteUids([], plan).confirmarAte, 20)
  assert.equal(selecionarLoteUids([15], plan).confirmarAte, 20)
})

test('o worker nao usa mais a flag de lida como cursor', async () => {
  const worker = await readFile(
    new URL('../supabase/functions/email-imap-sync/index.ts', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(worker, /seen\s*:\s*false/)
  assert.doesNotMatch(worker, /messageFlagsAdd/)
  assert.match(worker, /client\.search\([\s\S]*uid:/)
})

test('baixa metadados em lote e somente um corpo completo por vez', async () => {
  const worker = await readFile(
    new URL('../supabase/functions/email-imap-sync/index.ts', import.meta.url),
    'utf8',
  )
  const fetchAll = worker.match(/client\.fetchAll\([\s\S]*?\}, \{ uid: true \}\)/)?.[0] || ''

  assert.ok(fetchAll, 'chamada fetchAll nao encontrada')
  assert.doesNotMatch(fetchAll, /source\s*:\s*true/)
  assert.match(worker, /client\.fetchOne\([\s\S]*?source\s*:\s*true/)
  assert.match(worker, /TAMANHO_MAXIMO_MENSAGEM/)
})

test('nao avanca o cursor quando o servidor devolve um lote parcial', async () => {
  const worker = await readFile(
    new URL('../supabase/functions/email-imap-sync/index.ts', import.meta.url),
    'utf8',
  )

  assert.match(worker, /uidsAusentes[\s\S]*throw new Error\(`imap_fetch_partial/)
})

test('salva checkpoint por UID para retomar lotes interrompidos', async () => {
  const worker = await readFile(
    new URL('../supabase/functions/email-imap-sync/index.ts', import.meta.url),
    'utf8',
  )

  assert.match(worker, /for \(const metadata of mensagens\)[\s\S]*confirmarCursor\(mailboxPath, plan\.uidValidity, metadata\.uid\)/)
})

test('migration cerca o commit do cursor com o lease atual', async () => {
  const migration = await readFile(
    new URL('../migrations/038_email_imap_uid_cursor.sql', import.meta.url),
    'utf8',
  )

  assert.match(migration, /lease_token = p_lease_token[\s\S]*FOR UPDATE;/)
  assert.match(migration, /THEN GREATEST\(current_cursor\.last_uid, EXCLUDED\.last_uid\)/)
  assert.doesNotMatch(migration, /pg_catalog\.greatest/i)
})

test('rejeita UIDVALIDITY e UIDNEXT invalidos antes de processar mensagens', () => {
  assert.throws(
    () => planejarSincronizacaoImap(null, { uidValidity: 0, uidNext: 2 }),
    /imap_uidvalidity_invalid/,
  )
  assert.throws(
    () => planejarSincronizacaoImap(null, { uidValidity: 2, uidNext: 0 }),
    /imap_uidnext_invalid/,
  )
})

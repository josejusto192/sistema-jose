// Normalização de números de telefone brasileiros para casar
// o contato do WhatsApp com o campo "telefone" cadastrado no CRM.
//
// Estratégia: reduzir qualquer formato para "DDD + 8 dígitos" (sem o 9º
// dígito do celular), que é o núcleo estável do número. Tanto o número
// vindo do WhatsApp quanto o vindo do banco passam pela mesma função,
// então o "9" extra ou a falta dele não importa na comparação.

/**
 * @param {string} raw - número em qualquer formato (com DDI, DDD, 9, traços, etc.)
 * @returns {string|null} - DDD (2 dígitos) + 8 dígitos, ou null se inválido
 */
function normalizePhone(raw) {
  if (!raw) return null
  let digits = String(raw).replace(/\D/g, '')
  if (!digits) return null

  // Remove código do país (55) quando o número for longo demais
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2)
  }

  // Remove zero de discagem local, se houver (ex: 0XX...)
  if (digits.length === 12 && digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  // Agora esperamos 10 (fixo: DDD + 8) ou 11 (celular: DDD + 9 + 8) dígitos
  if (digits.length < 10) return null

  const ddd = digits.slice(0, 2)
  let number = digits.slice(2)

  // Celular com 9 dígitos: remove o 9º dígito (nono) para virar o "núcleo" de 8
  if (number.length === 9 && number.startsWith('9')) {
    number = number.slice(1)
  }

  if (number.length !== 8) return null

  return ddd + number
}

/**
 * Extrai o número de telefone (formato WhatsApp, ex: 5511999999999) a partir
 * de um JID/data-id do WhatsApp Web (ex: "true_5511999999999@c.us_ABC123" ou
 * "5511999999999@c.us").
 * @param {string} jid
 * @returns {string|null}
 */
function phoneFromJid(jid) {
  if (!jid) return null
  const match = jid.match(/(\d{8,15})@c\.us/)
  return match ? match[1] : null
}

/**
 * Formata um número canônico (DDD+8) para exibição amigável.
 * @param {string} canon
 * @returns {string}
 */
function formatCanonPhone(canon) {
  if (!canon || canon.length !== 10) return canon || ''
  const ddd = canon.slice(0, 2)
  const num = canon.slice(2)
  return `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`
}

/**
 * Converte um telefone canônico (DDD+8) para o formato usado pelo link
 * "click to chat" do WhatsApp: 55 + DDD + 9 + 8 dígitos.
 * @param {string} canon
 * @returns {string|null}
 */
function toWhatsappNumber(canon) {
  if (!canon || canon.length !== 10) return null
  const ddd = canon.slice(0, 2)
  const number = canon.slice(2)
  return `55${ddd}9${number}`
}

// Exporta para uso no content script (escopo global) e no service worker (module)
if (typeof module !== 'undefined') {
  module.exports = { normalizePhone, phoneFromJid, formatCanonPhone, toWhatsappNumber }
}

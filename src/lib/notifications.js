import { supabase } from '../supabase.js'

// Sends a push notification to one or more users via the Edge Function.
// userIds: string[] — if omitted, sends to ALL subscribed users (superadmin only).
export async function sendPush({ userIds, title, body, url = '/', tag }) {
  try {
    await supabase.functions.invoke('send-push', {
      body: { user_ids: userIds ?? null, title, body, url, tag },
    })
  } catch (err) {
    console.warn('sendPush failed:', err)
  }
}

// Helpers for specific events
export const notify = {
  novoLead: (nome, adminIds) =>
    sendPush({
      userIds: adminIds,
      title: '🟢 Novo lead adicionado',
      body: nome,
      url: '/?view=leads',
      tag: 'novo-lead',
    }),

  leadFechou: (nome, recipientIds) =>
    sendPush({
      userIds: recipientIds,
      title: '🏆 Lead fechado!',
      body: nome,
      url: '/?view=leads',
      tag: 'lead-fechou',
    }),

  comissaoPaga: (vendedorId, clienteNome, valor) =>
    sendPush({
      userIds: [vendedorId],
      title: '💰 Comissão paga!',
      body: `${clienteNome} — R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      url: '/?view=desempenho',
      tag: 'comissao-paga',
    }),

  followupAlert: (count) =>
    sendPush({
      title: '⏰ Follow-up pendente',
      body: `${count} lead${count > 1 ? 's' : ''} sem atualização há 3+ dias`,
      url: '/?view=leads&status=followup',
      tag: 'followup',
    }),
}

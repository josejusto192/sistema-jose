import { supabase } from '../supabase.js'

export async function sendPush({ userIds, title, body, url = '/', tag, type }) {
  try {
    await supabase.functions.invoke('send-push', {
      body: { user_ids: userIds ?? null, title, body, url, tag, type },
    })
  } catch (err) {
    console.warn('sendPush failed:', err)
  }
}

export const notify = {
  novoLead: (nome, adminIds) =>
    sendPush({
      userIds: adminIds,
      title: '🟢 Novo lead adicionado',
      body: nome,
      url: '/?view=leads',
      tag: 'novo-lead',
      type: 'novo_lead',
    }),

  leadFechou: (nome, recipientIds) =>
    sendPush({
      userIds: recipientIds,
      title: '🏆 Lead fechado!',
      body: nome,
      url: '/?view=leads',
      tag: 'lead-fechou',
      type: 'lead_fechou',
    }),

  comissaoPaga: (vendedorId, clienteNome, valor) =>
    sendPush({
      userIds: [vendedorId],
      title: '💰 Comissão paga!',
      body: `${clienteNome} — R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      url: '/?view=desempenho',
      tag: 'comissao-paga',
      type: 'comissao_paga',
    }),

  followupAlert: (count, userIds) =>
    sendPush({
      userIds,
      title: '⏰ Follow-up pendente',
      body: `${count} lead${count > 1 ? 's' : ''} sem atualização há 3+ dias`,
      url: '/?view=leads',
      tag: 'followup',
      type: 'followup',
    }),
}

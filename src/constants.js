// Display name for any lead (empresa or pessoa)
export function leadName(lead) {
  if (!lead) return '—'
  if (lead.tipo === 'pessoa') {
    const n = [lead.nome, lead.sobrenome].filter(Boolean).join(' ')
    return n || lead.nome_fantasia || lead.razao_social || '—'
  }
  return lead.nome_fantasia || lead.razao_social || '—'
}

export const STATUS_CONFIG = {
  novo:             { label: 'Novo',             dot: '#3B82F6', color: '#1D4ED8', bg: '#EFF6FF',  darkColor: '#60A5FA', darkBg: '#1E3A5F' },
  contatado:        { label: 'Contatado',        dot: '#F59E0B', color: '#B45309', bg: '#FFFBEB',  darkColor: '#FCD34D', darkBg: '#2D1F00' },
  aguardando:       { label: 'Aguardando',       dot: '#8B5CF6', color: '#6D28D9', bg: '#F5F3FF',  darkColor: '#A78BFA', darkBg: '#1E1040' },
  respondeu:        { label: 'Respondeu',        dot: '#06B6D4', color: '#0E7490', bg: '#ECFEFF',  darkColor: '#22D3EE', darkBg: '#062028' },
  call_agendada:    { label: 'Call agendada',    dot: '#10B981', color: '#065F46', bg: '#ECFDF5',  darkColor: '#34D399', darkBg: '#052E16' },
  call_realizada:   { label: 'Call realizada',   dot: '#10B981', color: '#065F46', bg: '#ECFDF5',  darkColor: '#6EE7B7', darkBg: '#052E16' },
  proposta_enviada: { label: 'Proposta enviada', dot: '#F59E0B', color: '#B45309', bg: '#FFFBEB',  darkColor: '#FCD34D', darkBg: '#2D1A00' },
  fechou:           { label: 'Fechou',           dot: '#10B981', color: '#065F46', bg: '#ECFDF5',  darkColor: '#34D399', darkBg: '#052E16' },
  perdido:          { label: 'Perdido',          dot: '#EF4444', color: '#B91C1C', bg: '#FEF2F2',  darkColor: '#F87171', darkBg: '#2D0A0A' },
  descartado:       { label: 'Descartado',       dot: '#9CA3AF', color: '#4B5563', bg: '#F3F4F6',  darkColor: '#6B7280', darkBg: '#1F2937' },
}

export const CANAL_CONFIG = {
  whatsapp: { label: 'WhatsApp', icon: '📱' },
  email:    { label: 'E-mail',   icon: '📧' },
  instagram:{ label: 'Instagram',icon: '📸' },
  ligacao:  { label: 'Ligação',  icon: '📞' },
}

export const PORTE_COLORS = {
  'Micro Empresa':  '#2563EB',
  'ME':             '#2563EB',
  'Pequena Empresa':'#7C3AED',
  'EPP':            '#7C3AED',
  'Demais':         '#6B7280',
  'MEI':            '#059669',
}

export const PACOTES = {
  estrutura_digital: {
    label: 'Estrutura Digital',
    descricao: 'Landing Page + configuração Meta Ads',
    tipo: 'unico',
    valor: 1997,
    color: '#2563EB',
    bg: '#EFF6FF',
    darkColor: '#60A5FA',
    darkBg: '#1E3A5F',
    dot: '#3B82F6',
  },
  gestao_trafego: {
    label: 'Gestão de Tráfego',
    descricao: 'Gestão mensal de campanhas Meta Ads',
    tipo: 'recorrente',
    valor: 997,
    fidelidade: 3,
    color: '#059669',
    bg: '#ECFDF5',
    darkColor: '#34D399',
    darkBg: '#052E16',
    dot: '#10B981',
  },
}

export const CONTRATO_STATUS = {
  ativo:                { label: 'Ativo',               dot: '#10B981', color: '#065F46', bg: '#ECFDF5', darkColor: '#34D399', darkBg: '#052E16' },
  aguardando_pagamento: { label: 'Aguard. pagamento',   dot: '#F59E0B', color: '#B45309', bg: '#FFFBEB', darkColor: '#FCD34D', darkBg: '#2D1A00' },
  concluido:            { label: 'Concluído',           dot: '#3B82F6', color: '#1D4ED8', bg: '#EFF6FF', darkColor: '#60A5FA', darkBg: '#1E3A5F' },
  cancelado:            { label: 'Cancelado',           dot: '#EF4444', color: '#B91C1C', bg: '#FEF2F2', darkColor: '#F87171', darkBg: '#2D0A0A' },
}

// Nome do lead é substituído dinamicamente no componente
export const SCRIPTS = [
  {
    id: 'wp_sem_site',
    canal: 'whatsapp',
    titulo: 'WhatsApp — Prospecção inicial',
    texto: `Oi, [Nome]! Tudo bem? 👋

Sou o José, trabalho com criação de sites e gestão de anúncios para empresas.

Vi que vocês ainda não têm uma página própria na internet — isso faz perder clientes que pesquisam online antes de fechar negócio.

Tenho uma ideia pra [Empresa], posso mostrar em 15 minutos? 🤝`,
  },
  {
    id: 'wp_followup1',
    canal: 'whatsapp',
    titulo: 'WhatsApp — Follow-up (3 dias)',
    texto: `Oi [Nome], tudo bem? 😊

Só passando pra ver se viu minha mensagem anterior.

Se quiser, posso mandar uma prévia do que pensei pra [Empresa] direto aqui no WhatsApp, sem precisar de call 👀`,
  },
  {
    id: 'wp_followup2',
    canal: 'whatsapp',
    titulo: 'WhatsApp — Follow-up final (7 dias)',
    texto: `Oi [Nome]! Última tentativa — sei que é corrido por aí 😅

Se um dia tiver interesse em melhorar a captação de clientes online, é só me chamar. Fico à disposição!

Um abraço 🤝`,
  },
  {
    id: 'ig_dm',
    canal: 'instagram',
    titulo: 'Instagram — DM inicial',
    texto: `Oi [Nome]! Vi o perfil de vocês aqui no Instagram 👀

Sou o José, especialista em sites e anúncios para empresas. Já esbocei como ficaria uma página profissional pra [Empresa].

Posso te mostrar em 15 min essa semana?`,
  },
  {
    id: 'proposta_ed',
    canal: 'whatsapp',
    titulo: 'Proposta — Estrutura Digital',
    texto: `[Nome], preparei a proposta pra [Empresa]! 🎯

📌 *Pacote Estrutura Digital — R$ 1.997*
✅ Landing Page profissional (WordPress)
✅ Configuração completa Meta Ads
✅ Criativos para os anúncios
✅ Entrega em 5 dias úteis
✅ 30 dias de suporte incluído

💳 Pagamento: 50% na assinatura + 50% na entrega

Topam uma call rápida de 20 min pra eu apresentar? 🤝`,
  },
  {
    id: 'proposta_gt',
    canal: 'whatsapp',
    titulo: 'Proposta — Gestão de Tráfego',
    texto: `[Nome], segue minha proposta para gestão dos anúncios de [Empresa]! 🚀

📌 *Gestão de Tráfego Mensal — R$ 997/mês*
✅ Gestão de até 2 campanhas no Meta Ads
✅ Otimização semanal
✅ Criativos para os anúncios
✅ Relatório mensal detalhado
✅ Reunião mensal de resultado

📋 Fidelidade mínima: 3 meses
💡 Verba de anúncios à parte (mínimo recomendado: R$ 800/mês)

Vamos marcar uma call? 🤝`,
  },
]

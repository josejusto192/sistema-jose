import React, { useState } from 'react'

const STEPS = [
  {
    icon: '👋',
    title: 'Bem-vindo ao Justo Mídias CRM!',
    content: (
      <div>
        <p style={{ margin: '0 0 12px', lineHeight: 1.6, color: 'var(--text2)', fontSize: 14 }}>
          O Justo Mídias CRM é o sistema de gestão de vendas da sua equipe. Aqui você acompanha seus leads, fecha contratos e monitora suas comissões — tudo em um só lugar.
        </p>
        <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text2)', fontSize: 14 }}>
          Vamos te mostrar o que você pode fazer em menos de 2 minutos.
        </p>
      </div>
    ),
  },
  {
    icon: '🎯',
    title: 'Seus Leads',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { icon: '📋', label: 'Pipeline visual', desc: 'Veja todos os seus leads organizados por etapa de venda — de prospecção ao fechamento.' },
          { icon: '🔍', label: 'Busca rápida', desc: 'Use a barra de busca ou pressione "/" para encontrar qualquer lead instantaneamente.' },
          { icon: '📌', label: 'Tarefas e follow-ups', desc: 'Crie lembretes e agendamentos direto na ficha do lead para não perder nenhum contato.' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{item.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: '📝',
    title: 'Contratos & Comissões',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { icon: '💼', label: 'Contratos', desc: 'Ao fechar uma venda, crie o contrato diretamente pelo lead. Faça upload do comprovante de pagamento.' },
          { icon: '💰', label: 'Desempenho', desc: 'Acompanhe suas comissões, metas mensais e histórico de vendas na aba Desempenho.' },
          { icon: '📅', label: 'Agenda', desc: 'Visualize todas as suas tarefas e compromissos em um calendário integrado.' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{item.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: '🚀',
    title: 'Configure seu perfil',
    content: (
      <div>
        <p style={{ margin: '0 0 16px', lineHeight: 1.6, color: 'var(--text2)', fontSize: 14 }}>
          Antes de começar, complete suas informações no <strong>Perfil</strong> — foto, telefone, WhatsApp e chave PIX para receber comissões.
        </p>
        <div style={{ padding: '14px 16px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 24 }}>💡</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
            Clique no seu nome no menu lateral, ou acesse <strong style={{ color: 'var(--text2)' }}>Perfil</strong>, para atualizar seus dados a qualquer momento.
          </div>
        </div>
      </div>
    ),
  },
]

export default function OnboardingModal({ userId, onClose }) {
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  function handleNext() {
    if (isLast) finish()
    else setStep(s => s + 1)
  }

  function finish() {
    localStorage.setItem('tilim_onboarding_done_' + userId, '1')
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 460, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', animation: 'fadeIn 0.2s ease', overflow: 'hidden' }}>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--border)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s ease', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ padding: '28px 28px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{current.icon}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{current.title}</div>
        </div>

        {/* Body */}
        <div style={{ padding: '0 28px 28px' }}>
          {current.content}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Step dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{ width: i === step ? 20 : 7, height: 7, borderRadius: 4, background: i === step ? 'var(--accent)' : 'var(--border)', transition: 'all 0.25s ease', cursor: 'pointer' }}
                onClick={() => setStep(i)}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isLast && (
              <button
                onClick={finish}
                style={{ padding: '7px 14px', borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Pular
              </button>
            )}
            <button
              onClick={handleNext}
              style={{ padding: '8px 22px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {isLast ? 'Começar' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

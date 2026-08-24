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
      className="overlay-backdrop"
      role="presentation"
    >
      <div className="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">

        {/* Progress bar */}
        <div className="onboarding-progress">
          <div className="onboarding-progress-bar" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        {/* Header */}
        <div className="onboarding-header">
          <div className="onboarding-icon" aria-hidden="true">{current.icon}</div>
          <div id="onboarding-title" className="onboarding-title">{current.title}</div>
        </div>

        {/* Body */}
        <div className="onboarding-body">
          {current.content}
        </div>

        {/* Footer */}
        <div className="onboarding-footer">
          {/* Step dots */}
          <div className="onboarding-dots" aria-label={`Etapa ${step + 1} de ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`onboarding-dot${i === step ? ' is-active' : ''}`}
                onClick={() => setStep(i)}
                aria-label={`Ir para etapa ${i + 1}`}
                aria-current={i === step ? 'step' : undefined}
              />
            ))}
          </div>

          <div className="onboarding-actions">
            {!isLast && (
              <button
                type="button"
                onClick={finish}
                className="onboarding-skip"
              >
                Pular
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="onboarding-next"
            >
              {isLast ? 'Começar' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

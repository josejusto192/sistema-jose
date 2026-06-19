import React, { useState } from 'react'
import { IconInbox, IconWhatsApp, IconSearch } from './Icons.jsx'

// Canais suportados. Por enquanto só o WhatsApp está ativo — Instagram e os
// próximos entram aqui conforme as integrações forem ficando prontas.
const CANAIS = [
  { id: 'whatsapp',  label: 'WhatsApp',  Icon: IconWhatsApp, color: '#25D366', ativo: true },
  { id: 'instagram', label: 'Instagram', Icon: IconInbox,    color: '#E1306C', ativo: false },
]

export default function CaixaEntrada() {
  const [canal, setCanal] = useState('whatsapp')
  const [busca, setBusca] = useState('')
  const canalAtual = CANAIS.find(c => c.id === canal)

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Coluna: canais + lista de conversas */}
      <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg2)' }}>
        <div style={{ padding: '18px 18px 12px' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Caixa de Entrada</h2>
        </div>

        {/* Abas de canal */}
        <div style={{ display: 'flex', gap: 6, padding: '0 14px 12px' }}>
          {CANAIS.map(c => (
            <button
              key={c.id}
              onClick={() => c.ativo && setCanal(c.id)}
              disabled={!c.ativo}
              title={c.ativo ? c.label : `${c.label} — em breve`}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '7px 0', borderRadius: 8, border: '1px solid var(--border)',
                background: canal === c.id ? 'var(--accent)' : 'var(--bg3)',
                color: canal === c.id ? '#fff' : c.ativo ? 'var(--text2)' : 'var(--text3)',
                fontSize: 12, fontWeight: 600, cursor: c.ativo ? 'pointer' : 'not-allowed',
                opacity: c.ativo ? 1 : 0.55,
              }}
            >
              <c.Icon size={13} color={canal === c.id ? '#fff' : c.color} />
              {c.label}
              {!c.ativo && <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 2 }}>(em breve)</span>}
            </button>
          ))}
        </div>

        {/* Busca */}
        <div style={{ padding: '0 14px 12px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
              <IconSearch size={13} color="var(--text3)" />
            </span>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar conversa..."
              style={{
                width: '100%', padding: '8px 12px 8px 30px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg3)',
                color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Lista de conversas (vazio até a integração entrar no ar) */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
            <IconInbox size={36} color="var(--border2, var(--border))" />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginTop: 12 }}>Nenhuma conversa ainda</div>
            <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
              As conversas do {canalAtual?.label} vão aparecer aqui assim que a integração for conectada.
            </div>
          </div>
        </div>
      </div>

      {/* Painel da conversa selecionada */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center', maxWidth: 360, padding: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <IconWhatsApp size={26} color="#25D366" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Caixa de Entrada do WhatsApp</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
            Em breve você vai poder responder seus leads por aqui, direto da API oficial do WhatsApp Business — sem precisar abrir o WhatsApp Web.
          </div>
        </div>
      </div>
    </div>
  )
}

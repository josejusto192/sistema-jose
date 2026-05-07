import React, { useState } from 'react'
import { STATUS_CONFIG } from '../constants.js'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.novo
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

export default function Leads({ empresas, loading, searchQuery, setSearchQuery, statusFilter, setStatusFilter, onOpenLead, onUpdateEmpresa, totalCount }) {
  const [quickStatus, setQuickStatus] = useState(null)

  async function handleStatusChange(empresa, newStatus, e) {
    e.stopPropagation()
    await onUpdateEmpresa(empresa.id, { status_prospeccao: newStatus })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.5px' }}>Leads</h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20 }}>
            {empresas.length} / {totalCount}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Buscar por nome, CNPJ, cidade, segmento..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 36px',
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
                color: 'var(--text)', fontSize: 13, outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 14 }}>⌕</span>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px', background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="todos">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* Status tabs rápidos */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {['todos', 'novo', 'contatado', 'respondeu', 'call_agendada', 'fechou', 'perdido'].map(s => {
            const cfg = STATUS_CONFIG[s]
            const isActive = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: 11, cursor: 'pointer',
                  background: isActive ? (cfg?.bg || 'var(--bg4)') : 'var(--bg2)',
                  color: isActive ? (cfg?.color || 'var(--text)') : 'var(--text3)',
                  fontWeight: isActive ? 500 : 400,
                  border: isActive ? `1px solid ${cfg?.color || 'var(--border2)'}` : '1px solid var(--border)',
                }}
              >
                {cfg?.label || 'Todos'}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 28px 28px' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>carregando...</div>
        ) : empresas.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
            <div style={{ fontSize: 14 }}>Nenhum lead encontrado</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Ajuste os filtros ou aguarde novos webhooks</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', marginTop: 12 }}>
            <thead>
              <tr>
                {['Empresa', 'CNPJ', 'Cidade/UF', 'Segmento', 'Contato', 'Abertura', 'Status', 'Ação'].map(h => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empresas.map((e, i) => {
                const cfg = STATUS_CONFIG[e.status_prospeccao] || STATUS_CONFIG.novo
                return (
                  <tr
                    key={e.id}
                    onClick={() => onOpenLead(e)}
                    style={{ cursor: 'pointer', animation: `fadeIn 0.2s ease ${i * 0.02}s both` }}
                    onMouseEnter={el => {
                      el.currentTarget.querySelectorAll('td').forEach(td => td.style.background = 'var(--bg3)')
                    }}
                    onMouseLeave={el => {
                      el.currentTarget.querySelectorAll('td').forEach(td => td.style.background = 'var(--bg2)')
                    }}
                  >
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: '8px 0 0 8px', maxWidth: 200 }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.nome_fantasia || e.razao_social}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
                        {e.eh_mei ? '🟢 MEI' : e.porte_descricao || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                        {e.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{e.municipio}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>{e.uf}</div>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)', maxWidth: 180 }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.cnae_principal_descricao || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {e.email && <span title={e.email} style={{ fontSize: 14 }}>📧</span>}
                        {e.telefone && <span title={e.telefone} style={{ fontSize: 14 }}>📱</span>}
                        {!e.email && !e.telefone && <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                        {e.data_abertura ? format(new Date(e.data_abertura), 'dd/MM/yy') : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)' }}>
                      <StatusBadge status={e.status_prospeccao} />
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: '0 8px 8px 0' }}>
                      <select
                        value={e.status_prospeccao || 'novo'}
                        onChange={ev => handleStatusChange(e, ev.target.value, ev)}
                        onClick={ev => ev.stopPropagation()}
                        style={{
                          background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6,
                          color: 'var(--text2)', fontSize: 11, padding: '3px 6px', cursor: 'pointer', outline: 'none',
                        }}
                      >
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key}>{cfg.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

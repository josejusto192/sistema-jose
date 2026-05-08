import React, { useState, useMemo } from 'react'
import { STATUS_CONFIG } from '../constants.js'
import { useTheme } from '../App.jsx'
import { format, differenceInDays } from 'date-fns'

const FOLLOWUP_STATUSES = ['contatado', 'aguardando', 'respondeu', 'proposta_enviada']
const FOLLOWUP_DAYS = 3

function needsFollowup(e) {
  if (!FOLLOWUP_STATUSES.includes(e.status_prospeccao)) return false
  const ref = e.atualizado_em || e.criado_em
  if (!ref) return false
  return differenceInDays(new Date(), new Date(ref)) >= FOLLOWUP_DAYS
}

function StatusBadge({ status }) {
  const theme = useTheme()
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.novo
  const style = theme === 'dark'
    ? { background: cfg.darkBg, color: cfg.darkColor }
    : { background: cfg.bg, color: cfg.color }
  return (
    <span className="badge" style={style}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

const SORT_COLS = {
  nome:        (a, b) => (a.nome_fantasia || a.razao_social || '').localeCompare(b.nome_fantasia || b.razao_social || ''),
  municipio:   (a, b) => (a.municipio || '').localeCompare(b.municipio || ''),
  abertura:    (a, b) => (a.data_abertura || '').localeCompare(b.data_abertura || ''),
  status:      (a, b) => (a.status_prospeccao || '').localeCompare(b.status_prospeccao || ''),
  criado_em:   (a, b) => (a.criado_em || '').localeCompare(b.criado_em || ''),
}

function SortHeader({ label, col, sortField, sortDir, onSort, style: extraStyle }) {
  const active = sortField === col
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: '6px 12px', textAlign: 'left', fontSize: 11, color: active ? 'var(--accent)' : 'var(--text3)',
        fontWeight: active ? 600 : 500, letterSpacing: 0.3, cursor: 'pointer', userSelect: 'none',
        whiteSpace: 'nowrap', ...extraStyle,
      }}
    >
      {label}
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3 }}>
        {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  )
}

export default function Leads({ empresas, loading, searchQuery, setSearchQuery, statusFilter, setStatusFilter, onOpenLead, onUpdateEmpresa, totalCount }) {
  const [sortField, setSortField] = useState('criado_em')
  const [sortDir, setSortDir] = useState('desc')

  function handleSort(col) {
    if (sortField === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(col)
      setSortDir('asc')
    }
  }

  async function handleStatusChange(empresa, newStatus, e) {
    e.stopPropagation()
    await onUpdateEmpresa(empresa.id, { status_prospeccao: newStatus })
  }

  const followupCount = useMemo(() => empresas.filter(needsFollowup).length, [empresas])

  const sorted = useMemo(() => {
    const fn = SORT_COLS[sortField]
    if (!fn) return empresas
    return [...empresas].sort((a, b) => sortDir === 'asc' ? fn(a, b) : fn(b, a))
  }, [empresas, sortField, sortDir])

  const statusTabs = ['todos', 'novo', 'contatado', 'respondeu', 'call_agendada', 'fechou', 'perdido']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h1 style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.3px', color: 'var(--text)' }}>Leads</h1>
          <span style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20 }}>
            {empresas.length} / {totalCount}
          </span>
          {followupCount > 0 && (
            <span style={{ fontSize: 12, background: '#FFFBEB', color: '#B45309', border: '1px solid #F59E0B60', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
              ⏰ {followupCount} precisam de atenção
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Buscar por nome, CNPJ, cidade, segmento..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 15 }}>⌕</span>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
          >
            <option value="todos">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {statusTabs.map(s => {
            const cfg = STATUS_CONFIG[s]
            const isActive = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '4px 12px', borderRadius: 20, border: '1px solid',
                  fontSize: 12, cursor: 'pointer', fontWeight: isActive ? 500 : 400,
                  background: isActive ? (cfg?.bg || 'var(--bg4)') : 'transparent',
                  color: isActive ? (cfg?.color || 'var(--text)') : 'var(--text3)',
                  borderColor: isActive ? `${cfg?.color || 'var(--accent)'}60` : 'var(--border)',
                  transition: 'all 0.1s',
                }}
              >
                {cfg?.label || 'Todos'}
              </button>
            )
          })}
          {/* Tab follow-up */}
          <button
            onClick={() => setStatusFilter('followup')}
            style={{
              padding: '4px 12px', borderRadius: 20, border: '1px solid',
              fontSize: 12, cursor: 'pointer', fontWeight: statusFilter === 'followup' ? 500 : 400,
              background: statusFilter === 'followup' ? '#FFFBEB' : 'transparent',
              color: statusFilter === 'followup' ? '#B45309' : 'var(--text3)',
              borderColor: statusFilter === 'followup' ? '#F59E0B60' : 'var(--border)',
            }}
          >
            ⏰ Atenção{followupCount > 0 ? ` (${followupCount})` : ''}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 32px 32px', background: 'var(--bg)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13, animation: 'pulse 1.5s infinite' }}>Carregando...</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>○</div>
            <div style={{ fontSize: 14 }}>Nenhum lead encontrado</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Ajuste os filtros ou aguarde novos registros</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 3px', marginTop: 14 }}>
            <thead>
              <tr>
                <SortHeader label="Empresa"    col="nome"      sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>CNPJ</th>
                <SortHeader label="Cidade / UF" col="municipio" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Segmento</th>
                <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Contato</th>
                <SortHeader label="Abertura"   col="abertura"  sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Status"     col="status"    sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => {
                const atencao = needsFollowup(e)
                return (
                  <tr
                    key={e.id}
                    onClick={() => onOpenLead(e)}
                    style={{ cursor: 'pointer', animation: `fadeIn 0.2s ease ${Math.min(i, 20) * 0.015}s both` }}
                    onMouseEnter={el => el.currentTarget.querySelectorAll('td').forEach(td => td.style.background = 'var(--bg3)')}
                    onMouseLeave={el => el.currentTarget.querySelectorAll('td').forEach(td => td.style.background = 'var(--bg2)')}
                  >
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: '8px 0 0 8px', maxWidth: 200, transition: 'background 0.1s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {atencao && (
                          <span title={`Sem atualização há ${FOLLOWUP_DAYS}+ dias`} style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {e.nome_fantasia || e.razao_social}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                            {e.eh_mei ? 'MEI' : e.porte_descricao || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                        {e.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{e.municipio}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{e.uf}</div>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)', maxWidth: 180, transition: 'background 0.1s' }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.cnae_principal_descricao || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {e.email && <span title={e.email} style={{ fontSize: 14 }}>📧</span>}
                        {e.telefone && <span title={e.telefone} style={{ fontSize: 14 }}>📱</span>}
                        {!e.email && !e.telefone && <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                        {e.data_abertura ? format(new Date(e.data_abertura), 'dd/MM/yy') : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                      <StatusBadge status={e.status_prospeccao} />
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: '0 8px 8px 0', transition: 'background 0.1s' }}>
                      <select
                        value={e.status_prospeccao || 'novo'}
                        onChange={ev => handleStatusChange(e, ev.target.value, ev)}
                        onClick={ev => ev.stopPropagation()}
                        style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontSize: 11, padding: '3px 6px', cursor: 'pointer', outline: 'none' }}
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

import React, { useState, useMemo, useEffect } from 'react'
import { STATUS_CONFIG } from '../constants.js'
import { useTheme } from '../App.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { format, differenceInDays, parseISO } from 'date-fns'
import { IconSearch, IconClock, IconMail, IconPhone, IconInbox } from './Icons.jsx'

const FOLLOWUP_STATUSES = ['contatado', 'aguardando', 'respondeu', 'proposta_enviada']
const FOLLOWUP_DAYS = 3
const PER_PAGE = 20

function needsFollowup(e) {
  if (!FOLLOWUP_STATUSES.includes(e.status_prospeccao)) return false
  const ref = e.atualizado_em || e.criado_em
  if (!ref) return false
  return differenceInDays(new Date(), new Date(ref)) >= FOLLOWUP_DAYS
}

// Evita bug de timezone: datas YYYY-MM-DD são UTC; adicionar hora local
function parseDate(str) {
  if (!str) return null
  return str.includes('T') ? new Date(str) : parseISO(str + 'T12:00:00')
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
  const isMobile = useIsMobile()
  const [sortField, setSortField] = useState('criado_em')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)

  // Reset para página 1 ao mudar filtro ou busca
  useEffect(() => { setPage(1) }, [statusFilter, searchQuery])

  function handleSort(col) {
    if (sortField === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(col)
      setSortDir('asc')
    }
    setPage(1)
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

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const pageItems = sorted.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  // Usa todas as chaves de STATUS_CONFIG + 'todos' no início
  const statusTabs = ['todos', ...Object.keys(STATUS_CONFIG)]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: isMobile ? '12px 16px 10px' : '20px 32px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h1 style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.3px', color: 'var(--text)' }}>Leads</h1>
          <span style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20 }}>
            {empresas.length} / {totalCount}
          </span>
          {followupCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, background: '#FFFBEB', color: '#B45309', border: '1px solid #F59E0B60', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
              <IconClock size={12} color="#B45309" /> {followupCount} precisam de atenção
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
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', display: 'flex' }}><IconSearch size={15} color="var(--text3)" /></span>
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

        {/* Status tabs — geradas automaticamente do STATUS_CONFIG */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {statusTabs.map(s => {
            const cfg = STATUS_CONFIG[s]
            const isActive = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '3px 10px', borderRadius: 20, border: '1px solid',
                  fontSize: 11, cursor: 'pointer', fontWeight: isActive ? 500 : 400,
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
          {/* Tab follow-up especial */}
          <button
            onClick={() => setStatusFilter('followup')}
            style={{
              padding: '3px 10px', borderRadius: 20, border: '1px solid',
              fontSize: 11, cursor: 'pointer', fontWeight: statusFilter === 'followup' ? 500 : 400,
              background: statusFilter === 'followup' ? '#FFFBEB' : 'transparent',
              color: statusFilter === 'followup' ? '#B45309' : 'var(--text3)',
              borderColor: statusFilter === 'followup' ? '#F59E0B60' : 'var(--border)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconClock size={11} color={statusFilter === 'followup' ? '#B45309' : 'var(--text3)'} />
              Atenção{followupCount > 0 ? ` (${followupCount})` : ''}
            </span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '0 0 16px' : '0 32px 16px', background: 'var(--bg)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13, animation: 'pulse 1.5s infinite' }}>Carregando...</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ marginBottom: 10, opacity: 0.3 }}><IconInbox size={32} color="var(--text3)" /></div>
            <div style={{ fontSize: 14 }}>Nenhum lead encontrado</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Ajuste os filtros ou aguarde novos registros</div>
          </div>
        ) : (
          <table style={{ width: '100%', minWidth: 700, borderCollapse: 'separate', borderSpacing: '0 3px', marginTop: 14 }}>
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
              {pageItems.map((e, i) => {
                const atencao = needsFollowup(e)
                return (
                  <tr
                    key={e.id}
                    onClick={() => onOpenLead(e)}
                    style={{ cursor: 'pointer', animation: `fadeIn 0.2s ease ${Math.min(i, 15) * 0.02}s both` }}
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
                        {e.cnpj?.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') || e.cnpj}
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
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {e.email && <span title={e.email} style={{ color: 'var(--text3)', display: 'flex' }}><IconMail size={14} color="var(--text3)" /></span>}
                        {e.telefone && <span title={e.telefone} style={{ color: 'var(--text3)', display: 'flex' }}><IconPhone size={14} color="var(--text3)" /></span>}
                        {!e.email && !e.telefone && <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', background: 'var(--bg2)', transition: 'background 0.1s' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                        {e.data_abertura ? format(parseDate(e.data_abertura), 'dd/MM/yy') : '—'}
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

      {/* Paginação */}
      {!loading && sorted.length > PER_PAGE && (
        <div style={{ padding: isMobile ? '10px 16px' : '12px 32px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {((safePage - 1) * PER_PAGE) + 1}–{Math.min(safePage * PER_PAGE, sorted.length)} de {sorted.length} leads
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.4 : 1 }}
            >
              ← Anterior
            </button>
            {/* Páginas numéricas (máx 7 botões) */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '...'
                  ? <span key={`e${i}`} style={{ fontSize: 12, color: 'var(--text3)', padding: '0 4px' }}>…</span>
                  : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{
                        padding: '5px 10px', borderRadius: 6, border: '1px solid',
                        fontSize: 12, cursor: 'pointer', minWidth: 34,
                        background: safePage === p ? 'var(--accent)' : 'var(--bg3)',
                        color: safePage === p ? '#fff' : 'var(--text2)',
                        borderColor: safePage === p ? 'var(--accent)' : 'var(--border)',
                        fontWeight: safePage === p ? 500 : 400,
                      }}
                    >
                      {p}
                    </button>
                  )
              )
            }
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: safePage === totalPages ? 'not-allowed' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1 }}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

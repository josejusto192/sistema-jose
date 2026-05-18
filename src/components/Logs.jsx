import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { format } from 'date-fns'
import { IconSearch } from './Icons.jsx'

const PER_PAGE = 20

const ACAO_CONFIG = {
  criar:     { label: 'Criar',     color: '#059669', bg: '#ECFDF5' },
  atualizar: { label: 'Atualizar', color: '#2563EB', bg: '#EFF6FF' },
  deletar:   { label: 'Deletar',   color: '#B91C1C', bg: '#FEF2F2' },
  concluir:  { label: 'Concluir',  color: '#7C3AED', bg: '#F5F3FF' },
  reabrir:   { label: 'Reabrir',   color: '#0891B2', bg: '#ECFEFF' },
}

const TABELA_LABELS = {
  empresas:  'Leads',
  contratos: 'Contratos',
  tasks:     'Tarefas',
  pacotes:   'Serviços',
  perfil:    'Perfil',
  users:     'Usuários',
}

function formatDetalhes(detalhes) {
  if (!detalhes) return '—'
  if (typeof detalhes === 'string') return detalhes.slice(0, 100)
  const d = detalhes
  // Prioridade: título, nome do cliente/lead
  if (d.title)          return `"${d.title}"${d.empresa_nome ? ` · ${d.empresa_nome}` : ''}${d.due_date ? ` · ${d.due_date}` : ''}`
  if (d.nome_fantasia)  return d.nome_fantasia
  if (d.razao_social)   return d.razao_social
  if (d.cliente_nome)   return d.cliente_nome
  if (d.nome)           return [d.nome, d.sobrenome].filter(Boolean).join(' ')
  if (d.status_prospeccao) return `Status: ${d.status_prospeccao}`
  if (d.comissao_status)   return `Comissão: ${d.comissao_status}`
  if (d.count != null)     return `${d.count} registros`
  const entries = Object.entries(d).filter(([, v]) => v != null && v !== '').slice(0, 3)
  return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(' · ') || '—'
}

function AcaoBadge({ acao }) {
  const cfg = ACAO_CONFIG[acao] || { label: acao, color: 'var(--text3)', bg: 'var(--bg3)' }
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

function AccessDenied({ title }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text3)', padding: 40 }}>
      <div style={{ fontSize: 32 }}>🔒</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)' }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text3)' }}>Esta área requer permissão de superadmin.</div>
    </div>
  )
}

export default function Logs({ isSuperAdmin }) {
  const isMobile = useIsMobile()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [filterUsuario, setFilterUsuario] = useState('')
  const [filterAcao, setFilterAcao] = useState('')
  const [filterTabela, setFilterTabela] = useState('')
  const [searchText, setSearchText] = useState('')
  const [usuarios, setUsuarios] = useState([])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const from = (page - 1) * PER_PAGE
    const to = from + PER_PAGE - 1

    let query = supabase
      .from('logs')
      .select('*', { count: 'exact' })
      .order('criado_em', { ascending: false })
      .range(from, to)

    if (filterUsuario) query = query.eq('usuario_nome', filterUsuario)
    if (filterAcao)    query = query.eq('acao', filterAcao)
    if (filterTabela)  query = query.eq('tabela', filterTabela)
    if (searchText)    query = query.ilike('detalhes::text', `%${searchText}%`)

    const { data, error, count } = await query
    if (!error) {
      setLogs(data || [])
      setTotalCount(count || 0)
    }
    setLoading(false)
  }, [page, filterUsuario, filterAcao, filterTabela, searchText])

  // Fetch list of unique users for filter
  useEffect(() => {
    supabase.from('logs').select('usuario_nome').then(({ data }) => {
      if (data) {
        const unique = [...new Set(data.map(d => d.usuario_nome).filter(Boolean))]
        setUsuarios(unique)
      }
    })
  }, [])

  useEffect(() => {
    setPage(1)
  }, [filterUsuario, filterAcao, filterTabela, searchText])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  if (!isSuperAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🔒</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Acesso restrito</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Esta seção é visível apenas para superadmin.</div>
        </div>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        padding: isMobile ? '12px 16px 10px' : '20px 32px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h1 style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.3px', color: 'var(--text)' }}>Logs</h1>
          <span style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 20 }}>
            {totalCount} registros
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Busca texto */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <input
              type="text"
              placeholder="Buscar nos detalhes..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 34px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
              <IconSearch size={14} color="var(--text3)" />
            </span>
          </div>

          {/* Filtro usuário */}
          <select
            value={filterUsuario}
            onChange={e => setFilterUsuario(e.target.value)}
            style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
          >
            <option value="">Todos os usuários</option>
            {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          {/* Filtro ação */}
          <select
            value={filterAcao}
            onChange={e => setFilterAcao(e.target.value)}
            style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
          >
            <option value="">Todas as ações</option>
            {Object.entries(ACAO_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>

          {/* Filtro tabela */}
          <select
            value={filterTabela}
            onChange={e => setFilterTabela(e.target.value)}
            style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
          >
            <option value="">Todas as áreas</option>
            {Object.entries(TABELA_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '0 0 16px' : '0 32px 16px', background: 'var(--bg)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
            Nenhum log encontrado
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 3px', marginTop: 14 }}>
            <thead>
              <tr>
                {[
                  { label: 'Data/Hora', w: 140 },
                  { label: 'Usuário', w: 130 },
                  { label: 'Ação', w: 90 },
                  { label: 'Tabela', w: 100 },
                  { label: 'Detalhes', w: undefined },
                ].map(col => (
                  <th key={col.label} style={{
                    padding: '6px 12px', textAlign: 'left', fontSize: 11,
                    color: 'var(--text3)', fontWeight: 500, letterSpacing: 0.3,
                    width: col.w,
                  }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ padding: '9px 12px', background: 'var(--bg2)', borderRadius: '8px 0 0 8px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
                      {log.criado_em ? format(new Date(log.criado_em), 'dd/MM/yy HH:mm') : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', background: 'var(--bg2)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{log.usuario_nome || '—'}</span>
                  </td>
                  <td style={{ padding: '9px 12px', background: 'var(--bg2)' }}>
                    <AcaoBadge acao={log.acao} />
                  </td>
                  <td style={{ padding: '9px 12px', background: 'var(--bg2)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{TABELA_LABELS[log.tabela] || log.tabela || '—'}</span>
                  </td>
                  <td style={{ padding: '9px 12px', background: 'var(--bg2)', borderRadius: '0 8px 8px 0', maxWidth: 320 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                      {formatDetalhes(log.detalhes)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {!loading && totalPages > 1 && (
        <div style={{
          padding: isMobile ? '10px 16px' : '12px 32px',
          borderTop: '1px solid var(--border)', background: 'var(--bg2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, totalCount)} de {totalCount}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}
            >
              ← Anterior
            </button>
            <span style={{ fontSize: 12, color: 'var(--text3)', padding: '0 6px' }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

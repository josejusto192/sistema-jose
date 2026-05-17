import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'
import { STATUS_CONFIG } from '../constants.js'
import { useIsMobile } from '../hooks/useIsMobile.js'

// ─── Metric categories ───────────────────────────────────────────────────────
const CONTATOS    = ['contatado']
const EFETIVOS    = ['respondeu', 'call_agendada', 'call_realizada', 'proposta_enviada']
const FECHAMENTOS = ['fechou']
const PERDIDOS    = ['perdido', 'descartado']

// ─── Day labels PT-BR ─────────────────────────────────────────────────────────
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─── Helpers ─────────────────────────────────────────────────────────────────
function tempoRelativo(dateStr) {
  const diff = Date.now() - new Date(dateStr)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `há ${days}d`
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

function countByCategory(rows, categories) {
  return rows.filter(r => categories.includes(r.status_novo)).length
}

function Avatar({ profile, size = 36 }) {
  const initials = [profile?.nome, profile?.sobrenome]
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?'
  if (profile?.foto_url) {
    return (
      <img
        src={profile.foto_url}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 600, color: '#fff', flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 600, color: 'var(--text)',
      paddingBottom: 10, marginBottom: 14,
      borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </div>
  )
}

function PeriodLabel({ periodo }) {
  const map = { hoje: 'Hoje', '7dias': 'últimos 7 dias', mes: 'este mês', total: 'período total' }
  return map[periodo] || periodo
}

// ─── Big stat card ────────────────────────────────────────────────────────────
function StatCard({ label, value, color, periodo }) {
  return (
    <div className="card" style={{ padding: 20, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
        <PeriodLabel periodo={periodo} />
      </div>
    </div>
  )
}

// ─── Metric chip (compact, for vendor cards) ──────────────────────────────────
function MetricChip({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '5px 10px', background: 'var(--bg3)', borderRadius: 7, minWidth: 54,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

// ─── Vendor card (superadmin equipe view) ─────────────────────────────────────
function VendorCard({ profile: p, rows, isCurrentUser }) {
  const myRows = rows.filter(r => r.usuario_id === p.id)
  const contatos    = countByCategory(myRows, CONTATOS)
  const efetivos    = countByCategory(myRows, EFETIVOS)
  const fechamentos = countByCategory(myRows, FECHAMENTOS)
  const perdidos    = countByCategory(myRows, PERDIDOS)
  const fullName = [p.nome, p.sobrenome].filter(Boolean).join(' ')

  return (
    <div className="card" style={{
      padding: '14px 16px',
      border: isCurrentUser ? '1.5px solid var(--accent)' : '1px solid var(--border)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Avatar profile={p} size={36} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {fullName || p.email || 'Usuário'}
          </div>
          <div style={{
            display: 'inline-block', marginTop: 2,
            fontSize: 10, fontWeight: 600,
            color: p.role === 'superadmin' ? 'var(--accent)' : 'var(--text3)',
            background: p.role === 'superadmin' ? 'var(--bg3)' : 'var(--bg4)',
            padding: '1px 6px', borderRadius: 4,
          }}>
            {p.role === 'superadmin' ? 'superadmin' : 'vendedor'}
          </div>
        </div>
        {isCurrentUser && (
          <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>Você</span>
        )}
      </div>
      {/* Metrics */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <MetricChip label="Contatos"  value={contatos}    color="#3B82F6" />
        <MetricChip label="Efetivos"  value={efetivos}    color="#06B6D4" />
        <MetricChip label="Fecham."   value={fechamentos} color="#10B981" />
        <MetricChip label="Perdidos"  value={perdidos}    color="#EF4444" />
      </div>
    </div>
  )
}

// ─── Bar chart (last 7 days) ──────────────────────────────────────────────────
function ActivityChart({ chartData }) {
  const max = Math.max(...chartData.map(d => d.count), 1)
  const chartHeight = 100

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 6,
      height: chartHeight + 36, // bars + labels
      padding: '0 4px',
    }}>
      {chartData.map((d, i) => {
        const barH = d.count > 0 ? Math.max(4, Math.round((d.count / max) * chartHeight)) : 0
        return (
          <div key={i} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-end', height: chartHeight + 36,
          }}>
            {/* Count label */}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3, minHeight: 16, lineHeight: '16px' }}>
              {d.count > 0 ? d.count : ''}
            </div>
            {/* Bar */}
            <div style={{
              width: '100%', maxWidth: 36,
              height: barH || 0,
              background: barH > 0 ? 'var(--accent)' : 'var(--bg3)',
              borderRadius: '3px 3px 0 0',
              minHeight: barH > 0 ? 4 : 0,
              transition: 'height 0.3s ease',
            }} />
            {/* Day label */}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5, textAlign: 'center' }}>
              {d.day}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Recent activity row ──────────────────────────────────────────────────────
function ActivityRow({ row }) {
  const empresa = row.empresas
  const nomeFmt = empresa?.nome_fantasia || empresa?.razao_social || `Lead #${String(row.empresa_id).slice(0, 6)}`
  const cfgAnterior = STATUS_CONFIG[row.status_anterior]
  const cfgNovo     = STATUS_CONFIG[row.status_novo]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        {/* Status dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {cfgAnterior && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfgAnterior.dot, display: 'inline-block' }} />
          )}
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>→</span>
          {cfgNovo && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfgNovo.dot, display: 'inline-block' }} />
          )}
        </div>
        {/* Company + status labels */}
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 200 }}>
            {nomeFmt}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            {cfgAnterior?.label || row.status_anterior} → {cfgNovo?.label || row.status_novo}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, marginLeft: 8 }}>
        {tempoRelativo(row.criado_em)}
      </span>
    </div>
  )
}

// ─── Period tab button ────────────────────────────────────────────────────────
function PeriodTab({ id, label, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        padding: '5px 12px', borderRadius: 20,
        border: active ? 'none' : '1px solid var(--border)',
        background: active ? 'var(--accent)' : 'var(--bg3)',
        color: active ? '#fff' : 'var(--text2)',
        fontSize: 12, fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Desempenho({ session, profile }) {
  const [periodo, setPeriodo]   = useState('mes')
  const [history, setHistory]   = useState([])
  const [profiles, setProfiles] = useState([])
  const [chartData, setChartData] = useState([])
  const [recentRows, setRecentRows] = useState([])
  const [loading, setLoading]   = useState(true)
  const isMobile = useIsMobile()

  const isSuperAdmin  = profile?.role === 'superadmin'
  const currentUserId = session?.user?.id

  // ── Build start date for period filter ──────────────────────────────────────
  function getStartDate(p) {
    const now = new Date()
    if (p === 'hoje') {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      return d
    }
    if (p === '7dias') {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d
    }
    if (p === 'mes') {
      return new Date(now.getFullYear(), now.getMonth(), 1)
    }
    return null // total — no filter
  }

  // ── Load main period data ────────────────────────────────────────────────────
  useEffect(() => {
    loadData()
  }, [periodo])

  // ── Load chart data (always last 7 days) ─────────────────────────────────────
  useEffect(() => {
    loadChartData()
    loadRecentActivity()
  }, [])

  async function loadData() {
    setLoading(true)
    const startDate = getStartDate(periodo)

    let q = supabase
      .from('status_history')
      .select('*')
      .order('criado_em', { ascending: false })
    if (startDate) q = q.gte('criado_em', startDate.toISOString())

    const { data } = await q
    setHistory(data || [])

    if (isSuperAdmin) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('*')
        .eq('ativo', true)
      setProfiles(profs || [])
    }

    setLoading(false)
  }

  async function loadChartData() {
    // Always last 7 days for chart, regardless of periodo
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('status_history')
      .select('criado_em')
      .eq('usuario_id', currentUserId)
      .gte('criado_em', sevenDaysAgo.toISOString())

    // Build last 7 days array
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push({
        key: toDateKey(d),
        day: DIAS_SEMANA[d.getDay()],
        count: 0,
      })
    }

    if (data) {
      for (const row of data) {
        const key = row.criado_em.slice(0, 10)
        const found = days.find(d => d.key === key)
        if (found) found.count++
      }
    }

    setChartData(days)
  }

  async function loadRecentActivity() {
    const { data } = await supabase
      .from('status_history')
      .select('*, empresas(nome_fantasia, razao_social)')
      .eq('usuario_id', currentUserId)
      .order('criado_em', { ascending: false })
      .limit(10)
    setRecentRows(data || [])
  }

  // ── My rows (for Meu Desempenho section) ─────────────────────────────────────
  const myRows        = history.filter(r => r.usuario_id === currentUserId)
  const myContatos    = countByCategory(myRows, CONTATOS)
  const myEfetivos    = countByCategory(myRows, EFETIVOS)
  const myFechamentos = countByCategory(myRows, FECHAMENTOS)
  const myPerdidos    = countByCategory(myRows, PERDIDOS)

  // ── Vendor cards: only profiles that have any history ───────────────────────
  const activeProfiles = isSuperAdmin
    ? profiles.filter(p => history.some(r => r.usuario_id === p.id))
    : []

  // Grid columns
  const teamCols    = isMobile ? 1 : activeProfiles.length >= 3 ? 3 : activeProfiles.length >= 2 ? 2 : 1
  const statCols    = isMobile ? 2 : 4

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? '16px' : '24px 28px', maxWidth: 1000, margin: '0 auto' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 28,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Desempenho</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text3)' }}>
            Acompanhe suas métricas de prospecção
          </p>
        </div>
        {/* Period tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'hoje',  label: 'Hoje'   },
            { id: '7dias', label: '7 dias' },
            { id: 'mes',   label: 'Mês'    },
            { id: 'total', label: 'Total'  },
          ].map(t => (
            <PeriodTab
              key={t.id}
              id={t.id}
              label={t.label}
              active={periodo === t.id}
              onClick={setPeriodo}
            />
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
          Carregando dados...
        </div>
      ) : (
        <>
          {/* ── Section 1: Equipe (superadmin only) ─────────────────────────── */}
          {isSuperAdmin && activeProfiles.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <SectionTitle>Equipe</SectionTitle>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${teamCols}, 1fr)`,
                gap: 12,
              }}>
                {activeProfiles.map(p => (
                  <VendorCard
                    key={p.id}
                    profile={p}
                    rows={history}
                    isCurrentUser={p.id === currentUserId}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Section 2: Meu Desempenho ───────────────────────────────────── */}
          <section style={{ marginBottom: 32 }}>
            <SectionTitle>Meu Desempenho</SectionTitle>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${statCols}, 1fr)`,
              gap: 12,
            }}>
              <StatCard label="Contatos"    value={myContatos}    color="#3B82F6" periodo={periodo} />
              <StatCard label="Efetivos"    value={myEfetivos}    color="#06B6D4" periodo={periodo} />
              <StatCard label="Fechamentos" value={myFechamentos} color="#10B981" periodo={periodo} />
              <StatCard label="Perdidos"    value={myPerdidos}    color="#EF4444" periodo={periodo} />
            </div>
          </section>

          {/* ── Section 3: Activity chart (last 7 days) ─────────────────────── */}
          <section style={{ marginBottom: 32 }}>
            <SectionTitle>Atividade — últimos 7 dias</SectionTitle>
            <div className="card" style={{ padding: '16px 16px 12px' }}>
              {chartData.length > 0 ? (
                <ActivityChart chartData={chartData} />
              ) : (
                <div style={{ color: 'var(--text3)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
                  Sem atividade registrada
                </div>
              )}
            </div>
          </section>

          {/* ── Section 4: Recent activity ──────────────────────────────────── */}
          <section>
            <SectionTitle>Atividade recente</SectionTitle>
            <div className="card" style={{ padding: '0 16px' }}>
              {recentRows.length === 0 ? (
                <div style={{ color: 'var(--text3)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
                  Nenhuma atividade registrada
                </div>
              ) : (
                recentRows.map(row => (
                  <ActivityRow key={row.id} row={row} />
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

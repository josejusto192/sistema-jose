import React, { useMemo, useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { STATUS_CONFIG, leadName } from '../constants.js'
import { useTheme, useIsSuperAdmin, useProfile } from '../App.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { format, subDays, isPast, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { IconClock, IconTrendUp, IconTrendDown } from './Icons.jsx'
import { supabase } from '../supabase.js'

function fmt(n) {
  return n?.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) ?? '0'
}

function fmtBRL(n) {
  return 'R$ ' + fmt(n)
}

function trend(curr, prev) {
  if (!prev || prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

function Avatar({ profile, size = 36 }) {
  const initials = [profile?.nome, profile?.sobrenome].filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?'
  if (profile?.foto_url) return <img src={profile.foto_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#F05B17', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function TrendBadge({ value }) {
  const pos = value >= 0
  const Icon = pos ? IconTrendUp : IconTrendDown
  const color = pos ? 'var(--green)' : 'var(--red)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color, fontWeight: 500 }}>
      <Icon size={12} color={color} />
      {pos ? '+' : ''}{value}% vs mês anterior
    </span>
  )
}

function InfoIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 6.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="7" cy="4.5" r="0.8" fill="currentColor"/>
    </svg>
  )
}

function StatCard({ label, value, sub, trendValue, tooltip }) {
  const [show, setShow] = useState(false)
  return (
    <div
      className="card stat-card"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 400 }}>{label}</div>
        {tooltip && (
          <span style={{ color: 'var(--text3)', opacity: show ? 1 : 0.4, transition: 'opacity 0.15s', flexShrink: 0, lineHeight: 1 }}>
            <InfoIcon size={13} />
          </span>
        )}
      </div>
      <div className="stat-card-value" style={{ marginBottom: 10 }}>{value}</div>
      {trendValue != null
        ? <TrendBadge value={trendValue} />
        : <span style={{ fontSize: 12, color: 'var(--text3)' }}>{sub}</span>
      }
      {tooltip && show && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0,
          background: '#1A1F2B', color: '#E2E8F0',
          borderRadius: 8, padding: '10px 13px',
          fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-line',
          boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
          zIndex: 50, width: 230, pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', bottom: '100%', left: 20,
            borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderBottom: '6px solid #1A1F2B',
          }} />
          {tooltip}
        </div>
      )}
    </div>
  )
}

function DashboardHeader({ nome, saudacao, followupCount, profile, onNewLead, isSuperAdmin }) {
  const emojis = { 'Bom dia': '👋', 'Boa tarde': '☀️', 'Boa noite': '🌙' }
  return (
    <header className="dashboard-header">
      <div>
        <div className="dashboard-greeting">
          {saudacao}, {nome}! {emojis[saudacao] || '👋'}
        </div>
        <div className="dashboard-subtitle">
          {isSuperAdmin ? 'Aqui está o desempenho do seu time hoje.' : 'Aqui está o seu desempenho hoje.'}
        </div>
      </div>
      <div className="dashboard-actions">
        <Avatar profile={profile} size={38} />
        <button onClick={onNewLead} className="primary-action">
          + Novo Lead
        </button>
      </div>
    </header>
  )
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text3)', marginBottom: 3 }}>{label}</div>
      <div style={{ color: '#F05B17', fontWeight: 600 }}>{payload[0]?.value}</div>
    </div>
  )
}

/* ─── Admin Dashboard ──────────────────────────────────────────────────────── */
function AdminDashboard({ empresas, contratos, tasks = [], loading, onViewLeads, onViewContratos, onOpenLead, onNewLead }) {
  const theme    = useTheme()
  const isMobile = useIsMobile()
  const profile  = useProfile()
  const [profiles, setProfiles] = useState([])

  useEffect(() => {
    supabase.from('profiles').select('id, nome, sobrenome, foto_url').then(({ data }) => setProfiles(data || []))
  }, [])

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const financeiro = useMemo(() => {
    const ativos      = contratos.filter(c => c.status === 'ativo')
    const recorrentes = ativos.filter(c => c.valor_mensal > 0)
    const mrr         = recorrentes.reduce((s, c) => s + (c.valor_mensal || 0), 0)
    const totalAtivos = ativos.length
    const cancelados  = contratos.filter(c => c.status === 'cancelado').length
    return { mrr, totalAtivos, cancelados, recorrentes: recorrentes.length }
  }, [contratos])

  const stats = useMemo(() => {
    const total       = empresas.length
    const fechados    = empresas.filter(e => e.status_prospeccao === 'fechou').length
    const trabalhados = empresas.filter(e => e.status_prospeccao !== 'novo').length
    const conversao   = trabalhados > 0 ? +((fechados / trabalhados) * 100).toFixed(1) : 0

    const leadsThisMonth = empresas.filter(e => e.criado_em && new Date(e.criado_em) >= thisMonthStart).length
    const leadsLastMonth = empresas.filter(e => {
      if (!e.criado_em) return false
      const d = new Date(e.criado_em)
      return d >= lastMonthStart && d < thisMonthStart
    }).length
    const trendLeads = trend(leadsThisMonth, leadsLastMonth)

    const contratosThisMonth = contratos.filter(c => c.criado_em && new Date(c.criado_em) >= thisMonthStart).length
    const contratosLastMonth = contratos.filter(c => {
      if (!c.criado_em) return false
      const d = new Date(c.criado_em)
      return d >= lastMonthStart && d < thisMonthStart
    }).length
    const trendContratos = trend(contratosThisMonth, contratosLastMonth)

    const chartData = Array.from({ length: 30 }, (_, i) => {
      const date    = subDays(now, 29 - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const count   = empresas.filter(e => e.criado_em && format(new Date(e.criado_em), 'yyyy-MM-dd') === dateStr).length
      return { dia: format(date, 'dd/MM'), count }
    })

    return { total, fechados, trabalhados, conversao, leadsThisMonth, leadsLastMonth, trendLeads, contratosThisMonth, trendContratos, chartData }
  }, [empresas, contratos])

  // Ranking de vendedores por contratos
  const ranking = useMemo(() => {
    return profiles
      .map(p => {
        const meusContratos = contratos.filter(c => c.vendedor_id === p.id)
        const qtd   = meusContratos.length
        const valor = meusContratos.reduce((s, c) => s + (c.valor_mensal || c.valor_total || 0), 0)
        return { ...p, qtd, valor }
      })
      .filter(p => p.qtd > 0)
      .sort((a, b) => b.qtd - a.qtd || b.valor - a.valor)
      .slice(0, 5)
  }, [profiles, contratos])

  const revenueChart = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d     = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const fim   = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const receita = contratos
        .filter(c => { const dt = c.criado_em ? new Date(c.criado_em) : null; return dt && dt >= d && dt < fim })
        .reduce((s, c) => s + (Number(c.valor_mensal) || Number(c.valor_total) || 0), 0)
      return { mes: format(d, 'MMM/yy', { locale: ptBR }), receita }
    })
  }, [contratos])

  const funnelData = useMemo(() => {
    const STAGES = ['novo','contatado','aguardando','respondeu','call_agendada','proposta_enviada','fechou','perdido']
    const total = empresas.length || 1
    return STAGES.map(s => ({
      s,
      label: STATUS_CONFIG[s]?.label || s,
      count: empresas.filter(e => e.status_prospeccao === s).length,
      dot:   STATUS_CONFIG[s]?.dot   || '#888',
      bg:    STATUS_CONFIG[s]?.bg    || 'var(--bg3)',
      color: STATUS_CONFIG[s]?.color || 'var(--text)',
      total,
    })).filter(d => d.count > 0)
  }, [empresas])

  const nome = profile?.nome || 'Admin'
  const hora = now.getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  const today = format(now, 'yyyy-MM-dd')
  const followupCount = useMemo(() =>
    tasks.filter(t => !t.completed && t.due_date <= today).length
  , [tasks, today])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 13 }}>
      Carregando...
    </div>
  )

  const chartColor = '#F05B17'
  const tickColor  = theme === 'dark' ? '#4B5563' : '#9CA3AF'

  return (
    <div className="dashboard-shell">
      <DashboardHeader nome={nome} saudacao={saudacao} followupCount={followupCount} profile={profile} onNewLead={onNewLead} isSuperAdmin />

      <div className="dashboard-content">

        {/* 4 stat cards */}
        <div className="stats-grid">
          <StatCard
            label="MRR"
            value={fmtBRL(financeiro.mrr)}
            sub={`${financeiro.recorrentes} contrato${financeiro.recorrentes !== 1 ? 's' : ''} recorrente${financeiro.recorrentes !== 1 ? 's' : ''} ativo${financeiro.recorrentes !== 1 ? 's' : ''}`}
            tooltip={`Receita Mensal Recorrente.\n\nSoma do valor_mensal de todos os contratos com status "ativo" e cobrança recorrente.\n\nNão inclui contratos pontuais (pagamento único).`}
          />
          <StatCard
            label="Contratos Ativos"
            value={financeiro.totalAtivos}
            sub={stats.contratosThisMonth > 0 ? `+${stats.contratosThisMonth} este mês` : `${financeiro.cancelados} cancelado${financeiro.cancelados !== 1 ? 's' : ''}`}
            trendValue={stats.trendContratos}
            tooltip={`Total de contratos com status "ativo".\n\nA seta compara quantos contratos foram criados neste mês vs o mês anterior.`}
          />
          <StatCard
            label="Novos Leads (mês)"
            value={stats.leadsThisMonth}
            sub={`${stats.leadsLastMonth} no mês anterior`}
            trendValue={stats.trendLeads}
            tooltip={`Leads cadastrados no mês atual.\n\nA seta compara com o total do mês anterior para indicar se a captação está crescendo ou caindo.`}
          />
          <StatCard
            label="Taxa de Conversão"
            value={`${stats.conversao}%`}
            sub={`${stats.fechados} fechados de ${stats.trabalhados} trabalhados`}
            tooltip={`Percentual de leads que viraram clientes.\n\nFórmula: fechados ÷ trabalhados × 100\n\n"Trabalhados" = leads que saíram do status "novo" (foram contatados ou avançaram no funil).`}
          />
        </div>

        {/* Gráfico + Ranking */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap: 14 }}>
          {/* Area chart */}
          <div className="card" style={{ padding: '22px 22px 14px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 18 }}>
              Leads no Período
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.chartData} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={chartColor} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="dia"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  interval={4}
                />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={chartColor}
                  strokeWidth={2.5}
                  fill="url(#areaGreen)"
                  dot={false}
                  activeDot={{ r: 5, fill: chartColor, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Ranking de Vendedores */}
          <div className="card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Ranking de Vendedores</div>
              <button
                onClick={() => {}}
                style={{ fontSize: 12, color: '#F05B17', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                Ver todos
              </button>
            </div>
            {ranking.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '24px 0' }}>
                Nenhum contrato registrado
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {ranking.map((v, i) => (
                  <div key={v.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 0',
                    borderBottom: i < ranking.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', width: 16, flexShrink: 0 }}>{i + 1}</div>
                    <Avatar profile={v} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {[v.nome, v.sobrenome].filter(Boolean).join(' ')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{v.qtd} contrato{v.qtd !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F05B17', flexShrink: 0 }}>
                      {fmtBRL(v.valor)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Receita por mês + Funil de conversão */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
          {/* Bar chart — receita por mês */}
          <div className="card" style={{ padding: '22px 22px 14px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 18 }}>Receita por mês</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={revenueChart} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                <XAxis dataKey="mes" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v) => [`R$ ${Number(v).toLocaleString('pt-BR')}`, 'Receita']}
                  contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--text3)' }}
                  itemStyle={{ color: '#F05B17' }}
                />
                <Bar dataKey="receita" radius={[4, 4, 0, 0]}>
                  {revenueChart.map((_, i) => (
                    <Cell key={i} fill={i === revenueChart.length - 1 ? '#F05B17' : (theme === 'dark' ? '#374151' : '#E5E7EB')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Funil de conversão */}
          <div className="card" style={{ padding: '22px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 18 }}>Funil de conversão</div>
            {funnelData.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '24px 0' }}>Sem leads cadastrados</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {funnelData.map(d => {
                  const pct = Math.round((d.count / d.total) * 100)
                  return (
                    <div key={d.s}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{d.label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{d.count} lead{d.count !== 1 ? 's' : ''}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: d.dot, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`, borderRadius: 3,
                          background: d.dot, transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>
                  )
                })}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
                  <span>Total: {empresas.length} leads</span>
                  <span style={{ color: '#F05B17', fontWeight: 600 }}>
                    {funnelData.find(d => d.s === 'fechou')?.count || 0} fechados ({stats.conversao}% conversão)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Follow-ups e recentes */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
          {/* Leads recentes */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>Últimos leads</div>
            {empresas.slice(0, 5).length === 0
              ? <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>Nenhum lead</div>
              : empresas.slice(0, 5).map((e, i) => {
                const cfg = STATUS_CONFIG[e.status_prospeccao] || STATUS_CONFIG.novo
                return (
                  <div key={e.id} onClick={() => onOpenLead(e)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                    borderBottom: i < 4 ? '1px solid var(--border)' : 'none', cursor: 'pointer',
                  }}
                    onMouseEnter={el => el.currentTarget.style.opacity = '0.7'}
                    onMouseLeave={el => el.currentTarget.style.opacity = '1'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>
                      {leadName(e)[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {leadName(e)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{e.municipio}{e.uf ? ` · ${e.uf}` : ''}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: cfg.dot, background: theme === 'dark' ? cfg.darkBg : cfg.bg, borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>
                      {cfg.label}
                    </span>
                  </div>
                )
              })
            }
          </div>

          {/* Tarefas pendentes */}
          <div className="card" style={{ padding: '20px' }}>
            {(() => {
              const proximas = tasks
                .filter(t => !t.completed && t.due_date <= today)
                .sort((a, b) => a.due_date.localeCompare(b.due_date))
                .slice(0, 6)
              const futuras = tasks
                .filter(t => !t.completed && t.due_date > today)
                .sort((a, b) => a.due_date.localeCompare(b.due_date))
                .slice(0, 6 - proximas.length)
              const lista = [...proximas, ...futuras]
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>
                    <IconClock size={14} color="var(--text3)" />
                    Tarefas
                    {proximas.length > 0 && (
                      <span style={{ background: '#8B5CF6', color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                        {proximas.length} pendente{proximas.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {lista.length === 0
                    ? <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>Sem tarefas pendentes ✓</div>
                    : lista.map((t, i) => {
                      const isOverdue = t.due_date < today
                      const isToday2  = t.due_date === today
                      return (
                        <div key={t.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                          borderBottom: i < lista.length - 1 ? '1px solid var(--border)' : 'none',
                        }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: isOverdue ? '#EF4444' : isToday2 ? '#8B5CF6' : 'var(--border)', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.title}
                            </div>
                            <div style={{ fontSize: 11, color: isOverdue ? '#EF4444' : 'var(--text3)', marginTop: 1 }}>
                              {isOverdue ? 'Atrasada · ' : ''}{t.due_date ? format(parseISO(t.due_date), 'dd/MM') : ''}
                              {t.empresa_nome ? ` · ${t.empresa_nome}` : ''}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  }
                </>
              )
            })()}
          </div>
        </div>

      </div>
    </div>
  )
}

/* ─── Vendedor Dashboard ───────────────────────────────────────────────────── */
function VendedorDashboard({ empresas, contratos, tasks = [], loading, onOpenLead, onViewLeads, onViewContratos, onNewLead }) {
  const profile  = useProfile()
  const isMobile = useIsMobile()
  const theme    = useTheme()
  const now = new Date()
  const hora = now.getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const nome = profile?.nome || 'Vendedor'
  const [activityChartData, setActivityChartData] = useState([])

  useEffect(() => {
    if (!profile?.id) return
    async function loadActivityChart() {
      const from = subDays(now, 29)
      from.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('status_history')
        .select('criado_em')
        .eq('usuario_id', profile.id)
        .gte('criado_em', from.toISOString())
      const rows = data || []
      const built = Array.from({ length: 30 }, (_, i) => {
        const date    = subDays(now, 29 - i)
        const dateStr = format(date, 'yyyy-MM-dd')
        const count   = rows.filter(r => r.criado_em.slice(0, 10) === dateStr).length
        return { dia: format(date, 'dd/MM'), count }
      })
      setActivityChartData(built)
    }
    loadActivityChart()
  }, [profile?.id])

  const stats = useMemo(() => {
    const meus        = empresas
    const total       = meus.length
    const fechados    = meus.filter(e => e.status_prospeccao === 'fechou').length
    const trabalhados = meus.filter(e => e.status_prospeccao !== 'novo').length
    const perdidos    = meus.filter(e => ['perdido', 'descartado'].includes(e.status_prospeccao)).length
    const conversao   = trabalhados > 0 ? +((fechados / trabalhados) * 100).toFixed(1) : 0

    const meusContratos = contratos.filter(c => c.vendedor_id === profile?.id)
    const totalPendente = meusContratos.filter(c => c.comissao_status === 'pendente').reduce((s, c) => s + (Number(c.comissao_valor) || 0), 0)
    const totalPago     = meusContratos.filter(c => c.comissao_status === 'paga').reduce((s, c) => s + (Number(c.comissao_valor) || 0), 0)
    const meta      = profile?.meta_mensal || 5
    const progresso = meta > 0 ? Math.min(100, Math.round((fechados / meta) * 100)) : 0

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const leadsThisMonth = meus.filter(e => e.criado_em && new Date(e.criado_em) >= thisMonthStart).length
    const leadsLastMonth = meus.filter(e => {
      if (!e.criado_em) return false
      const d = new Date(e.criado_em)
      return d >= lastMonthStart && d < thisMonthStart
    }).length
    const trendLeads = trend(leadsThisMonth, leadsLastMonth)

    return { total, fechados, trabalhados, perdidos, conversao, meusContratos, totalPendente, totalPago, meta, progresso, leadsThisMonth, leadsLastMonth, trendLeads }
  }, [empresas, contratos, profile])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 13 }}>
      Carregando...
    </div>
  )

  const chartColor = '#F05B17'
  const tickColor  = theme === 'dark' ? '#4B5563' : '#9CA3AF'

  return (
    <div className="dashboard-shell">
      <DashboardHeader nome={nome} saudacao={saudacao} followupCount={tasks.filter(t => !t.completed && t.due_date <= format(new Date(), 'yyyy-MM-dd')).length} profile={profile} onNewLead={onNewLead} isSuperAdmin={false} />

      <div className="dashboard-content">

        {/* Meta mensal */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>Meta mensal de fechamentos</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                {stats.fechados} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text3)' }}>/ {stats.meta}</span>
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: stats.progresso >= 100 ? 'var(--green)' : '#F05B17' }}>
              {stats.progresso}%
            </div>
          </div>
          <div style={{ height: 7, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${stats.progresso}%`, background: stats.progresso >= 100 ? 'var(--green)' : '#F05B17', borderRadius: 4, transition: 'width 0.5s' }} />
          </div>
          {stats.progresso >= 100 && <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 8, fontWeight: 500 }}>Meta atingida! 🎉</div>}
        </div>

        {/* 4 KPI cards */}
        <div className="stats-grid">
          <StatCard
            label="Meus Leads"
            value={stats.total}
            sub={`${stats.leadsThisMonth} captado${stats.leadsThisMonth !== 1 ? 's' : ''} este mês`}
            trendValue={stats.trendLeads}
            tooltip={`Total de leads atribuídos a você.\n\nA seta compara os leads captados neste mês vs o mês anterior.`}
          />
          <StatCard
            label="Fechamentos"
            value={stats.fechados}
            sub={`meta: ${stats.meta} | progresso ${stats.progresso}%`}
            tooltip={`Leads que você moveu para o status "fechou".\n\nMeta definida no seu perfil. A barra de progresso acima mostra o avanço em relação à meta mensal.`}
          />
          <StatCard
            label="Conversão"
            value={`${stats.conversao}%`}
            sub={`${stats.fechados} fechados de ${stats.trabalhados} trabalhados`}
            tooltip={`Sua taxa de conversão pessoal.\n\nFórmula: fechados ÷ trabalhados × 100\n\n"Trabalhados" = leads que saíram do status "novo". Leads ainda em "novo" não entram no cálculo pois ainda não foram abordados.`}
          />
          <StatCard
            label="Comissão Pendente"
            value={fmtBRL(stats.totalPendente)}
            sub={stats.totalPendente > 0 ? 'a receber' : 'nenhuma pendente'}
            tooltip={`Soma das comissões dos seus contratos com status "pendente".\n\nQuando o admin marcar como paga, o valor sai daqui e vai para "Já recebido" na seção de comissões abaixo.`}
          />
        </div>

        {/* Gráfico + follow-ups */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 14 }}>
          <div className="card" style={{ padding: '22px 22px 14px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 18 }}>Minha Atividade (30 dias)</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={activityChartData} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGreenV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={chartColor} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="dia" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="count" stroke={chartColor} strokeWidth={2.5} fill="url(#areaGreenV)" dot={false} activeDot={{ r: 5, fill: chartColor, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            {(() => {
              const today = format(new Date(), 'yyyy-MM-dd')
              const proximas = tasks
                .filter(t => !t.completed && t.due_date <= today)
                .sort((a, b) => a.due_date.localeCompare(b.due_date))
                .slice(0, 6)
              const futuras = tasks
                .filter(t => !t.completed && t.due_date > today)
                .sort((a, b) => a.due_date.localeCompare(b.due_date))
                .slice(0, 6 - proximas.length)
              const lista = [...proximas, ...futuras]
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>
                    <IconClock size={14} color="var(--text3)" />
                    Tarefas
                    {proximas.length > 0 && (
                      <span style={{ background: '#8B5CF6', color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                        {proximas.length} hoje
                      </span>
                    )}
                  </div>
                  {lista.length === 0
                    ? <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>Sem tarefas pendentes ✓</div>
                    : lista.map((t, i) => {
                      const isOverdue = t.due_date < today
                      const isToday2  = t.due_date === today
                      return (
                        <div key={t.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                          borderBottom: i < lista.length - 1 ? '1px solid var(--border)' : 'none',
                        }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: isOverdue ? '#EF4444' : isToday2 ? '#8B5CF6' : 'var(--border)', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.title}
                            </div>
                            <div style={{ fontSize: 11, color: isOverdue ? '#EF4444' : 'var(--text3)', marginTop: 1 }}>
                              {isOverdue ? 'Atrasada · ' : ''}{t.due_date ? format(parseISO(t.due_date), 'dd/MM') : ''}
                              {t.empresa_nome ? ` · ${t.empresa_nome}` : ''}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  }
                </>
              )
            })()}
          </div>
        </div>

        {/* Comissões */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>Minhas comissões</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Pendente de pagamento</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--yellow)' }}>
                {fmtBRL(stats.totalPendente)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Já recebido</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>
                {fmtBRL(stats.totalPago)}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

/* ─── Export ───────────────────────────────────────────────────────────────── */
export default function Dashboard({ empresas, contratos = [], tasks = [], loading, onViewLeads, onViewContratos, onOpenLead, onNewLead }) {
  const isSuperAdmin = useIsSuperAdmin()

  if (!isSuperAdmin) return (
    <VendedorDashboard
      empresas={empresas} contratos={contratos} tasks={tasks} loading={loading}
      onOpenLead={onOpenLead} onViewLeads={onViewLeads} onViewContratos={onViewContratos}
      onNewLead={onNewLead}
    />
  )

  return (
    <AdminDashboard
      empresas={empresas} contratos={contratos} loading={loading}
      onViewLeads={onViewLeads} onViewContratos={onViewContratos} onOpenLead={onOpenLead}
      onNewLead={onNewLead}
    />
  )
}

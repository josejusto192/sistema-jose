import React, { useMemo, useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { STATUS_CONFIG } from '../constants.js'
import { useTheme, useIsSuperAdmin, useProfile } from '../App.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { format, subDays, isPast, isToday, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { IconClock, IconBell, IconTrendUp, IconTrendDown } from './Icons.jsx'
import { supabase } from '../supabase.js'

function parseFollowupDate(str) {
  if (!str) return null
  return str.includes('T') ? new Date(str) : parseISO(str + 'T12:00:00')
}

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
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#00CB53', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
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
      className="card"
      style={{ padding: '22px 24px', position: 'relative', transition: 'box-shadow 0.15s' }}
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
      <div style={{ fontWeight: 700, fontSize: 28, color: 'var(--text)', lineHeight: 1.1, marginBottom: 10 }}>{value}</div>
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

function DashboardHeader({ nome, saudacao, followupCount, profile, onNewLead }) {
  const emojis = { 'Bom dia': '👋', 'Boa tarde': '☀️', 'Boa noite': '🌙' }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 32px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
      flexShrink: 0, position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text)', lineHeight: 1.2 }}>
          {saudacao}, {nome}! {emojis[saudacao] || '👋'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
          Aqui está o desempenho do seu time hoje.
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <button style={{
            width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border)',
            background: 'var(--bg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconBell size={18} color="var(--text2)" />
          </button>
          {followupCount > 0 && (
            <span style={{
              position: 'absolute', top: 1, right: 1, width: 9, height: 9,
              borderRadius: '50%', background: '#EF4444', border: '2px solid var(--bg2)',
            }} />
          )}
        </div>
        <Avatar profile={profile} size={38} />
        <button
          onClick={onNewLead}
          style={{
            background: '#00CB53', color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}
        >
          + Novo Lead
        </button>
      </div>
    </div>
  )
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text3)', marginBottom: 3 }}>{label}</div>
      <div style={{ color: '#00CB53', fontWeight: 600 }}>{payload[0]?.value}</div>
    </div>
  )
}

/* ─── Admin Dashboard ──────────────────────────────────────────────────────── */
function AdminDashboard({ empresas, contratos, loading, onViewLeads, onViewContratos, onOpenLead, onNewLead }) {
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

  const nome = profile?.nome || 'Admin'
  const hora = now.getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  const followupCount = useMemo(() =>
    empresas.filter(e => {
      const FOLLOWUP_STATUSES = ['contatado', 'aguardando', 'respondeu', 'proposta_enviada']
      if (!FOLLOWUP_STATUSES.includes(e.status_prospeccao)) return false
      const ref = e.atualizado_em || e.criado_em
      return ref && differenceInDays(now, new Date(ref)) >= 3
    }).length
  , [empresas])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 13 }}>
      Carregando...
    </div>
  )

  const chartColor = '#00CB53'
  const tickColor  = theme === 'dark' ? '#4B5563' : '#9CA3AF'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DashboardHeader nome={nome} saudacao={saudacao} followupCount={followupCount} profile={profile} onNewLead={onNewLead} />

      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* 4 stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14 }}>
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
                style={{ fontSize: 12, color: '#00CB53', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
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
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#00CB53', flexShrink: 0 }}>
                      {fmtBRL(v.valor)}
                    </div>
                  </div>
                ))}
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
                      {(e.razao_social || e.nome_fantasia || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.nome_fantasia || e.razao_social}
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

          {/* Follow-ups com atenção */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>
              <IconClock size={14} color="var(--text3)" />
              Follow-ups pendentes
              {followupCount > 0 && (
                <span style={{ background: '#F59E0B', color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{followupCount}</span>
              )}
            </div>
            {(() => {
              const FOLLOWUP_STATUSES = ['contatado', 'aguardando', 'respondeu', 'proposta_enviada']
              const list = empresas.filter(e => {
                if (!FOLLOWUP_STATUSES.includes(e.status_prospeccao)) return false
                const ref = e.atualizado_em || e.criado_em
                return ref && differenceInDays(now, new Date(ref)) >= 3
              }).slice(0, 5)
              if (!list.length) return <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>Tudo em dia! ✓</div>
              return list.map((e, i) => {
                const cfg = STATUS_CONFIG[e.status_prospeccao] || STATUS_CONFIG.novo
                return (
                  <div key={e.id} onClick={() => onOpenLead(e)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                    borderBottom: i < list.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer',
                  }}
                    onMouseEnter={el => el.currentTarget.style.opacity = '0.7'}
                    onMouseLeave={el => el.currentTarget.style.opacity = '1'}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.nome_fantasia || e.razao_social}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{cfg.label}</div>
                    </div>
                    <span style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>Ver →</span>
                  </div>
                )
              })
            })()}
          </div>
        </div>

      </div>
    </div>
  )
}

/* ─── Vendedor Dashboard ───────────────────────────────────────────────────── */
const FOLLOWUP_STATUSES_V = ['contatado', 'aguardando', 'respondeu', 'proposta_enviada']

function VendedorDashboard({ empresas, contratos, loading, onOpenLead, onViewLeads, onViewContratos, onNewLead }) {
  const profile  = useProfile()
  const isMobile = useIsMobile()
  const theme    = useTheme()
  const now = new Date()
  const hora = now.getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const nome = profile?.nome || 'Vendedor'

  const stats = useMemo(() => {
    const meus        = empresas
    const total       = meus.length
    const fechados    = meus.filter(e => e.status_prospeccao === 'fechou').length
    const trabalhados = meus.filter(e => e.status_prospeccao !== 'novo').length
    const perdidos    = meus.filter(e => ['perdido', 'descartado'].includes(e.status_prospeccao)).length
    const conversao   = trabalhados > 0 ? +((fechados / trabalhados) * 100).toFixed(1) : 0

    const followups = meus.filter(e => {
      if (!FOLLOWUP_STATUSES_V.includes(e.status_prospeccao)) return false
      const ref = e.atualizado_em || e.criado_em
      return ref && differenceInDays(now, new Date(ref)) >= 3
    })

    const agendados = meus
      .filter(e => e.data_followup)
      .map(e => ({ ...e, _date: parseFollowupDate(e.data_followup) }))
      .sort((a, b) => a._date - b._date)
      .slice(0, 5)

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

    const chartData = Array.from({ length: 30 }, (_, i) => {
      const date    = subDays(now, 29 - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const count   = meus.filter(e => e.criado_em && format(new Date(e.criado_em), 'yyyy-MM-dd') === dateStr).length
      return { dia: format(date, 'dd/MM'), count }
    })

    return { total, fechados, trabalhados, perdidos, conversao, followups, agendados, meusContratos, totalPendente, totalPago, meta, progresso, leadsThisMonth, leadsLastMonth, trendLeads, chartData }
  }, [empresas, contratos, profile])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 13 }}>
      Carregando...
    </div>
  )

  const chartColor = '#00CB53'
  const tickColor  = theme === 'dark' ? '#4B5563' : '#9CA3AF'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DashboardHeader nome={nome} saudacao={saudacao} followupCount={stats.followups.length} profile={profile} onNewLead={onNewLead} />

      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Meta mensal */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>Meta mensal de fechamentos</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                {stats.fechados} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text3)' }}>/ {stats.meta}</span>
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: stats.progresso >= 100 ? 'var(--green)' : '#00CB53' }}>
              {stats.progresso}%
            </div>
          </div>
          <div style={{ height: 7, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${stats.progresso}%`, background: stats.progresso >= 100 ? 'var(--green)' : '#00CB53', borderRadius: 4, transition: 'width 0.5s' }} />
          </div>
          {stats.progresso >= 100 && <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 8, fontWeight: 500 }}>Meta atingida! 🎉</div>}
        </div>

        {/* 4 KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14 }}>
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
              <AreaChart data={stats.chartData} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>
              <IconClock size={14} color="var(--text3)" />
              Follow-ups pendentes
              {stats.followups.length > 0 && (
                <span style={{ background: '#F59E0B', color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                  {stats.followups.length}
                </span>
              )}
            </div>
            {stats.followups.length === 0
              ? <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>Tudo em dia! ✓</div>
              : stats.followups.slice(0, 5).map((e, i) => {
                const cfg = STATUS_CONFIG[e.status_prospeccao] || STATUS_CONFIG.novo
                return (
                  <div key={e.id} onClick={() => onOpenLead(e)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                    borderBottom: i < Math.min(stats.followups.length, 5) - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer',
                  }}
                    onMouseEnter={el => el.currentTarget.style.opacity = '0.7'}
                    onMouseLeave={el => el.currentTarget.style.opacity = '1'}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.nome_fantasia || e.razao_social}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{cfg.label}</div>
                    </div>
                    <span style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>Ver →</span>
                  </div>
                )
              })
            }
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
export default function Dashboard({ empresas, contratos = [], loading, onViewLeads, onViewContratos, onOpenLead, onNewLead }) {
  const isSuperAdmin = useIsSuperAdmin()

  if (!isSuperAdmin) return (
    <VendedorDashboard
      empresas={empresas} contratos={contratos} loading={loading}
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

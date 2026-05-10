import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { STATUS_CONFIG } from '../constants.js'
import { useTheme } from '../App.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { IconMail, IconPhone } from './Icons.jsx'

function getStatusStyle(cfg, theme) {
  return theme === 'dark'
    ? { color: cfg.darkColor, background: cfg.darkBg }
    : { color: cfg.color, background: cfg.bg }
}

function StatCard({ label, value, sub, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      className="card"
      style={{
        padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
        borderLeft: `3px solid ${accent || 'var(--accent)'}`,
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = 'var(--shadow)')}
    >
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 30, color: accent || 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: 'var(--accent)', fontWeight: 500 }}>{p.value} leads</div>
      ))}
    </div>
  )
}

function fmt(n) {
  return n?.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) ?? '0'
}

export default function Dashboard({ empresas, contratos = [], loading, onViewLeads, onViewContratos, onOpenLead }) {
  const theme = useTheme()
  const isMobile = useIsMobile()

  const financeiro = useMemo(() => {
    const ativos = contratos.filter(c => c.status === 'ativo')
    const mrr = ativos
      .filter(c => c.pacote === 'gestao_trafego')
      .reduce((sum, c) => sum + (c.valor_mensal || 0), 0)
    const totalAtivos = ativos.length
    const ticketMedio = totalAtivos > 0
      ? ativos.reduce((sum, c) => sum + (c.valor_mensal || c.valor_total || 0), 0) / totalAtivos
      : 0
    const cancelados = contratos.filter(c => c.status === 'cancelado').length
    const churnRate = contratos.length > 0
      ? Math.round((cancelados / contratos.length) * 100)
      : 0
    return { mrr, arr: mrr * 12, totalAtivos, ticketMedio, churnRate }
  }, [contratos])

  const stats = useMemo(() => {
    const total = empresas.length
    const novos = empresas.filter(e => e.status_prospeccao === 'novo').length
    const contatados = empresas.filter(e => ['contatado', 'aguardando', 'respondeu', 'call_agendada', 'call_realizada', 'proposta_enviada'].includes(e.status_prospeccao)).length
    const fechados = empresas.filter(e => e.status_prospeccao === 'fechou').length
    const perdidos = empresas.filter(e => e.status_prospeccao === 'perdido').length
    const comEmail = empresas.filter(e => e.email).length
    const comTel = empresas.filter(e => e.telefone).length

    const porUF = {}
    empresas.forEach(e => { if (e.uf) porUF[e.uf] = (porUF[e.uf] || 0) + 1 })
    const topUF = Object.entries(porUF).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([uf, count]) => ({ uf, count }))

    const porCnae = {}
    empresas.forEach(e => {
      const key = e.cnae_principal_descricao?.slice(0, 35) || 'Não informado'
      porCnae[key] = (porCnae[key] || 0) + 1
    })
    const topCnae = Object.entries(porCnae).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cnae, count]) => ({ cnae, count }))

    const porStatus = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
      name: cfg.label,
      value: empresas.filter(e => e.status_prospeccao === key).length,
      color: cfg.dot,
    })).filter(s => s.value > 0)

    const today = new Date()
    const porDia = Array.from({ length: 14 }, (_, i) => {
      const date = subDays(today, 13 - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const count = empresas.filter(e => e.criado_em?.slice(0, 10) === dateStr).length
      return { dia: format(date, 'dd/MM'), count }
    })

    return { total, novos, contatados, fechados, perdidos, comEmail, comTel, topUF, topCnae, porStatus, porDia, recentes: [...empresas].slice(0, 5) }
  }, [empresas])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>
      <div style={{ fontSize: 13, animation: 'pulse 1.5s infinite' }}>Carregando...</div>
    </div>
  )

  const accentColor = theme === 'dark' ? '#3B82F6' : '#2563EB'
  const chartTickColor = theme === 'dark' ? '#636366' : '#9CA3AF'

  return (
    <div style={{ padding: isMobile ? '16px' : '28px 32px', display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.25s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.3px', color: 'var(--text)' }}>Dashboard</h1>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 2 }}>Visão geral da prospecção</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', padding: '5px 12px', borderRadius: 20 }}>
          {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
        </div>
      </div>

      {/* Financeiro — MRR / ARR */}
      <div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, fontWeight: 500 }}>Financeiro</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
          <div className="card" onClick={onViewContratos} style={{ padding: '16px 18px', cursor: 'pointer', borderLeft: '3px solid var(--green)' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
          >
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>MRR</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)', lineHeight: 1 }}>R$ {fmt(financeiro.mrr)}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>recorrente mensal</div>
          </div>
          <div className="card" style={{ padding: '16px 18px', borderLeft: '3px solid var(--cyan)' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>ARR projetado</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--cyan)', lineHeight: 1 }}>R$ {fmt(financeiro.arr)}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>MRR × 12</div>
          </div>
          <div className="card" onClick={onViewContratos} style={{ padding: '16px 18px', cursor: 'pointer', borderLeft: '3px solid var(--purple)' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
          >
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Contratos ativos</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--purple)', lineHeight: 1 }}>{financeiro.totalAtivos}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>ticket médio R$ {fmt(financeiro.ticketMedio)}</div>
          </div>
          <div className="card" style={{ padding: '16px 18px', borderLeft: '3px solid var(--red)' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Churn rate</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: financeiro.churnRate > 0 ? 'var(--red)' : 'var(--text3)', lineHeight: 1 }}>{financeiro.churnRate}%</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>contratos cancelados</div>
          </div>
        </div>
      </div>

      {/* Prospecção */}
      <div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, fontWeight: 500 }}>Prospecção</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
          <StatCard label="Total de leads" value={stats.total} sub="empresas captadas" accent={accentColor} onClick={onViewLeads} />
          <StatCard label="Novos" value={stats.novos} sub="aguardando contato" accent={accentColor} />
          <StatCard label="Em andamento" value={stats.contatados} sub="contatados ou negociando" accent="var(--yellow)" />
          <StatCard label="Fechados" value={stats.fechados} sub={`${stats.perdidos} perdidos`} accent="var(--green)" />
        </div>
      </div>

      {/* Info rápida */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { Icon: IconMail,  value: stats.comEmail, label: 'com e-mail',   color: 'var(--accent)' },
          { Icon: IconPhone, value: stats.comTel,   label: 'com telefone', color: 'var(--purple)' },
          { Icon: null, value: `${stats.total > 0 ? Math.round((stats.fechados / stats.total) * 100) : 0}%`, label: 'taxa de conversão leads', color: 'var(--yellow)' },
        ].map((item, i) => (
          <div key={i} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {item.Icon
                ? <item.Icon size={18} color="var(--text3)" />
                : <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text3)' }}>%</span>
              }
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: item.color, lineHeight: 1 }}>{item.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 16 }}>Leads por dia (14 dias)</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={stats.porDia} barSize={12}>
              <XAxis dataKey="dia" tick={{ fill: chartTickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill={accentColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 16 }}>Funil por status</div>
          {stats.porStatus.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>Sem dados</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <PieChart width={130} height={130}>
                <Pie data={stats.porStatus} cx={60} cy={60} innerRadius={38} outerRadius={60} dataKey="value" strokeWidth={0}>
                  {stats.porStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {stats.porStatus.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top UF + Segmentos */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 16 }}>Top estados</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.topUF.slice(0, 6).map(item => (
              <div key={item.uf} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', width: 22 }}>{item.uf}</div>
                <div style={{ flex: 1, height: 5, background: 'var(--bg3)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(item.count / stats.topUF[0].count) * 100}%`, background: accentColor, borderRadius: 10, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', width: 22, textAlign: 'right', fontWeight: 500 }}>{item.count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 16 }}>Top segmentos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.topCnae.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.cnae}</div>
                <div style={{ background: 'var(--bg3)', borderRadius: 20, padding: '2px 9px', fontSize: 11, color: 'var(--accent)', fontWeight: 500, flexShrink: 0 }}>{item.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recentes */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 16 }}>Últimos leads captados</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {stats.recentes.map((e, i) => {
            const cfg = STATUS_CONFIG[e.status_prospeccao] || STATUS_CONFIG.novo
            const style = getStatusStyle(cfg, theme)
            return (
              <div
                key={e.id}
                onClick={() => onOpenLead(e)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < stats.recentes.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'opacity 0.1s' }}
                onMouseEnter={el => el.currentTarget.style.opacity = '0.7'}
                onMouseLeave={el => el.currentTarget.style.opacity = '1'}
              >
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text2)', flexShrink: 0 }}>
                  {(e.razao_social || e.nome_fantasia || '?')[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.nome_fantasia || e.razao_social}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{e.municipio} · {e.uf} · {e.cnae_principal_descricao?.slice(0, 40)}</div>
                </div>
                <span className="badge" style={{ background: style.background, color: style.color, flexShrink: 0 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot }} />
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

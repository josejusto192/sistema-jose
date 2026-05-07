import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { STATUS_CONFIG } from '../constants.js'
import { format, subDays, parseISO, isAfter } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 22px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = 'var(--border2)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color || 'var(--accent)', borderRadius: '16px 16px 0 0' }} />
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, color: color || 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--accent)' }}>{p.value} leads</div>
      ))}
    </div>
  )
}

export default function Dashboard({ empresas, loading, onViewLeads, onOpenLead }) {
  const stats = useMemo(() => {
    const total = empresas.length
    const novos = empresas.filter(e => e.status_prospeccao === 'novo').length
    const contatados = empresas.filter(e => ['contatado', 'aguardando', 'respondeu', 'call_agendada', 'call_realizada', 'proposta_enviada'].includes(e.status_prospeccao)).length
    const fechados = empresas.filter(e => e.status_prospeccao === 'fechou').length
    const perdidos = empresas.filter(e => e.status_prospeccao === 'perdido').length
    const comEmail = empresas.filter(e => e.email).length
    const comTel = empresas.filter(e => e.telefone).length

    // por UF
    const porUF = {}
    empresas.forEach(e => { if (e.uf) porUF[e.uf] = (porUF[e.uf] || 0) + 1 })
    const topUF = Object.entries(porUF).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([uf, count]) => ({ uf, count }))

    // por CNAE (top 6)
    const porCnae = {}
    empresas.forEach(e => {
      const key = e.cnae_principal_descricao?.slice(0, 35) || 'Não informado'
      porCnae[key] = (porCnae[key] || 0) + 1
    })
    const topCnae = Object.entries(porCnae).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cnae, count]) => ({ cnae, count }))

    // por status para pizza
    const porStatus = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
      name: cfg.label,
      value: empresas.filter(e => e.status_prospeccao === key).length,
      color: cfg.color,
    })).filter(s => s.value > 0)

    // leads por dia (últimos 14 dias)
    const today = new Date()
    const porDia = Array.from({ length: 14 }, (_, i) => {
      const date = subDays(today, 13 - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const count = empresas.filter(e => {
        const criado = e.criado_em?.slice(0, 10)
        return criado === dateStr
      }).length
      return { dia: format(date, 'dd/MM'), count }
    })

    // recentes (últimos 5)
    const recentes = [...empresas].slice(0, 5)

    return { total, novos, contatados, fechados, perdidos, comEmail, comTel, topUF, topCnae, porStatus, porDia, recentes }
  }, [empresas])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, animation: 'pulse 1.5s infinite' }}>carregando dados...</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.5px' }}>Dashboard</h1>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 2 }}>Visão geral da prospecção de empresas novas</div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 20 }}>
          {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="Total de leads" value={stats.total} sub="empresas captadas" color="var(--accent)" onClick={onViewLeads} />
        <StatCard label="Novos" value={stats.novos} sub="aguardando contato" color="#4f8ef7" />
        <StatCard label="Em andamento" value={stats.contatados} sub="contatados ou em negociação" color="var(--yellow)" />
        <StatCard label="Fechados" value={stats.fechados} sub={stats.perdidos + ' perdidos'} color="var(--green)" />
      </div>

      {/* Info rápida */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📧</div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--green)' }}>{stats.comEmail}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>com e-mail</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--purple-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📱</div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--purple)' }}>{stats.comTel}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>com telefone</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1a0e00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📈</div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--yellow)' }}>
              {stats.total > 0 ? Math.round((stats.fechados / stats.total) * 100) : 0}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>taxa de conversão</div>
          </div>
        </div>
      </div>

      {/* Gráficos row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Leads por dia */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Leads por dia (14d)</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={stats.porDia} barSize={14}>
              <XAxis dataKey="dia" tick={{ fill: '#555e78', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#4f8ef7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status pizza */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Funil por status</div>
          {stats.porStatus.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', paddingTop: 40 }}>Sem dados</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <PieChart width={140} height={140}>
                <Pie data={stats.porStatus} cx={65} cy={65} innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={0}>
                  {stats.porStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stats.porStatus.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--text2)' }}>{s.name}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gráficos row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top UF */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Top estados</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.topUF.slice(0, 6).map((item, i) => (
              <div key={item.uf} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', width: 24 }}>{item.uf}</div>
                <div style={{ flex: 1, height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(item.count / stats.topUF[0].count) * 100}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', width: 24, textAlign: 'right' }}>{item.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top CNAE */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Top segmentos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.topCnae.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.cnae}</div>
                <div style={{ background: 'var(--bg4)', borderRadius: 20, padding: '1px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>{item.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recentes */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Últimos leads captados</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {stats.recentes.map((e, i) => {
            const cfg = STATUS_CONFIG[e.status_prospeccao] || STATUS_CONFIG.novo
            return (
              <div
                key={e.id}
                onClick={() => onOpenLead(e)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0',
                  borderBottom: i < stats.recentes.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={el => el.currentTarget.style.opacity = '0.75'}
                onMouseLeave={el => el.currentTarget.style.opacity = '1'}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                  {(e.razao_social || e.nome_fantasia || '?')[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.nome_fantasia || e.razao_social}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {e.municipio} · {e.uf} · {e.cnae_principal_descricao?.slice(0, 40)}
                  </div>
                </div>
                <span className="badge" style={{ background: cfg.bg, color: cfg.color, flexShrink: 0 }}>
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

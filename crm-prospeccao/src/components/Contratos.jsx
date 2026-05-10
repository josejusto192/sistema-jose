import React, { useState, useMemo } from 'react'
import { PACOTES, CONTRATO_STATUS } from '../constants.js'
import { useTheme } from '../App.jsx'
import { format, addMonths, addBusinessDays, parseISO } from 'date-fns'

function parseDate(str) {
  if (!str) return null
  return str.includes('T') ? new Date(str) : parseISO(str + 'T12:00:00')
}
import { IconSearch, IconInbox, IconLink, IconX, IconPlus, IconTrash, IconEdit } from './Icons.jsx'

const EMPTY_FORM = {
  cliente_nome: '',
  cliente_cnpj: '',
  cliente_email: '',
  cliente_telefone: '',
  empresa_id: '',
  pacote: 'estrutura_digital',
  valor_total: 1997,
  valor_mensal: 997,
  status: 'ativo',
  data_assinatura: format(new Date(), 'yyyy-MM-dd'),
  data_inicio: format(new Date(), 'yyyy-MM-dd'),
  pagamento_sinal: false,
  pagamento_final: false,
  data_entrega_prevista: '',
  data_entrega_real: '',
  duracao_meses: 3,
  renovacao_automatica: true,
  proximo_faturamento: '',
  data_cancelamento: '',
  motivo_churn: '',
  total_recebido: 0,
  observacoes: '',
}

function getBadgeStyle(cfg, theme) {
  return theme === 'dark'
    ? { background: cfg.darkBg, color: cfg.darkColor }
    : { background: cfg.bg, color: cfg.color }
}

function fmt(n) {
  return (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function Contratos({ contratos, empresas, onSave, onDelete, pendingContrato, onClearPending }) {
  const theme = useTheme()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saveError, setSaveError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('todos')
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Abre modal pré-preenchido quando vem de um lead
  React.useEffect(() => {
    if (pendingContrato) {
      setForm({ ...EMPTY_FORM, ...pendingContrato })
      setFieldErrors({})
      setSaveError(null)
      setModal('new')
      onClearPending()
    }
  }, [pendingContrato])

  const metrics = useMemo(() => {
    const ativos = contratos.filter(c => c.status === 'ativo')
    const mrr = ativos.filter(c => c.pacote === 'gestao_trafego').reduce((s, c) => s + (c.valor_mensal || 0), 0)
    const totalAtivos = ativos.length
    const cancelados = contratos.filter(c => c.status === 'cancelado').length
    const churnRate = contratos.length > 0 ? Math.round((cancelados / contratos.length) * 100) : 0
    const ticketMedio = totalAtivos > 0
      ? ativos.reduce((s, c) => s + (c.valor_mensal || c.valor_total || 0), 0) / totalAtivos
      : 0
    return { mrr, arr: mrr * 12, totalAtivos, cancelados, churnRate, ticketMedio }
  }, [contratos])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return contratos.filter(c => {
      if (filterStatus !== 'todos' && c.status !== filterStatus) return false
      if (!q) return true
      return (
        c.cliente_nome?.toLowerCase().includes(q) ||
        c.cliente_cnpj?.includes(q) ||
        c.cliente_email?.toLowerCase().includes(q) ||
        c.observacoes?.toLowerCase().includes(q)
      )
    })
  }, [contratos, filterStatus, search])

  function openNew() {
    setForm({ ...EMPTY_FORM })
    setFieldErrors({})
    setSaveError(null)
    setModal('new')
  }

  function openEdit(c) {
    setFieldErrors({})
    setSaveError(null)
    setForm({
      ...EMPTY_FORM,
      ...c,
      data_assinatura: c.data_assinatura || '',
      data_inicio: c.data_inicio || '',
      data_entrega_prevista: c.data_entrega_prevista || '',
      data_entrega_real: c.data_entrega_real || '',
      proximo_faturamento: c.proximo_faturamento || '',
      data_cancelamento: c.data_cancelamento || '',
    })
    setModal(c)
  }

  function validate(f) {
    const errs = {}
    if (!f.cliente_nome?.trim()) errs.cliente_nome = 'Nome obrigatório'
    if (!f.data_inicio) errs.data_inicio = 'Data de início obrigatória'
    if (f.pacote === 'estrutura_digital' && !(Number(f.valor_total) > 0))
      errs.valor_total = 'Informe o valor total'
    if (f.pacote === 'gestao_trafego' && !(Number(f.valor_mensal) > 0))
      errs.valor_mensal = 'Informe o valor mensal'
    return errs
  }

  function set(field, value) {
    if (fieldErrors[field]) setFieldErrors(e => { const n = { ...e }; delete n[field]; return n })
    setForm(f => {
      const next = { ...f, [field]: value }
      // Auto-calcular datas ao mudar pacote ou inicio
      if (field === 'data_inicio' && value) {
        if (next.pacote === 'estrutura_digital') {
          try {
            const d = new Date(value)
            next.data_entrega_prevista = format(addBusinessDays(d, 5), 'yyyy-MM-dd')
          } catch {}
        }
        if (next.pacote === 'gestao_trafego') {
          try {
            const d = new Date(value)
            next.proximo_faturamento = format(addMonths(d, 1), 'yyyy-MM-dd')
          } catch {}
        }
      }
      if (field === 'pacote') {
        next.valor_total = value === 'estrutura_digital' ? 1997 : null
        next.valor_mensal = value === 'gestao_trafego' ? 997 : null
        next.status = value === 'estrutura_digital' ? 'aguardando_pagamento' : 'ativo'
      }
      if (field === 'empresa_id' && value) {
        const emp = empresas.find(e => e.id === value)
        if (emp) {
          next.cliente_nome = emp.nome_fantasia || emp.razao_social || ''
          next.cliente_cnpj = emp.cnpj || ''
          next.cliente_email = emp.email || ''
          next.cliente_telefone = emp.telefone || ''
        }
      }
      return next
    })
  }

  async function handleSave() {
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setSaving(true)
    setSaveError(null)

    const dateOrNull = v => (v && v.trim() !== '' ? v : null)
    const numOrNull  = v => (v !== '' && v != null ? Number(v) : null)

    const payload = {
      cliente_nome:          form.cliente_nome,
      cliente_cnpj:          form.cliente_cnpj || null,
      cliente_email:         form.cliente_email || null,
      cliente_telefone:      form.cliente_telefone || null,
      empresa_id:            form.empresa_id || null,
      pacote:                form.pacote,
      status:                form.status,
      valor_total:           form.pacote === 'estrutura_digital' ? numOrNull(form.valor_total) ?? 1997 : null,
      valor_mensal:          form.pacote === 'gestao_trafego'    ? numOrNull(form.valor_mensal) ?? 997  : null,
      data_assinatura:       dateOrNull(form.data_assinatura),
      data_inicio:           dateOrNull(form.data_inicio),
      pagamento_sinal:       form.pacote === 'estrutura_digital' ? Boolean(form.pagamento_sinal)  : null,
      pagamento_final:       form.pacote === 'estrutura_digital' ? Boolean(form.pagamento_final)  : null,
      data_entrega_prevista: form.pacote === 'estrutura_digital' ? dateOrNull(form.data_entrega_prevista) : null,
      data_entrega_real:     form.pacote === 'estrutura_digital' ? dateOrNull(form.data_entrega_real)     : null,
      duracao_meses:         form.pacote === 'gestao_trafego'    ? Number(form.duracao_meses) || 3        : null,
      renovacao_automatica:  form.pacote === 'gestao_trafego'    ? Boolean(form.renovacao_automatica)     : null,
      proximo_faturamento:   form.pacote === 'gestao_trafego'    ? dateOrNull(form.proximo_faturamento)   : null,
      data_cancelamento:     dateOrNull(form.data_cancelamento),
      motivo_churn:          form.motivo_churn || null,
      total_recebido:        numOrNull(form.total_recebido) ?? 0,
      observacoes:           form.observacoes || null,
    }

    if (modal !== 'new') payload.id = modal.id
    const ok = await onSave(payload)
    setSaving(false)
    if (ok) {
      setModal(null)
    } else {
      setSaveError('Erro ao salvar. Verifique sua conexão e tente novamente.')
    }
  }

  async function handleDelete(id) {
    await onDelete(id)
    setConfirmDelete(null)
    setModal(null)
  }

  const isED = form.pacote === 'estrutura_digital'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>Contratos</h1>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Gestão de clientes e receita</div>
          </div>
          <button
            onClick={openNew}
            style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            + Novo contrato
          </button>
        </div>

        {/* Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'MRR', value: `R$ ${fmt(metrics.mrr)}`, sub: 'recorrente mensal', color: 'var(--green)' },
            { label: 'ARR projetado', value: `R$ ${fmt(metrics.arr)}`, sub: 'MRR × 12', color: 'var(--cyan)' },
            { label: 'Contratos ativos', value: metrics.totalAtivos, sub: `ticket médio R$ ${fmt(metrics.ticketMedio)}`, color: 'var(--purple)' },
            { label: 'Churn rate', value: `${metrics.churnRate}%`, sub: `${metrics.cancelados} cancelados`, color: metrics.churnRate > 0 ? 'var(--red)' : 'var(--text3)' },
          ].map((m, i) => (
            <div key={i} className="card" style={{ padding: '12px 16px', borderLeft: `3px solid ${m.color}` }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Busca */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Buscar por nome, CNPJ, e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', display: 'flex' }}><IconSearch size={15} color="var(--text3)" /></span>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['todos', 'ativo', 'aguardando_pagamento', 'concluido', 'cancelado'].map(s => {
            const cfg = CONTRATO_STATUS[s]
            const active = filterStatus === s
            return (
              <button key={s} onClick={() => setFilterStatus(s)} style={{
                padding: '4px 12px', borderRadius: 20, border: '1px solid',
                fontSize: 12, cursor: 'pointer', fontWeight: active ? 500 : 400,
                background: active && cfg ? (theme === 'dark' ? cfg.darkBg : cfg.bg) : (active ? 'var(--bg4)' : 'transparent'),
                color: active && cfg ? (theme === 'dark' ? cfg.darkColor : cfg.color) : (active ? 'var(--text)' : 'var(--text3)'),
                borderColor: active && cfg ? `${cfg.dot}60` : 'var(--border)',
              }}>
                {cfg?.label || 'Todos'}
              </button>
            )
          })}
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 32px', background: 'var(--bg)' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ marginBottom: 10, opacity: 0.3 }}><IconInbox size={32} color="var(--text3)" /></div>
            <div style={{ fontSize: 14 }}>Nenhum contrato encontrado</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Clique em "Novo contrato" para adicionar</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(c => {
              const pacote = PACOTES[c.pacote]
              const statusCfg = CONTRATO_STATUS[c.status] || CONTRATO_STATUS.ativo
              const statusStyle = getBadgeStyle(statusCfg, theme)
              const pacoteStyle = getBadgeStyle(pacote, theme)
              const isED = c.pacote === 'estrutura_digital'
              const progresso = isED
                ? (c.pagamento_sinal && c.pagamento_final ? 100 : c.pagamento_sinal ? 50 : 0)
                : null

              return (
                <div
                  key={c.id}
                  className="card"
                  onClick={() => openEdit(c)}
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
                >
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', minWidth: 0 }}>
                    {/* Avatar */}
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--text2)', flexShrink: 0 }}>
                      {(c.cliente_nome || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{c.cliente_nome}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="badge" style={{ ...pacoteStyle, fontSize: 11 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: pacote?.dot }} />
                          {pacote?.label}
                        </span>
                        <span className="badge" style={{ ...statusStyle, fontSize: 11 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusCfg.dot }} />
                          {statusCfg.label}
                        </span>
                        {c.cliente_cnpj && (
                          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                            {c.cliente_cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
                          </span>
                        )}
                        {c.empresa_id && (() => {
                          const emp = empresas.find(e => e.id === c.empresa_id)
                          if (!emp) return null
                          return (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 20 }}>
                              <IconLink size={11} color="var(--accent)" /> {emp.municipio}/{emp.uf}
                            </span>
                          )
                        })()}
                      </div>
                      {/* Progresso pagamento (Estrutura Digital) */}
                      {isED && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 4, maxWidth: 160 }}>
                            <div style={{ height: '100%', width: `${progresso}%`, background: progresso === 100 ? 'var(--green)' : 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {progresso === 100 ? 'Pago integralmente' : progresso === 50 ? '50% pago' : 'Aguardando sinal'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Valor + info */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                      R$ {fmt(isED ? c.valor_total : c.valor_mensal)}
                      {!isED && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text3)' }}>/mês</span>}
                    </div>
                    {isED && c.data_entrega_prevista && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                        Entrega: {format(parseDate(c.data_entrega_prevista), 'dd/MM/yyyy')}
                      </div>
                    )}
                    {!isED && c.proximo_faturamento && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                        Próx. fat.: {format(parseDate(c.proximo_faturamento), 'dd/MM/yyyy')}
                      </div>
                    )}
                    {c.data_inicio && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        Início: {format(parseDate(c.data_inicio), 'dd/MM/yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}
        >
          <div className="card" style={{ width: '100%', maxWidth: 580, maxHeight: '90vh', overflow: 'auto', padding: '24px 28px', background: 'var(--bg2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
                {modal === 'new' ? 'Novo contrato' : 'Editar contrato'}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', padding: 4 }}><IconX size={18} color="var(--text3)" /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Vincular lead */}
              <FormField label="Vincular a um lead (opcional)">
                <select value={form.empresa_id} onChange={e => set('empresa_id', e.target.value)} style={selectStyle}>
                  <option value="">— Sem vínculo —</option>
                  {empresas.map(e => (
                    <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social} — {e.municipio}/{e.uf}</option>
                  ))}
                </select>
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Nome do cliente *" error={fieldErrors.cliente_nome}>
                  <input value={form.cliente_nome} onChange={e => set('cliente_nome', e.target.value)} placeholder="Nome ou razão social" style={errStyle(inputStyle, fieldErrors.cliente_nome)} />
                </FormField>
                <FormField label="CNPJ">
                  <input value={form.cliente_cnpj} onChange={e => set('cliente_cnpj', e.target.value)} placeholder="00.000.000/0001-00" style={inputStyle} />
                </FormField>
                <FormField label="E-mail">
                  <input value={form.cliente_email} onChange={e => set('cliente_email', e.target.value)} placeholder="email@empresa.com" style={inputStyle} />
                </FormField>
                <FormField label="Telefone / WhatsApp">
                  <input value={form.cliente_telefone} onChange={e => set('cliente_telefone', e.target.value)} placeholder="(15) 99999-9999" style={inputStyle} />
                </FormField>
              </div>

              <Divider />

              {/* Pacote */}
              <FormField label="Pacote">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {Object.entries(PACOTES).map(([key, pkg]) => {
                    const active = form.pacote === key
                    const pkgStyle = getBadgeStyle(pkg, theme)
                    return (
                      <div
                        key={key}
                        onClick={() => set('pacote', key)}
                        style={{
                          padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                          border: `2px solid ${active ? pkg.dot : 'var(--border)'}`,
                          background: active ? (theme === 'dark' ? pkg.darkBg : pkg.bg) : 'var(--bg3)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13, color: active ? pkgStyle.color : 'var(--text)' }}>{pkg.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{pkg.descricao}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: active ? pkgStyle.color : 'var(--text2)', marginTop: 6 }}>
                          R$ {pkg.valor.toLocaleString('pt-BR')}{pkg.tipo === 'recorrente' ? '/mês' : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label={isED ? 'Valor total (R$) *' : 'Valor mensal (R$) *'} error={fieldErrors.valor_total || fieldErrors.valor_mensal}>
                  <input
                    type="number"
                    value={isED ? form.valor_total : form.valor_mensal}
                    onChange={e => set(isED ? 'valor_total' : 'valor_mensal', e.target.value)}
                    style={errStyle(inputStyle, fieldErrors.valor_total || fieldErrors.valor_mensal)}
                  />
                </FormField>
                <FormField label="Status">
                  <select value={form.status} onChange={e => set('status', e.target.value)} style={selectStyle}>
                    {Object.entries(CONTRATO_STATUS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Data de assinatura">
                  <input type="date" value={form.data_assinatura} onChange={e => set('data_assinatura', e.target.value)} style={inputStyle} />
                </FormField>
                <FormField label="Data de início *" error={fieldErrors.data_inicio}>
                  <input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} style={errStyle(inputStyle, fieldErrors.data_inicio)} />
                </FormField>
              </div>

              {/* Estrutura Digital */}
              {isED && (
                <>
                  <Divider label="Estrutura Digital" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField label="Entrega prevista">
                      <input type="date" value={form.data_entrega_prevista} onChange={e => set('data_entrega_prevista', e.target.value)} style={inputStyle} />
                    </FormField>
                    <FormField label="Entrega real">
                      <input type="date" value={form.data_entrega_real} onChange={e => set('data_entrega_real', e.target.value)} style={inputStyle} />
                    </FormField>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <CheckField label="Sinal pago (50% — R$ 998,50)" checked={form.pagamento_sinal} onChange={v => set('pagamento_sinal', v)} />
                    <CheckField label="Saldo pago (50% — R$ 998,50)" checked={form.pagamento_final} onChange={v => set('pagamento_final', v)} />
                  </div>
                </>
              )}

              {/* Gestão de Tráfego */}
              {!isED && (
                <>
                  <Divider label="Gestão de Tráfego" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField label="Duração mínima (meses)">
                      <input type="number" min={3} value={form.duracao_meses} onChange={e => set('duracao_meses', e.target.value)} style={inputStyle} />
                    </FormField>
                    <FormField label="Próximo faturamento">
                      <input type="date" value={form.proximo_faturamento} onChange={e => set('proximo_faturamento', e.target.value)} style={inputStyle} />
                    </FormField>
                  </div>
                  <CheckField label="Renovação automática após período mínimo" checked={form.renovacao_automatica} onChange={v => set('renovacao_automatica', v)} />
                  {form.status === 'cancelado' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FormField label="Data de cancelamento">
                        <input type="date" value={form.data_cancelamento} onChange={e => set('data_cancelamento', e.target.value)} style={inputStyle} />
                      </FormField>
                      <FormField label="Motivo do churn">
                        <input value={form.motivo_churn} onChange={e => set('motivo_churn', e.target.value)} placeholder="Ex: preço, resultado..." style={inputStyle} />
                      </FormField>
                    </div>
                  )}
                </>
              )}

              <Divider />
              <FormField label="Total recebido (R$)">
                <input type="number" value={form.total_recebido} onChange={e => set('total_recebido', e.target.value)} style={inputStyle} />
              </FormField>
              <FormField label="Observações">
                <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={3} placeholder="Notas sobre o contrato..." style={{ ...inputStyle, resize: 'vertical' }} />
              </FormField>
            </div>

            {/* Banner de erro da API */}
            {saveError && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 8, fontSize: 13, color: 'var(--red)' }}>
                ⚠️ {saveError}
              </div>
            )}

            {/* Ações */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'space-between' }}>
              <div>
                {modal !== 'new' && (
                  confirmDelete === modal.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--red)' }}>Confirmar exclusão?</span>
                      <button onClick={() => handleDelete(modal.id)} style={{ padding: '6px 12px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Sim</button>
                      <button onClick={() => setConfirmDelete(null)} style={{ padding: '6px 12px', background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Não</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(modal.id)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--red)', fontSize: 13, cursor: 'pointer' }}>
                      Excluir
                    </button>
                  )
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setModal(null)} style={{ padding: '8px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !form.cliente_nome.trim()} style={{ padding: '8px 20px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helpers de UI
const inputStyle = {
  width: '100%', padding: '8px 10px',
  background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
}

const selectStyle = { ...inputStyle, cursor: 'pointer' }

function errStyle(base, error) {
  return error ? { ...base, border: '1px solid var(--red)' } : base
}

function FormField({ label, error, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: error ? 'var(--red)' : 'var(--text3)', display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
      {error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{error}</div>}
    </div>
  )
}

function CheckField({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
      {label}
    </label>
  )
}

function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {label && <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', fontWeight: 500 }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

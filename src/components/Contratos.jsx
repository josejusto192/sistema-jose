import React, { useState, useMemo, useEffect } from 'react'
import { PACOTES as PACOTES_FALLBACK, CONTRATO_STATUS, leadName } from '../constants.js'
import { useTheme, useIsSuperAdmin } from '../App.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { format, addMonths, addBusinessDays, parseISO } from 'date-fns'
import { supabase } from '../supabase.js'
import Briefing from './Briefing.jsx'
import { IconSearch, IconInbox, IconLink, IconX } from './Icons.jsx'
import { InfoTooltip } from './Tooltip.jsx'

function parseDate(str) {
  if (!str) return null
  return str.includes('T') ? new Date(str) : parseISO(str + 'T12:00:00')
}

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
  vendedor_id: '',
  vendedor_nome: '',
  comissao_percentual: 10,
  comissao_valor: 0,
  comissao_status: 'pendente',
  comissao_paga_em: '',
  comprovante_url: '',
}

function getBadgeStyle(cfg, theme) {
  if (!cfg) return { background: 'var(--bg3)', color: 'var(--text3)' }
  // DB pacote (has .cor field)
  if (cfg.cor) {
    return { background: cfg.cor + (theme === 'dark' ? '30' : '18'), color: cfg.cor }
  }
  return theme === 'dark'
    ? { background: cfg.darkBg, color: cfg.darkColor }
    : { background: cfg.bg, color: cfg.color }
}

function fmt(n) {
  return (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function Contratos({ contratos, empresas, onSave, onDelete, pendingContrato, onClearPending }) {
  const theme = useTheme()
  const isSuperAdmin = useIsSuperAdmin()
  const isMobile = useIsMobile()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saveError, setSaveError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('todos')
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [pacotesList, setPacotesList] = useState([])
  const [selectedContrato, setSelectedContrato] = useState(null)
  const [detailTab, setDetailTab] = useState('dados')

  const [uploadingComp, setUploadingComp] = useState(false)

  // Resolve a package by codigo: DB first, fallback to hardcoded constants
  function getPacote(codigo) {
    const db = pacotesList.find(p => p.codigo === codigo)
    if (db) return { ...db, label: db.nome, dot: db.cor || '#3B82F6' }
    const fallback = PACOTES_FALLBACK[codigo]
    return fallback ? { ...fallback, cor: fallback.dot } : null
  }

  function isPontual(codigo) {
    const p = getPacote(codigo)
    return p ? p.tipo === 'pontual' || p.tipo === 'unico' : codigo === 'estrutura_digital'
  }

  useEffect(() => {
    supabase.from('profiles').select('id, nome, sobrenome, comissao_percentual, tipo_pix, chave_pix').eq('ativo', true)
      .then(({ data }) => setProfiles(data || []))
    supabase.from('pacotes').select('*').eq('ativo', true).order('criado_em')
      .then(({ data }) => setPacotesList(data || []))
  }, [])

  // Fecha modal/detail com ESC
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') {
        if (modal) setModal(null)
        else if (selectedContrato) setSelectedContrato(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, selectedContrato])

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
    const mrr = ativos.filter(c => !isPontual(c.pacote)).reduce((s, c) => s + (c.valor_mensal || 0), 0)
    const totalAtivos = ativos.length
    const cancelados = contratos.filter(c => c.status === 'cancelado').length
    const baseChurn  = ativos.length + cancelados
    const churnRate  = baseChurn > 0 ? Math.round((cancelados / baseChurn) * 100) : 0
    const ticketMedio = totalAtivos > 0
      ? ativos.reduce((s, c) => s + (c.valor_mensal || c.valor_total || 0), 0) / totalAtivos
      : 0
    return { mrr, arr: mrr * 12, totalAtivos, cancelados, churnRate, ticketMedio, baseChurn }
  }, [contratos, pacotesList])

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
      vendedor_id:          c.vendedor_id || '',
      vendedor_nome:        c.vendedor_nome || '',
      comissao_percentual:  c.comissao_percentual ?? 10,
      comissao_valor:       c.comissao_valor ?? 0,
      comissao_status:      c.comissao_status || 'pendente',
      comissao_paga_em:     c.comissao_paga_em || '',
      comprovante_url:      c.comprovante_url || '',
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
        const pkg = getPacote(value)
        const pontual = pkg ? (pkg.tipo === 'pontual' || pkg.tipo === 'unico') : value === 'estrutura_digital'
        next.valor_total = pontual ? (pkg?.valor || null) : null
        next.valor_mensal = !pontual ? (pkg?.valor || null) : null
        next.status = pontual ? 'aguardando_pagamento' : 'ativo'
      }
      if (field === 'empresa_id' && value) {
        const emp = empresas.find(e => e.id === value)
        if (emp) {
          next.cliente_nome = leadName(emp)
          next.cliente_cnpj = emp.cnpj || ''
          next.cliente_email = emp.email || ''
          next.cliente_telefone = emp.telefone || ''
        }
      }
      // Recalculate commission value whenever valor or % changes
      if (['valor_total','valor_mensal','comissao_percentual','pacote'].includes(field)) {
        const base = isPontual(next.pacote)
          ? Number(next.valor_total) || 0
          : Number(next.valor_mensal) || 0
        next.comissao_valor = parseFloat(((base * (Number(next.comissao_percentual) || 0)) / 100).toFixed(2))
      }
      // When vendor changes, fill their commission %
      if (field === 'vendedor_id' && value) {
        const prof = profiles.find(p => p.id === value)
        if (prof?.comissao_percentual != null) {
          next.comissao_percentual = Number(prof.comissao_percentual)
          const base = next.pacote === 'estrutura_digital'
            ? Number(next.valor_total) || 0
            : Number(next.valor_mensal) || 0
          next.comissao_valor = parseFloat(((base * next.comissao_percentual) / 100).toFixed(2))
        }
      }
      return next
    })
  }

  async function handleUploadComprovante(file, contratoId) {
    if (!file || !contratoId) return
    setUploadingComp(true)
    const ext = file.name.split('.').pop()
    const path = `${contratoId}/comprovante.${ext}`
    const { error } = await supabase.storage.from('comprovantes').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('comprovantes').getPublicUrl(path)
      set('comprovante_url', data.publicUrl + '?t=' + Date.now())
    }
    setUploadingComp(false)
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
      valor_total:           isED ? numOrNull(form.valor_total) ?? getPacote(form.pacote)?.valor ?? 0 : null,
      valor_mensal:          !isED ? numOrNull(form.valor_mensal) ?? getPacote(form.pacote)?.valor ?? 0 : null,
      data_assinatura:       dateOrNull(form.data_assinatura),
      data_inicio:           dateOrNull(form.data_inicio),
      pagamento_sinal:       isED ? Boolean(form.pagamento_sinal)  : null,
      pagamento_final:       isED ? Boolean(form.pagamento_final)  : null,
      data_entrega_prevista: isED ? dateOrNull(form.data_entrega_prevista) : null,
      data_entrega_real:     isED ? dateOrNull(form.data_entrega_real)     : null,
      duracao_meses:         !isED ? Number(form.duracao_meses) || 3        : null,
      renovacao_automatica:  !isED ? Boolean(form.renovacao_automatica)     : null,
      proximo_faturamento:   !isED ? dateOrNull(form.proximo_faturamento)   : null,
      data_cancelamento:     dateOrNull(form.data_cancelamento),
      motivo_churn:          form.motivo_churn || null,
      total_recebido:        numOrNull(form.total_recebido) ?? 0,
      observacoes:           form.observacoes || null,
      vendedor_id:           form.vendedor_id || null,
      vendedor_nome:         form.vendedor_nome || null,
      comissao_percentual:   form.comissao_percentual != null ? Number(form.comissao_percentual) : null,
      comissao_valor:        form.comissao_valor != null ? Number(form.comissao_valor) : null,
      comissao_status:       form.comissao_status || 'pendente',
      comissao_paga_em:      form.comissao_paga_em || null,
      comprovante_url:       form.comprovante_url || null,
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

  const isED = isPontual(form.pacote)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>Contratos</h1>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Gestão de clientes e receita</div>
          </div>
          {isSuperAdmin && (
            <button
              onClick={openNew}
              style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              + Novo contrato
            </button>
          )}
        </div>

        {/* Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'MRR', value: `R$ ${fmt(metrics.mrr)}`, sub: 'recorrente mensal', color: 'var(--green)', tooltip: 'Receita Recorrente Mensal.\nSoma do valor mensal de todos os contratos recorrentes ativos.\nNão inclui serviços pontuais como Estrutura Digital.' },
            { label: 'ARR projetado', value: `R$ ${fmt(metrics.arr)}`, sub: 'MRR × 12', color: 'var(--cyan)', tooltip: 'Receita Anual Recorrente projetada.\nCalculado como MRR × 12 meses.\nAssume que os contratos ativos serão mantidos.' },
            { label: 'Contratos ativos', value: metrics.totalAtivos, sub: `ticket médio R$ ${fmt(metrics.ticketMedio)}`, color: 'var(--purple)', tooltip: 'Número de contratos com status Ativo.\nTicket médio = receita total ÷ nº de contratos ativos.' },
            { label: 'Churn rate', value: `${metrics.churnRate}%`, sub: `${metrics.cancelados} de ${metrics.cancelados + metrics.totalAtivos} contratos`, color: metrics.churnRate > 0 ? 'var(--red)' : 'var(--text3)', tooltip: 'Percentual de contratos cancelados em relação ao total.\nCálculo: cancelados ÷ (ativos + cancelados).\nMeta: manter abaixo de 5%.' },
          ].map((m, i) => (
            <div key={i} className="card" style={{ padding: '12px 16px', borderLeft: `3px solid ${m.color}` }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                {m.label}
                {m.tooltip && <InfoTooltip text={m.tooltip} width={220} dir="down" />}
              </div>
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
              const pacote = getPacote(c.pacote)
              const statusCfg = CONTRATO_STATUS[c.status] || CONTRATO_STATUS.ativo
              const statusStyle = getBadgeStyle(statusCfg, theme)
              const pacoteStyle = getBadgeStyle(pacote, theme)
              const isED = isPontual(c.pacote)
              const progresso = isED
                ? (c.pagamento_sinal && c.pagamento_final ? 100 : c.pagamento_sinal ? 50 : 0)
                : null

              return (
                <div
                  key={c.id}
                  className="card"
                  onClick={() => { setSelectedContrato(c); setDetailTab('dados') }}
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
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: pacote?.dot || pacote?.cor }} />
                          {pacote?.label || pacote?.nome || c.pacote}
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
                        {c.vendedor_nome && (
                          <span style={{ fontSize: 11, color: 'var(--text3)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg3)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 20 }}>
                            {c.vendedor_nome}
                          </span>
                        )}
                        {c.comissao_valor > 0 && (
                          <span style={{
                            fontSize: 11, padding: '1px 7px', borderRadius: 20,
                            background: c.comissao_status === 'paga' ? 'var(--green-bg)' : 'var(--bg3)',
                            color: c.comissao_status === 'paga' ? 'var(--green)' : 'var(--text3)',
                            border: `1px solid ${c.comissao_status === 'paga' ? 'var(--green)30' : 'var(--border)'}`,
                          }}>
                            Comissão R$ {Number(c.comissao_valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})} · {c.comissao_status === 'paga' ? 'Paga ✓' : c.comissao_status === 'cancelada' ? 'Cancelada' : 'Pendente'}
                          </span>
                        )}
                        {c.comprovante_url && (
                          <a
                            href={c.comprovante_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: 11, color: 'var(--accent)', padding: '1px 7px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg3)', textDecoration: 'none' }}
                          >
                            Comprovante
                          </a>
                        )}
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

      {/* Detail panel */}
      {selectedContrato && !modal && (() => {
        const c = selectedContrato
        const pacote = getPacote(c.pacote)
        const statusCfg = CONTRATO_STATUS[c.status] || CONTRATO_STATUS.ativo
        const pacoteStyle = getBadgeStyle(pacote, theme)
        const statusStyle = getBadgeStyle(statusCfg, theme)
        const isEDc = isPontual(c.pacote)
        const vendPerfil = profiles.find(p => p.id === c.vendedor_id)
        function fmtBRL(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'flex-end', zIndex: 100 }}
            onClick={e => e.target === e.currentTarget && setSelectedContrato(null)}
          >
            <div
              className="card"
              style={{
                width: '100%', maxWidth: isMobile ? '100%' : 560,
                height: isMobile ? '92dvh' : '100vh',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                background: 'var(--bg2)', borderRadius: isMobile ? '16px 16px 0 0' : 0,
                borderLeft: isMobile ? 'none' : '1px solid var(--border)',
              }}
            >
              {/* Detail header */}
              <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{c.cliente_nome}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="badge" style={{ ...pacoteStyle, fontSize: 11 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: pacote?.dot || pacote?.cor }} />
                        {pacote?.label || pacote?.nome || c.pacote}
                      </span>
                      <span className="badge" style={{ ...statusStyle, fontSize: 11 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusCfg.dot }} />
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                    {isSuperAdmin && (
                      <button
                        onClick={() => openEdit(c)}
                        style={{ padding: '6px 14px', background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                      >
                        Editar
                      </button>
                    )}
                    <button onClick={() => setSelectedContrato(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', padding: 4 }}>
                      <IconX size={18} color="var(--text3)" />
                    </button>
                  </div>
                </div>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0 }}>
                  {['dados', 'briefing'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      style={{
                        padding: '8px 18px', fontSize: 13, fontWeight: detailTab === tab ? 600 : 400,
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        color: detailTab === tab ? 'var(--accent)' : 'var(--text3)',
                        borderBottom: detailTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                        marginBottom: -1, transition: 'all 0.1s',
                      }}
                    >
                      {tab === 'dados' ? 'Dados' : 'Briefing'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail content */}
              <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                {detailTab === 'dados' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Value */}
                    <div className="card" style={{ padding: '16px 20px', borderLeft: '3px solid var(--accent)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                        {isEDc ? 'Valor total' : 'Valor mensal'}
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                        R$ {fmtBRL(isEDc ? c.valor_total : c.valor_mensal)}
                        {!isEDc && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text3)' }}>/mês</span>}
                      </div>
                      {c.total_recebido > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                          Recebido: R$ {fmtBRL(c.total_recebido)}
                        </div>
                      )}
                    </div>

                    {/* Dates grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { label: 'Assinatura', val: c.data_assinatura },
                        { label: 'Início', val: c.data_inicio },
                        isEDc && { label: 'Entrega prevista', val: c.data_entrega_prevista },
                        isEDc && { label: 'Entrega real', val: c.data_entrega_real },
                        !isEDc && { label: 'Próx. faturamento', val: c.proximo_faturamento },
                        c.data_cancelamento && { label: 'Cancelamento', val: c.data_cancelamento },
                      ].filter(Boolean).map(({ label, val }) => val ? (
                        <div key={label} style={{ padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                            {(() => { try { return format(parseDate(val), 'dd/MM/yyyy') } catch { return val } })()}
                          </div>
                        </div>
                      ) : null)}
                    </div>

                    {/* Estrutura Digital payment */}
                    {isEDc && (
                      <div style={{ padding: '12px 16px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pagamento</div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.pagamento_sinal ? 'var(--green)' : 'var(--border)', flexShrink: 0 }} />
                            <span style={{ color: c.pagamento_sinal ? 'var(--green)' : 'var(--text3)' }}>Sinal (50%)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.pagamento_final ? 'var(--green)' : 'var(--border)', flexShrink: 0 }} />
                            <span style={{ color: c.pagamento_final ? 'var(--green)' : 'var(--text3)' }}>Saldo (50%)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Commission */}
                    {c.comissao_valor > 0 && (
                      <div style={{ padding: '12px 16px', background: c.comissao_status === 'paga' ? 'var(--green-bg)' : 'var(--bg3)', borderRadius: 8, border: `1px solid ${c.comissao_status === 'paga' ? 'var(--green)30' : 'var(--border)'}` }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comissão</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: c.comissao_status === 'paga' ? 'var(--green)' : 'var(--text)' }}>
                              R$ {fmtBRL(c.comissao_valor)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                              {c.comissao_percentual}% · {c.vendedor_nome || '—'}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 12, padding: '4px 10px', borderRadius: 20, fontWeight: 600,
                            background: c.comissao_status === 'paga' ? 'var(--green)20' : c.comissao_status === 'cancelada' ? 'var(--red)10' : 'var(--bg4)',
                            color: c.comissao_status === 'paga' ? 'var(--green)' : c.comissao_status === 'cancelada' ? 'var(--red)' : 'var(--text3)',
                          }}>
                            {c.comissao_status === 'paga' ? 'Paga ✓' : c.comissao_status === 'cancelada' ? 'Cancelada' : 'Pendente'}
                          </span>
                        </div>
                        {c.comissao_paga_em && (
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                            Paga em: {(() => { try { return format(parseDate(c.comissao_paga_em), 'dd/MM/yyyy') } catch { return c.comissao_paga_em } })()}
                          </div>
                        )}
                        {/* PIX info (superadmin) */}
                        {isSuperAdmin && vendPerfil?.chave_pix && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                              <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg4)', padding: '1px 5px', borderRadius: 3, marginRight: 6 }}>
                                {(vendPerfil.tipo_pix || 'PIX').toUpperCase()}
                              </span>
                              <span style={{ fontFamily: 'var(--font-mono)' }}>{vendPerfil.chave_pix}</span>
                            </div>
                            <button
                              onClick={() => navigator.clipboard.writeText(vendPerfil.chave_pix)}
                              style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: '3px 8px', fontFamily: 'inherit' }}
                            >
                              Copiar PIX
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Comprovante */}
                    {c.comprovante_url && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>Comprovante de pagamento</span>
                        <a href={c.comprovante_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg2)' }}>
                          Visualizar
                        </a>
                      </div>
                    )}

                    {/* Notes */}
                    {c.observacoes && (
                      <div style={{ padding: '12px 16px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observações</div>
                        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.observacoes}</div>
                      </div>
                    )}

                    {/* Cancellation reason */}
                    {c.motivo_churn && (
                      <div style={{ padding: '12px 16px', background: 'var(--red)10', borderRadius: 8, border: '1px solid var(--red)30' }}>
                        <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Motivo do cancelamento</div>
                        <div style={{ fontSize: 13, color: 'var(--text2)' }}>{c.motivo_churn}</div>
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'briefing' && (
                  <Briefing contrato={selectedContrato} />
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 100, padding: isMobile ? 0 : 20 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}
        >
          <div className="card" style={{ width: '100%', maxWidth: isMobile ? '100%' : 580, maxHeight: isMobile ? '92dvh' : '90vh', overflow: 'auto', padding: isMobile ? '20px 18px' : '24px 28px', background: 'var(--bg2)', borderRadius: isMobile ? '16px 16px 0 0' : 12 }}>
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
                    <option key={e.id} value={e.id}>{leadName(e)}{e.municipio ? ` — ${e.municipio}/${e.uf}` : ''}</option>
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
              <FormField label="Serviço / Pacote">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {(pacotesList.length > 0 ? pacotesList : Object.values(PACOTES_FALLBACK).map((p, i) => ({ ...p, codigo: Object.keys(PACOTES_FALLBACK)[i], nome: p.label }))).map(pkg => {
                    const codigo = pkg.codigo || pkg.key
                    const active = form.pacote === codigo
                    const cor = pkg.cor || pkg.dot || '#3B82F6'
                    const pkgStyle = getBadgeStyle(pkg, theme)
                    const pontual = pkg.tipo === 'pontual' || pkg.tipo === 'unico'
                    return (
                      <div
                        key={codigo}
                        onClick={() => set('pacote', codigo)}
                        style={{
                          padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                          border: `2px solid ${active ? cor : 'var(--border)'}`,
                          background: active ? cor + (theme === 'dark' ? '22' : '12') : 'var(--bg3)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13, color: active ? cor : 'var(--text)' }}>{pkg.nome || pkg.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{pkg.descricao}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: active ? cor : 'var(--text2)', marginTop: 6 }}>
                          R$ {Number(pkg.valor).toLocaleString('pt-BR')}{!pontual ? '/mês' : ''}
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

              <Divider label="Comissão do vendedor" />

              {isSuperAdmin ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormField label="Vendedor responsável">
                    <select
                      value={form.vendedor_id}
                      onChange={e => {
                        const prof = profiles.find(p => p.id === e.target.value)
                        set('vendedor_nome', prof ? [prof.nome, prof.sobrenome].filter(Boolean).join(' ') : '')
                        set('vendedor_id', e.target.value)
                      }}
                      style={selectStyle}
                    >
                      <option value="">— Nenhum —</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>
                          {[p.nome, p.sobrenome].filter(Boolean).join(' ')}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Comissão (%)">
                    <input
                      type="number"
                      min={0} max={100} step={0.5}
                      value={form.comissao_percentual}
                      onChange={e => set('comissao_percentual', e.target.value)}
                      style={inputStyle}
                    />
                  </FormField>
                </div>
              ) : (
                /* Vendedor: somente leitura */
                form.vendedor_nome && (
                  <div style={{ padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Responsável pelo contrato</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{form.vendedor_nome}</div>
                  </div>
                )
              )}

              {form.comissao_valor > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--green-bg)', border: '1px solid var(--green)30', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>Comissão</span>
                    {!isSuperAdmin && (
                      <div style={{ fontSize: 11, color: 'var(--green)', opacity: 0.8, marginTop: 2 }}>
                        {form.comissao_status === 'paga' ? 'Paga ✓' : 'Pendente'}
                        {form.comissao_paga_em ? ` · ${form.comissao_paga_em.slice(0,10)}` : ''}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>
                    R$ {Number(form.comissao_valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {isSuperAdmin && modal !== 'new' && (() => {
                const vendPerfil = profiles.find(p => p.id === form.vendedor_id)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FormField label="Status da comissão">
                        <select value={form.comissao_status} onChange={e => {
                          set('comissao_status', e.target.value)
                          if (e.target.value === 'paga' && !form.comissao_paga_em) {
                            set('comissao_paga_em', format(new Date(), 'yyyy-MM-dd'))
                          }
                        }} style={selectStyle}>
                          <option value="pendente">Pendente</option>
                          <option value="paga">Paga</option>
                          <option value="cancelada">Cancelada</option>
                        </select>
                      </FormField>
                      {form.comissao_status === 'paga' && (
                        <FormField label="Data do pagamento">
                          <input type="date" value={form.comissao_paga_em ? form.comissao_paga_em.slice(0,10) : ''} onChange={e => set('comissao_paga_em', e.target.value)} style={inputStyle} />
                        </FormField>
                      )}
                    </div>

                    {/* PIX do vendedor */}
                    {form.vendedor_id && (
                      <div style={{ padding: '12px 14px', background: 'var(--bg3)', borderRadius: 6, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>PIX DO VENDEDOR</div>
                        {vendPerfil?.chave_pix ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div>
                              <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg4)', padding: '1px 6px', borderRadius: 3, marginRight: 8 }}>
                                {(vendPerfil.tipo_pix || 'PIX').toUpperCase()}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                                {vendPerfil.chave_pix}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(vendPerfil.chave_pix)}
                              style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: '4px 10px', fontFamily: 'inherit', flexShrink: 0 }}
                            >
                              Copiar
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                            {vendPerfil ? 'Vendedor não cadastrou chave PIX ainda.' : 'Selecione um vendedor para ver o PIX.'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Comprovante */}
                    <FormField label="Comprovante de pagamento">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <label style={{
                            flex: 1, padding: '7px 12px', background: 'var(--bg3)', border: '1px dashed var(--border)',
                            borderRadius: 6, fontSize: 12, color: 'var(--text3)', cursor: uploadingComp ? 'default' : 'pointer',
                            textAlign: 'center', display: 'block',
                          }}>
                            {uploadingComp ? 'Enviando...' : '+ Selecionar arquivo (imagem ou PDF)'}
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              style={{ display: 'none' }}
                              disabled={uploadingComp}
                              onChange={e => {
                                const file = e.target.files?.[0]
                                if (file && modal?.id) handleUploadComprovante(file, modal.id)
                              }}
                            />
                          </label>
                        </div>
                        {form.comprovante_url && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--green-bg)', border: '1px solid var(--green)30', borderRadius: 6 }}>
                            <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>Comprovante anexado</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <a href={form.comprovante_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg2)' }}>
                                Visualizar
                              </a>
                              <button type="button" onClick={() => set('comprovante_url', '')} style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px' }}>
                                Remover
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </FormField>
                  </div>
                )
              })()}

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
                {isSuperAdmin && modal !== 'new' && (
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

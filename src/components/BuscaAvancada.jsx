import React, { useState, useCallback } from 'react'
import { supabase } from '../supabase.js'
import { useIsSuperAdmin, useProfile } from '../App.jsx'
import { IconSearch, IconPlus, IconCheck, IconX, IconArrowLeft } from './Icons.jsx'

const API_URL = 'https://api.casadosdados.com.br/v5/cnpj/pesquisa'
const API_KEY = import.meta.env.VITE_CASA_DADOS_KEY

const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const SITUACOES = ['ATIVA','INAPTA','BAIXADA','SUSPENSA','NULA']
const PORTES    = [{ value: 'ME', label: 'MEI/ME' }, { value: 'EPP', label: 'EPP' }, { value: 'DEMAIS', label: 'Demais' }]

const EMPTY_FORM = {
  termo: '',
  ufs: [],
  municipio: '',
  bairro: '',
  cep: '',
  ddd: '',
  cnae: '',
  natureza_juridica: '',
  situacao: '',
  portes: [],
  abertura_de: '',
  abertura_ate: '',
  capital_min: '',
  capital_max: '',
  somente_mei: false,
  excluir_mei: false,
  com_email: false,
  com_telefone: false,
}

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 14px', background: 'var(--bg2)', border: 'none', cursor: 'pointer',
          color: 'var(--text)', fontSize: 12, fontWeight: 600,
        }}
      >
        {title}
        <span style={{ color: 'var(--text3)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '12px 14px', background: 'var(--bg)', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Field({ label, style, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

const inp = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, outline: 'none',
}

function UfPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {UF_LIST.map(uf => {
        const sel = value.includes(uf)
        return (
          <button
            key={uf}
            onClick={() => onChange(sel ? value.filter(u => u !== uf) : [...value, uf])}
            style={{
              padding: '3px 7px', borderRadius: 4, border: '1px solid var(--border)',
              background: sel ? 'var(--accent)' : 'var(--bg2)', color: sel ? '#fff' : 'var(--text2)',
              fontSize: 11, cursor: 'pointer', fontWeight: sel ? 600 : 400,
            }}
          >{uf}</button>
        )
      })}
    </div>
  )
}

function PortePicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {PORTES.map(p => {
        const sel = value.includes(p.value)
        return (
          <button
            key={p.value}
            onClick={() => onChange(sel ? value.filter(v => v !== p.value) : [...value, p.value])}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
              background: sel ? 'var(--accent)' : 'var(--bg2)', color: sel ? '#fff' : 'var(--text2)',
              fontSize: 11, cursor: 'pointer', fontWeight: sel ? 600 : 400,
            }}
          >{p.label}</button>
        )
      })}
    </div>
  )
}

function Toggle({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text2)' }}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 32, height: 18, borderRadius: 9, background: value ? 'var(--accent)' : 'var(--border)',
          position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: value ? 14 : 2, width: 14, height: 14,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
        }} />
      </div>
      {label}
    </label>
  )
}

function buildBody(form, page) {
  const query = {}
  if (form.termo.trim()) query.termo = [form.termo.trim()]
  if (form.ufs.length) query.uf = form.ufs
  if (form.municipio.trim()) query.municipio = [form.municipio.trim().toUpperCase()]
  if (form.bairro.trim()) query.bairro = [form.bairro.trim().toUpperCase()]
  if (form.cep.trim()) query.cep = [form.cep.replace(/\D/g, '')]
  if (form.ddd.trim()) query.ddd = [form.ddd.trim()]
  if (form.cnae.trim()) query.cnae_principal = { codigo: form.cnae.split(',').map(c => c.trim()).filter(Boolean) }
  if (form.natureza_juridica.trim()) query.natureza_juridica = { codigo: form.natureza_juridica.split(',').map(c => c.trim()).filter(Boolean) }
  if (form.situacao) query.situacao_cadastral = form.situacao
  if (form.portes.length) query.porte = form.portes
  if (form.com_email) query.com_email = true
  if (form.com_telefone) query.com_telefone = true

  const range_query = {}
  if (form.abertura_de || form.abertura_ate) {
    range_query.data_abertura = {}
    if (form.abertura_de) range_query.data_abertura.gte = form.abertura_de
    if (form.abertura_ate) range_query.data_abertura.lte = form.abertura_ate
  }
  if (form.capital_min !== '' || form.capital_max !== '') {
    range_query.capital_social = {}
    if (form.capital_min !== '') range_query.capital_social.gte = Number(form.capital_min)
    if (form.capital_max !== '') range_query.capital_social.lte = Number(form.capital_max)
  }

  const extras = {
    somente_mei: form.somente_mei,
    excluir_mei: form.excluir_mei,
    com_contato_telefonico: false,
    somente_fixo: false,
    somente_celular: false,
    somente_matrix: false,
  }

  return { query, range_query, extras, page }
}

function formatCNPJ(raw) {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length !== 14) return raw || ''
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function formatDate(d) {
  if (!d) return '—'
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return d
}

function formatCurrency(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

function situacaoColor(s) {
  if (s === 'ATIVA') return '#22c55e'
  if (s === 'BAIXADA') return '#ef4444'
  if (s === 'INAPTA') return '#f59e0b'
  return '#6b7280'
}

export default function BuscaAvancada({ onCreateLead, existingCnpjs = [], profiles = [] }) {
  const isSuperAdmin = useIsSuperAdmin()
  const profile      = useProfile()
  const [form, setForm]         = useState(EMPTY_FORM)
  const [results, setResults]   = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [saved, setSaved]       = useState({})   // cnpj → true
  const [saving, setSaving]     = useState({})   // cnpj → true
  const [savingAll, setSavingAll] = useState(false)
  const [assignTo, setAssignTo] = useState('')   // vendedor_id for admin assignment

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const inDb = useCallback((cnpj) => {
    const raw = (cnpj || '').replace(/\D/g, '')
    return existingCnpjs.includes(raw) || existingCnpjs.includes(cnpj)
  }, [existingCnpjs])

  async function search(p = 1) {
    if (!API_KEY) {
      setError('Variável VITE_CASA_DADOS_KEY não configurada.')
      return
    }
    setLoading(true)
    setError('')
    setPage(p)
    try {
      const res = await fetch(`${API_URL}?tipo_resultado=completo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': API_KEY },
        body: JSON.stringify(buildBody(form, p)),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`API erro ${res.status}: ${txt.slice(0, 200)}`)
      }
      const json = await res.json()
      const list  = json?.data?.cnpj || []
      const count = json?.data?.count || 0
      setResults(list)
      setTotal(count)
    } catch (e) {
      setError(e.message || 'Erro ao consultar a API')
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    search(1)
  }

  function buildLeadPayload(item) {
    const cnpjRaw = (item.cnpj || '').replace(/\D/g, '')
    const tel = item.telefones?.[0]?.numero || item.telefone || null
    const vendedorId = isSuperAdmin
      ? (assignTo || null)
      : (profile?.id || null)

    return {
      tipo: 'empresa',
      cnpj: cnpjRaw || null,
      razao_social: item.razao_social || null,
      nome_fantasia: item.nome_fantasia || null,
      municipio: item.municipio || null,
      uf: item.uf || null,
      email: item.email || null,
      telefone: tel ? String(tel) : null,
      cnae_principal_codigo: item.cnae_principal?.codigo || null,
      cnae_principal_descricao: item.cnae_principal?.descricao || null,
      porte: item.porte || null,
      capital_social: item.capital_social || null,
      data_abertura: item.data_abertura || null,
      situacao_cadastral: item.situacao_cadastral || null,
      origem: 'casa_dos_dados',
      status_prospeccao: 'novo',
      vendedor_id: vendedorId,
    }
  }

  async function saveOne(item) {
    const key = item.cnpj
    setSaving(prev => ({ ...prev, [key]: true }))
    try {
      const payload = buildLeadPayload(item)
      await onCreateLead(payload)
      setSaved(prev => ({ ...prev, [key]: true }))
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }))
    }
  }

  async function saveAll() {
    const toSave = results.filter(item => !inDb(item.cnpj) && !saved[item.cnpj])
    if (!toSave.length) return
    setSavingAll(true)
    for (const item of toSave) {
      const key = item.cnpj
      setSaving(prev => ({ ...prev, [key]: true }))
      try {
        const payload = buildLeadPayload(item)
        await onCreateLead(payload)
        setSaved(prev => ({ ...prev, [key]: true }))
      } catch {}
      setSaving(prev => ({ ...prev, [key]: false }))
    }
    setSavingAll(false)
  }

  const totalPages = Math.ceil(total / 20) || 0
  const newCount   = results.filter(r => !inDb(r.cnpj) && !saved[r.cnpj]).length

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Busca Avançada</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
          Encontre empresas pelo CNPJ via Casa dos Dados e importe como leads.
        </p>
      </div>

      <form onSubmit={handleSearch}>
        {/* Busca Textual */}
        <Section title="Busca Textual" defaultOpen>
          <Field label="Palavra-chave (razão social, fantasia, etc.)" style={{ flex: '1 1 100%' }}>
            <input
              value={form.termo}
              onChange={e => set('termo', e.target.value)}
              placeholder="Ex: restaurante, clínica, transporte..."
              style={{ ...inp, width: '100%' }}
            />
          </Field>
        </Section>

        {/* Localização */}
        <Section title="Localização">
          <Field label="Estado (UF)" style={{ flex: '1 1 100%' }}>
            <UfPicker value={form.ufs} onChange={v => set('ufs', v)} />
          </Field>
          <Field label="Município" style={{ flex: '1 1 200px' }}>
            <input value={form.municipio} onChange={e => set('municipio', e.target.value)} placeholder="SAO PAULO" style={inp} />
          </Field>
          <Field label="Bairro" style={{ flex: '1 1 160px' }}>
            <input value={form.bairro} onChange={e => set('bairro', e.target.value)} placeholder="Centro" style={inp} />
          </Field>
          <Field label="CEP" style={{ flex: '0 1 120px' }}>
            <input value={form.cep} onChange={e => set('cep', e.target.value)} placeholder="00000-000" style={inp} />
          </Field>
          <Field label="DDD" style={{ flex: '0 1 80px' }}>
            <input value={form.ddd} onChange={e => set('ddd', e.target.value)} placeholder="11" style={inp} maxLength={2} />
          </Field>
        </Section>

        {/* Atividade */}
        <Section title="Atividade">
          <Field label="CNAE Principal (código, separar por vírgula)" style={{ flex: '1 1 240px' }}>
            <input value={form.cnae} onChange={e => set('cnae', e.target.value)} placeholder="47.11-3-02, 56.11-2-01" style={inp} />
          </Field>
          <Field label="Natureza Jurídica (código)" style={{ flex: '1 1 200px' }}>
            <input value={form.natureza_juridica} onChange={e => set('natureza_juridica', e.target.value)} placeholder="206-2" style={inp} />
          </Field>
        </Section>

        {/* Empresa */}
        <Section title="Empresa">
          <Field label="Situação" style={{ flex: '0 1 160px' }}>
            <select value={form.situacao} onChange={e => set('situacao', e.target.value)} style={inp}>
              <option value="">Qualquer</option>
              {SITUACOES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Porte" style={{ flex: '1 1 auto' }}>
            <PortePicker value={form.portes} onChange={v => set('portes', v)} />
          </Field>
        </Section>

        {/* Data de Abertura */}
        <Section title="Data de Abertura">
          <Field label="De" style={{ flex: '0 1 150px' }}>
            <input type="date" value={form.abertura_de} onChange={e => set('abertura_de', e.target.value)} style={inp} />
          </Field>
          <Field label="Até" style={{ flex: '0 1 150px' }}>
            <input type="date" value={form.abertura_ate} onChange={e => set('abertura_ate', e.target.value)} style={inp} />
          </Field>
        </Section>

        {/* Capital Social */}
        <Section title="Capital Social">
          <Field label="Mínimo (R$)" style={{ flex: '0 1 150px' }}>
            <input type="number" value={form.capital_min} onChange={e => set('capital_min', e.target.value)} placeholder="0" style={inp} min={0} />
          </Field>
          <Field label="Máximo (R$)" style={{ flex: '0 1 150px' }}>
            <input type="number" value={form.capital_max} onChange={e => set('capital_max', e.target.value)} placeholder="ilimitado" style={inp} min={0} />
          </Field>
        </Section>

        {/* Mais Filtros */}
        <Section title="Mais Filtros">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <Toggle label="Somente MEI" value={form.somente_mei} onChange={v => { set('somente_mei', v); if (v) set('excluir_mei', false) }} />
            <Toggle label="Excluir MEI"  value={form.excluir_mei}  onChange={v => { set('excluir_mei', v); if (v) set('somente_mei', false) }} />
            <Toggle label="Com e-mail"   value={form.com_email}    onChange={v => set('com_email', v)} />
            <Toggle label="Com telefone" value={form.com_telefone} onChange={v => set('com_telefone', v)} />
          </div>
        </Section>

        {/* Atribuição (admin) */}
        {isSuperAdmin && profiles.length > 0 && (
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, whiteSpace: 'nowrap' }}>Atribuir a:</label>
            <select
              value={assignTo}
              onChange={e => setAssignTo(e.target.value)}
              style={{ ...inp, minWidth: 180 }}
            >
              <option value="">Sem atribuição</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {[p.nome, p.sobrenome].filter(Boolean).join(' ') || p.id}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <IconSearch size={14} color="#fff" />
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
          <button
            type="button"
            onClick={() => { setForm(EMPTY_FORM); setResults([]); setTotal(0); setError(''); setSaved({}) }}
            style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}
          >
            Limpar
          </button>
          {error && (
            <span style={{ fontSize: 12, color: '#ef4444', flex: 1 }}>{error}</span>
          )}
        </div>
      </form>

      {/* Results */}
      {results.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{total.toLocaleString('pt-BR')}</span> resultado{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
              {' · '}página {page} de {totalPages}
            </div>
            {newCount > 0 && (
              <button
                onClick={saveAll}
                disabled={savingAll}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 16px', borderRadius: 7, border: 'none',
                  background: '#0ea5e9', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: savingAll ? 'not-allowed' : 'pointer',
                  opacity: savingAll ? 0.7 : 1,
                }}
              >
                <IconPlus size={13} color="#fff" />
                {savingAll ? 'Salvando...' : `Salvar todos (${newCount})`}
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                  {['CNPJ','Razão Social','Nome Fantasia','Município/UF','Abertura','Situação','Capital','Ação'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((item, i) => {
                  const cnpj     = item.cnpj || ''
                  const already  = inDb(cnpj)
                  const wasSaved = saved[cnpj]
                  const isSavingRow = saving[cnpj]
                  const done     = already || wasSaved

                  return (
                    <tr
                      key={cnpj || i}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: done ? 'rgba(0,203,83,0.04)' : 'var(--bg)',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>
                        {formatCNPJ(cnpj)}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.razao_social || '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.nome_fantasia || '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                        {[item.municipio, item.uf].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                        {formatDate(item.data_abertura)}
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                          color: situacaoColor(item.situacao_cadastral),
                        }}>
                          {item.situacao_cadastral || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                        {formatCurrency(item.capital_social)}
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        {done ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 11, fontWeight: 600 }}>
                            <IconCheck size={12} color="#22c55e" />
                            {already && !wasSaved ? 'Já existe' : 'Salvo'}
                          </span>
                        ) : (
                          <button
                            onClick={() => saveOne(item)}
                            disabled={isSavingRow}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '4px 10px', borderRadius: 5, border: 'none',
                              background: 'var(--accent)', color: '#fff',
                              fontSize: 11, fontWeight: 600, cursor: isSavingRow ? 'not-allowed' : 'pointer',
                              opacity: isSavingRow ? 0.6 : 1,
                            }}
                          >
                            <IconPlus size={11} color="#fff" />
                            {isSavingRow ? '...' : 'Salvar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => search(page - 1)}
                disabled={page <= 1 || loading}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--bg2)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer',
                  opacity: page <= 1 ? 0.4 : 1,
                }}
              >← Anterior</button>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => search(page + 1)}
                disabled={page >= totalPages || loading}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--bg2)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer',
                  opacity: page >= totalPages ? 0.4 : 1,
                }}
              >Próximo →</button>
            </div>
          )}
        </div>
      )}

      {!loading && results.length === 0 && total === 0 && !error && (
        <div style={{ marginTop: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          <IconSearch size={32} color="var(--border)" />
          <div style={{ marginTop: 10 }}>Preencha os filtros e clique em Buscar para encontrar empresas.</div>
        </div>
      )}
    </div>
  )
}

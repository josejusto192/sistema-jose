import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useIsSuperAdmin, useProfile } from '../App.jsx'
import { IconSearch, IconPlus, IconCheck } from './Icons.jsx'
import { CNAES as CNAES_FALLBACK } from '../data/cnaes.js'
import { API_KEY, API_BUSCA_URL, API_CONSULTA_URL, consultarCnpj, mapCnpjToLead } from '../lib/casaDados.js'

export { API_KEY, API_BUSCA_URL, API_CONSULTA_URL, consultarCnpj, mapCnpjToLead }

const UF_LIST  = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const SITUACOES = ['ATIVA','INAPTA','BAIXADA','SUSPENSA','NULA']
const PORTES   = [{ value: '01', label: 'ME / MEI' }, { value: '03', label: 'EPP' }, { value: '05', label: 'Demais' }]

function stripCnae(codigo) { return (codigo || '').replace(/[-/]/g, '') }

// ─── CNAE lazy-load from IBGE ───────────────────────────────────────────────
let cnaeCache = null
let cnaePromise = null
async function loadCnaes() {
  if (cnaeCache) return cnaeCache
  if (cnaePromise) return cnaePromise
  cnaePromise = fetch('https://servicodados.ibge.gov.br/api/v2/cnae/subclasses')
    .then(r => r.json())
    .then(data => {
      cnaeCache = data.map(c => ({ codigo: c.id, descricao: c.descricao }))
      return cnaeCache
    })
    .catch(() => { cnaeCache = CNAES_FALLBACK; return cnaeCache })
  return cnaePromise
}

// ─── Municipios lazy-load from IBGE per UF ──────────────────────────────────
const muniCache = {}
async function loadMunicipios(ufs) {
  const toFetch = ufs.filter(uf => !muniCache[uf])
  await Promise.all(toFetch.map(uf =>
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
      .then(r => r.json())
      .then(data => { muniCache[uf] = data.map(m => m.nome) })
      .catch(() => { muniCache[uf] = [] })
  ))
  const all = ufs.flatMap(uf => muniCache[uf] || [])
  return [...new Set(all)].sort((a, b) => a.localeCompare(b, 'pt'))
}


const EMPTY_FORM = {
  termo: '', tipo_busca: 'radical',
  ufs: [], municipios: [], bairro: '', cep: '', ddd: '',
  cnaes: [], incluir_secundaria: false, natureza_juridica: '',
  situacoes: [], portes: [],
  abertura_de: '', abertura_ate: '',
  capital_min: '', capital_max: '',
  somente_mei: false, excluir_mei: false,
  simples_optante: false, simples_excluir: false,
  com_email: false, com_telefone: false,
  somente_celular: false, somente_fixo: false,
  somente_matriz: false, somente_filial: false,
  excluir_email_contab: false,
}

/* ─── helpers ────────────────────────────────────────────────────────────── */
function formatCNPJ(raw) {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length !== 14) return raw || ''
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
function formatDate(d) {
  if (!d) return '—'
  const s = d.slice(0, 10)
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}
function formatCurrency(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}
function situacaoColor(s) {
  if (s === 'ATIVA')   return '#22c55e'
  if (s === 'BAIXADA') return '#ef4444'
  if (s === 'INAPTA')  return '#f59e0b'
  return '#6b7280'
}

function buildBody(form, page) {
  const body = { limite: 20, pagina: page }
  if (form.termo.trim()) {
    body.busca_textual = [{ texto: [form.termo.trim()], tipo_busca: form.tipo_busca, razao_social: true, nome_fantasia: true, nome_socio: false }]
  }
  if (form.ufs.length)       body.uf        = form.ufs.map(u => u.toLowerCase())
  if (form.municipios.length) body.municipio = form.municipios.map(m => m.nome.toLowerCase())
  if (form.bairro.trim())    body.bairro    = [form.bairro.trim().toLowerCase()]
  if (form.cep.trim())       body.cep       = [form.cep.replace(/\D/g, '')]
  if (form.ddd.trim())       body.ddd       = [form.ddd.trim()]
  if (form.cnaes.length) {
    body.codigo_atividade_principal = form.cnaes.map(c => stripCnae(c.codigo))
    if (form.incluir_secundaria) {
      body.incluir_atividade_secundaria = true
      body.codigo_atividade_secundaria  = form.cnaes.map(c => stripCnae(c.codigo))
    }
  }
  if (form.natureza_juridica.trim()) body.codigo_natureza_juridica = form.natureza_juridica.split(',').map(c => c.trim()).filter(Boolean)
  if (form.situacoes.length) body.situacao_cadastral = form.situacoes
  if (form.somente_matriz)   body.matriz_filial      = 'MATRIZ'
  else if (form.somente_filial) body.matriz_filial   = 'FILIAL'
  if (form.portes.length)    body.porte_empresa      = { codigos: form.portes }
  if (form.abertura_de || form.abertura_ate) {
    body.data_abertura = {}
    if (form.abertura_de) body.data_abertura.inicio = form.abertura_de
    if (form.abertura_ate) body.data_abertura.fim   = form.abertura_ate
  }
  if (form.capital_min !== '' || form.capital_max !== '') {
    body.capital_social = {}
    if (form.capital_min !== '') body.capital_social.minimo = Number(form.capital_min)
    if (form.capital_max !== '') body.capital_social.maximo = Number(form.capital_max)
  }
  if (form.somente_mei || form.excluir_mei)         body.mei    = { optante: form.somente_mei, excluir_optante: form.excluir_mei }
  if (form.simples_optante || form.simples_excluir) body.simples = { optante: form.simples_optante, excluir_optante: form.simples_excluir }
  const mf = {}
  if (form.com_email)            mf.com_email            = true
  if (form.com_telefone)         mf.com_telefone         = true
  if (form.somente_celular)      mf.somente_celular      = true
  if (form.somente_fixo)         mf.somente_fixo         = true
  if (form.excluir_email_contab) mf.excluir_email_contab = true
  if (Object.keys(mf).length)   body.mais_filtros        = mf
  return body
}

/* ─── UI atoms ───────────────────────────────────────────────────────────── */
const inp = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' }

function Label({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>
}
function SectionTitle({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>{children}</div>
}
function Toggle({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!value)} style={{ width: 30, height: 17, borderRadius: 9, background: value ? 'var(--accent)' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: value ? 13 : 2, width: 13, height: 13, borderRadius: '50%', background: '#fff', transition: 'left 0.18s' }} />
      </div>
      <span style={{ fontSize: 12, color: value ? 'var(--text)' : 'var(--text2)' }}>{label}</span>
    </label>
  )
}
function ChipButton({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', fontSize: 11, cursor: 'pointer', background: active ? 'var(--accent)' : 'var(--bg2)', color: active ? '#fff' : 'var(--text2)', fontWeight: active ? 600 : 400 }}>
      {label}
    </button>
  )
}

/* ─── Generic searchable multi-select ───────────────────────────────────── */
function MultiPicker({ value, onChange, items, loading, placeholder, getKey, getLabel, tagLabel }) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? items.filter(c => getKey(c).includes(q) || getLabel(c).toLowerCase().includes(q)).slice(0, 80)
    : items.slice(0, 80)

  function toggle(item) {
    const k = getKey(item)
    const exists = value.find(c => getKey(c) === k)
    onChange(exists ? value.filter(c => getKey(c) !== k) : [...value, item])
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {value.map(c => (
            <span key={getKey(c)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,203,83,0.12)', color: 'var(--accent)', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>
              {tagLabel ? tagLabel(c) : getLabel(c)}
              <span type="button" onClick={() => onChange(value.filter(x => getKey(x) !== getKey(c)))} style={{ cursor: 'pointer', lineHeight: 1, fontSize: 14, color: 'var(--text3)' }}>×</span>
            </span>
          ))}
        </div>
      )}
      <input
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={loading ? 'Carregando...' : placeholder}
        disabled={loading}
        style={inp}
      />
      {open && !loading && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 260, overflowY: 'auto', marginTop: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          {filtered.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>Nenhum resultado</div>}
          {filtered.map(c => {
            const sel = !!value.find(x => getKey(x) === getKey(c))
            return (
              <div key={getKey(c)} onClick={() => toggle(c)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', background: sel ? 'rgba(0,203,83,0.08)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {sel && <IconCheck size={9} color="#fff" />}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', minWidth: 70, flexShrink: 0 }}>{getKey(c)}</span>
                <span style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.3 }}>{getLabel(c)}</span>
              </div>
            )
          })}
          {!q && items.length > 80 && (
            <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text3)' }}>Digite para filtrar {items.length} opções</div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── CNAE picker (loads from IBGE) ─────────────────────────────────────── */
function CnaePicker({ value, onChange }) {
  const [cnaes, setCnaes]   = useState(CNAES_FALLBACK)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (cnaeCache) { setCnaes(cnaeCache); return }
    setLoading(true)
    loadCnaes().then(data => { setCnaes(data); setLoading(false) })
  }, [])

  return (
    <MultiPicker
      value={value} onChange={onChange} items={cnaes} loading={loading}
      placeholder="Buscar por código ou descrição..."
      getKey={c => c.codigo} getLabel={c => c.descricao}
      tagLabel={c => c.codigo}
    />
  )
}

/* ─── Municipality picker (loads from IBGE by UF) ───────────────────────── */
function MunicipioPicker({ ufs, value, onChange }) {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ufs.length) { setItems([]); onChange([]); return }
    setLoading(true)
    loadMunicipios(ufs).then(names => {
      setItems(names.map(n => ({ nome: n })))
      // remove selected that no longer appear
      onChange(prev => prev.filter(p => names.includes(p.nome)))
      setLoading(false)
    })
  }, [ufs.join(',')])

  if (!ufs.length) return <div style={{ fontSize: 12, color: 'var(--text3)', padding: '6px 0' }}>Selecione um estado primeiro</div>

  return (
    <MultiPicker
      value={value} onChange={onChange} items={items} loading={loading}
      placeholder={loading ? 'Carregando municípios...' : 'Buscar município...'}
      getKey={c => c.nome} getLabel={c => c.nome}
    />
  )
}

/* ─── main component ──────────────────────────────────────────────────────── */
export default function BuscaAvancada({ onCreateLead, existingCnpjs = [], profiles = [] }) {
  const isSuperAdmin = useIsSuperAdmin()
  const profile      = useProfile()

  const [form, setForm]           = useState(EMPTY_FORM)
  const [results, setResults]     = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [saved, setSaved]         = useState({})
  const [saving, setSaving]       = useState({})
  const [savingAll, setSavingAll] = useState(false)
  const [saveAllProgress, setSaveAllProgress] = useState(null) // { done, total }
  const [assignTo, setAssignTo]   = useState('')
  const cancelSaveAllRef = useRef(false)

  const SAVED_SEARCHES_KEY = 'tilim_saved_searches_v1'
  const [savedSearches, setSavedSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) || '[]') } catch { return [] }
  })
  const [saveSearchName, setSaveSearchName] = useState('')
  const [showSaveSearch, setShowSaveSearch] = useState(false)

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })) }

  const inDb = useCallback((cnpj) => {
    const raw = (cnpj || '').replace(/\D/g, '')
    return existingCnpjs.includes(raw)
  }, [existingCnpjs])

  async function fetchResultsPage(p, formArg = form) {
    const res = await fetch(`${API_BUSCA_URL}?tipo_resultado=completo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': API_KEY },
      body: JSON.stringify(buildBody(formArg, p)),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('Casa dos Dados API error', res.status, body)
      throw new Error(`API erro ${res.status}: ${body.slice(0, 400)}`)
    }
    const json = await res.json()
    return { cnpjs: json?.cnpjs || [], total: json?.total || 0 }
  }

  function cancelSaveAll() {
    cancelSaveAllRef.current = true
  }

  async function search(p = 1) {
    if (!API_KEY) { setError('Variável VITE_CASA_DADOS_KEY não configurada.'); return }
    if (savingAll) cancelSaveAll() // uma nova busca invalida a importação em massa que estava rodando pra busca anterior
    setLoading(true); setError(''); setPage(p)
    try {
      const { cnpjs, total: t } = await fetchResultsPage(p)
      setResults(cnpjs)
      setTotal(t)
    } catch (e) {
      setError(e.message || 'Erro ao consultar a API')
      setResults([]); setTotal(0)
    } finally { setLoading(false) }
  }

  function buildLeadPayload(item) {
    const vendedorId = isSuperAdmin ? (assignTo || null) : (profile?.id || null)
    return {
      tipo: 'empresa',
      cnpj: (item.cnpj || '').replace(/\D/g, '') || null,
      ...mapCnpjToLead(item),
      origem: 'casa_dos_dados',
      status_prospeccao: 'novo',
      vendedor_id: vendedorId,
    }
  }

  async function saveOne(item) {
    const key = item.cnpj
    setSaving(prev => ({ ...prev, [key]: true }))
    try { await onCreateLead(buildLeadPayload(item)); setSaved(prev => ({ ...prev, [key]: true })) }
    finally { setSaving(prev => ({ ...prev, [key]: false })) }
  }

  function persistSearches(list) {
    setSavedSearches(list)
    localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(list))
  }

  function handleSaveSearch() {
    const name = saveSearchName.trim()
    if (!name) return
    persistSearches([...savedSearches, { name, form }])
    setSaveSearchName('')
    setShowSaveSearch(false)
  }

  function handleLoadSearch(entry) {
    setForm(entry.form)
  }

  function handleDeleteSearch(idx) {
    persistSearches(savedSearches.filter((_, i) => i !== idx))
  }

  async function saveAll() {
    if (!total) return
    if (totalPages > 1 && !confirm(`Isso vai importar até ${total.toLocaleString('pt-BR')} empresas, percorrendo todas as ${totalPages} páginas do resultado. Pode demorar um pouco. Continuar?`)) return
    const formSnapshot    = form
    const pageSnapshot    = page
    const resultsSnapshot = results
    const totalPagesSnapshot = totalPages
    cancelSaveAllRef.current = false
    setSavingAll(true)
    setSaveAllProgress({ done: 0, total })
    try {
      for (let p = 1; p <= totalPagesSnapshot; p++) {
        if (cancelSaveAllRef.current) break
        const pageItems = p === pageSnapshot ? resultsSnapshot : (await fetchResultsPage(p, formSnapshot)).cnpjs
        for (const item of pageItems) {
          if (cancelSaveAllRef.current) break
          if (inDb(item.cnpj) || saved[item.cnpj]) {
            setSaveAllProgress(prev => ({ ...prev, done: prev.done + 1 }))
            continue
          }
          const key = item.cnpj
          setSaving(prev => ({ ...prev, [key]: true }))
          try { await onCreateLead(buildLeadPayload(item)); setSaved(prev => ({ ...prev, [key]: true })) } catch {}
          setSaving(prev => ({ ...prev, [key]: false }))
          setSaveAllProgress(prev => ({ ...prev, done: prev.done + 1 }))
        }
      }
    } finally {
      cancelSaveAllRef.current = false
      setSavingAll(false)
      setSaveAllProgress(null)
    }
  }

  const totalPages = Math.ceil(total / 20) || 0

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Busca Avançada</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, margin: 0 }}>Encontre empresas via Casa dos Dados e importe como leads.</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); search(1) }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* ── Localização ─────────────────────────────────────────── */}
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', gridColumn: '1 / -1' }}>
            <SectionTitle>Localização</SectionTitle>
            <div style={{ marginBottom: 12 }}>
              <Label>Estado (UF)</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {UF_LIST.map(uf => (
                  <ChipButton key={uf} label={uf} active={form.ufs.includes(uf)} onClick={() => set('ufs', form.ufs.includes(uf) ? form.ufs.filter(u => u !== uf) : [...form.ufs, uf])} />
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
              <div>
                <Label>Município {form.ufs.length > 0 && `(${form.ufs.join(', ')})`}</Label>
                <MunicipioPicker
                  ufs={form.ufs}
                  value={form.municipios}
                  onChange={v => set('municipios', typeof v === 'function' ? v(form.municipios) : v)}
                />
              </div>
              <div>
                <Label>CEP</Label>
                <input value={form.cep} onChange={e => set('cep', e.target.value)} placeholder="00000-000" style={inp} />
              </div>
              <div>
                <Label>DDD</Label>
                <input value={form.ddd} onChange={e => set('ddd', e.target.value)} placeholder="11" style={inp} maxLength={2} />
              </div>
            </div>
          </div>

          {/* ── Busca Textual ──────────────────────────────────────── */}
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
            <SectionTitle>Busca Textual</SectionTitle>
            <Label>Palavra-chave</Label>
            <input value={form.termo} onChange={e => set('termo', e.target.value)} placeholder="Ex: restaurante, clínica, transporte..." style={inp} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <ChipButton label="Busca radical" active={form.tipo_busca === 'radical'} onClick={() => set('tipo_busca', 'radical')} />
              <ChipButton label="Busca exata"   active={form.tipo_busca === 'exata'}   onClick={() => set('tipo_busca', 'exata')} />
            </div>
          </div>

          {/* ── Empresa ──────────────────────────────────────────────── */}
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
            <SectionTitle>Empresa</SectionTitle>
            <div style={{ marginBottom: 10 }}>
              <Label>Situação</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {SITUACOES.map(s => (
                  <ChipButton key={s} label={s} active={form.situacoes.includes(s)} onClick={() => set('situacoes', form.situacoes.includes(s) ? form.situacoes.filter(x => x !== s) : [...form.situacoes, s])} />
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <Label>Porte</Label>
              <div style={{ display: 'flex', gap: 6 }}>
                {PORTES.map(p => (
                  <ChipButton key={p.value} label={p.label} active={form.portes.includes(p.value)} onClick={() => set('portes', form.portes.includes(p.value) ? form.portes.filter(v => v !== p.value) : [...form.portes, p.value])} />
                ))}
              </div>
            </div>
            <div>
              <Label>Natureza Jurídica (código)</Label>
              <input value={form.natureza_juridica} onChange={e => set('natureza_juridica', e.target.value)} placeholder="Ex: 2011, 2062" style={inp} />
            </div>
          </div>

          {/* ── Atividade / CNAE ─────────────────────────────────────── */}
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', gridColumn: '1 / -1' }}>
            <SectionTitle>Atividade (CNAE) — lista completa IBGE</SectionTitle>
            <CnaePicker value={form.cnaes} onChange={v => set('cnaes', v)} />
            {form.cnaes.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <Toggle label="Incluir CNAEs secundários" value={form.incluir_secundaria} onChange={v => set('incluir_secundaria', v)} />
              </div>
            )}
          </div>

          {/* ── Abertura ─────────────────────────────────────────────── */}
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
            <SectionTitle>Data de Abertura</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Label>De</Label><input type="date" value={form.abertura_de} onChange={e => set('abertura_de', e.target.value)} style={inp} /></div>
              <div><Label>Até</Label><input type="date" value={form.abertura_ate} onChange={e => set('abertura_ate', e.target.value)} style={inp} /></div>
            </div>
          </div>

          {/* ── Capital Social ───────────────────────────────────────── */}
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
            <SectionTitle>Capital Social</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Label>Mínimo (R$)</Label><input type="number" value={form.capital_min} onChange={e => set('capital_min', e.target.value)} placeholder="0" style={inp} min={0} /></div>
              <div><Label>Máximo (R$)</Label><input type="number" value={form.capital_max} onChange={e => set('capital_max', e.target.value)} placeholder="ilimitado" style={inp} min={0} /></div>
            </div>
          </div>

          {/* ── Filtros Adicionais ───────────────────────────────────── */}
          <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', gridColumn: '1 / -1' }}>
            <SectionTitle>Filtros Adicionais</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
              <div>
                <Label>Contato</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Toggle label="Com e-mail" value={form.com_email} onChange={v => set('com_email', v)} />
                  <Toggle label="Com telefone" value={form.com_telefone} onChange={v => { set('com_telefone', v); if (!v) { set('somente_celular', false); set('somente_fixo', false) } }} />
                  <Toggle label="Somente celular" value={form.somente_celular} onChange={v => { set('somente_celular', v); if (v) { set('com_telefone', true); set('somente_fixo', false) } }} />
                  <Toggle label="Somente fixo" value={form.somente_fixo} onChange={v => { set('somente_fixo', v); if (v) { set('com_telefone', true); set('somente_celular', false) } }} />
                  <Toggle label="Excluir e-mail de contab." value={form.excluir_email_contab} onChange={v => set('excluir_email_contab', v)} />
                </div>
              </div>
              <div>
                <Label>MEI</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Toggle label="Somente MEI" value={form.somente_mei} onChange={v => { set('somente_mei', v); if (v) set('excluir_mei', false) }} />
                  <Toggle label="Excluir MEI" value={form.excluir_mei} onChange={v => { set('excluir_mei', v); if (v) set('somente_mei', false) }} />
                </div>
              </div>
              <div>
                <Label>Simples Nacional</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Toggle label="Optante do Simples" value={form.simples_optante} onChange={v => { set('simples_optante', v); if (v) set('simples_excluir', false) }} />
                  <Toggle label="Excluir optantes" value={form.simples_excluir} onChange={v => { set('simples_excluir', v); if (v) set('simples_optante', false) }} />
                </div>
              </div>
              <div>
                <Label>Estabelecimento</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Toggle label="Somente matriz" value={form.somente_matriz} onChange={v => { set('somente_matriz', v); if (v) set('somente_filial', false) }} />
                  <Toggle label="Somente filial"  value={form.somente_filial}  onChange={v => { set('somente_filial', v); if (v) set('somente_matriz', false) }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Atribuição (admin) */}
        {isSuperAdmin && profiles.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>Atribuir leads a:</label>
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={{ ...inp, maxWidth: 220 }}>
              <option value="">Sem atribuição</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{[p.nome, p.sobrenome].filter(Boolean).join(' ') || p.id}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="submit"
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
              disabled={loading}
            >
              <IconSearch size={14} color="#fff" />{loading ? 'Buscando...' : 'Buscar'}
            </button>
            <button type="button" onClick={() => { setForm(EMPTY_FORM); setResults([]); setTotal(0); setError('') }}
              style={{ padding: '9px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
              Limpar filtros
            </button>
            {showSaveSearch ? (
              <>
                <input
                  autoFocus
                  value={saveSearchName}
                  onChange={e => setSaveSearchName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveSearch(); if (e.key === 'Escape') setShowSaveSearch(false) }}
                  placeholder="Nome da busca..."
                  style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, outline: 'none', width: 180 }}
                />
                <button type="button" onClick={handleSaveSearch} style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Salvar</button>
                <button type="button" onClick={() => setShowSaveSearch(false)} style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>✕</button>
              </>
            ) : (
              <button type="button" onClick={() => setShowSaveSearch(true)}
                style={{ padding: '8px 14px', border: '1px dashed var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
                🔖 Salvar busca
              </button>
            )}
            {error && <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>}
          </div>
          {savedSearches.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Buscas salvas:</span>
              {savedSearches.map((s, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, color: 'var(--text2)' }}>
                  <span onClick={() => handleLoadSearch(s)} style={{ cursor: 'pointer' }}>{s.name}</span>
                  <button type="button" onClick={() => handleDeleteSearch(i)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '0 2px', lineHeight: 1, fontSize: 14, display: 'flex' }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </form>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{total.toLocaleString('pt-BR')}</span> resultado{total !== 1 ? 's' : ''} · página {page} / {totalPages}
            </div>
            {total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={saveAll} disabled={savingAll} type="button" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 7, border: 'none', background: '#0ea5e9', color: '#fff', fontSize: 12, fontWeight: 600, cursor: savingAll ? 'not-allowed' : 'pointer', opacity: savingAll ? 0.7 : 1 }}>
                  <IconPlus size={13} color="#fff" />
                  {savingAll ? `Salvando... (${saveAllProgress?.done ?? 0}/${saveAllProgress?.total ?? total})` : `Salvar todos os resultados (${total.toLocaleString('pt-BR')})`}
                </button>
                {savingAll && (
                  <button onClick={cancelSaveAll} type="button" style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                  {['CNPJ','Razão Social','Nome Fantasia','Município / UF','Segmento','Telefone','E-mail','Abertura','Situação','Ação'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((item, i) => {
                  const cnpj = item.cnpj || ''
                  const already = inDb(cnpj)
                  const wasSaved = saved[cnpj]
                  const isSavingRow = saving[cnpj]
                  const done = already || wasSaved
                  const sit = item.situacao_cadastral?.situacao_atual || item.situacao_cadastral?.situacao_cadastral || '—'
                  return (
                    <tr key={cnpj || i} style={{ borderBottom: '1px solid var(--border)', background: done ? 'rgba(0,203,83,0.04)' : 'var(--bg)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>{formatCNPJ(cnpj)}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.razao_social || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome_fantasia || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{[item.endereco?.municipio, item.endereco?.uf].filter(Boolean).join(' / ') || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.atividade_principal?.descricao || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap', fontSize: 11 }}>{item.contato_telefonico?.[0]?.completo || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.contato_email?.[0]?.email?.toLowerCase() || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{formatDate(item.data_abertura)}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: situacaoColor(sit) }}>{sit}</span>
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        {done ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 11, fontWeight: 600 }}>
                            <IconCheck size={12} color="#22c55e" />
                            {already && !wasSaved ? 'Já existe' : 'Salvo'}
                          </span>
                        ) : (
                          <button type="button" onClick={() => saveOne(item)} disabled={isSavingRow} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: isSavingRow ? 'not-allowed' : 'pointer', opacity: isSavingRow ? 0.6 : 1 }}>
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

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => search(page - 1)} disabled={page <= 1 || loading} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>← Anterior</button>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{page} / {totalPages}</span>
              <button type="button" onClick={() => search(page + 1)} disabled={page >= totalPages || loading} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}>Próximo →</button>
            </div>
          )}
        </div>
      )}

      {!loading && results.length === 0 && total === 0 && !error && (
        <div style={{ marginTop: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          <IconSearch size={36} color="var(--border)" />
          <div style={{ marginTop: 10 }}>Preencha os filtros e clique em Buscar para encontrar empresas.</div>
        </div>
      )}
    </div>
  )
}

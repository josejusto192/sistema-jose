import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabase.js'
import { STATUS_CONFIG, leadName } from '../constants.js'
import { IconPlus, IconTrash, IconMail, IconTag, IconSearch, IconCheck, IconArrowLeft } from './Icons.jsx'

const STATUS_LABEL = {
  rascunho: { label: 'Rascunho', bg: 'var(--bg3)', color: 'var(--text2)' },
  enviando: { label: 'Enviando...', bg: '#fff3cd', color: '#92740c' },
  enviado:  { label: 'Enviado', bg: '#d4edda', color: '#1e7e34' },
  erro:     { label: 'Erro', bg: '#f8d7da', color: '#c0392b' },
}

const ORIGENS = [
  { value: 'manual',         label: 'Manual (app)' },
  { value: 'n8n',            label: 'Automação n8n' },
  { value: 'site',           label: 'Site / formulário' },
  { value: 'indicacao',      label: 'Indicação' },
  { value: 'casa_dos_dados', label: 'Casa dos Dados' },
  { value: 'outro',          label: 'Outro' },
]

const labelStyle = { display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 5 }
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}

function StatusBadge({ status }) {
  const s = STATUS_LABEL[status] || STATUS_LABEL.rascunho
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

const STEPS = [
  { id: 1, label: 'Conteúdo' },
  { id: 2, label: 'Destinatários' },
  { id: 3, label: 'Revisar e enviar' },
]

function StepIndicator({ step, maxStepAtingido, onJump }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {STEPS.map((s, i) => {
        const ativo = s.id === step
        const concluido = s.id < step
        const alcancavel = s.id <= maxStepAtingido
        return (
          <React.Fragment key={s.id}>
            <div
              onClick={() => alcancavel && onJump(s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: alcancavel ? 'pointer' : 'default' }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: ativo || concluido ? 'var(--accent)' : 'var(--bg3)',
                color: ativo || concluido ? '#fff' : 'var(--text3)',
              }}>
                {concluido ? <IconCheck size={12} color="#fff" /> : s.id}
              </div>
              <span style={{ fontSize: 13, fontWeight: ativo ? 700 : 500, color: ativo ? 'var(--text)' : 'var(--text3)' }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ width: 40, height: 1, background: 'var(--border)', margin: '0 12px' }} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

/* ─── Seletor de destinatários ────────────────────────────────────────────── */
// Em vez de só filtrar por tag (a maioria dos leads não tem tag cadastrada,
// então isso quase sempre dava 0 resultados), aqui o usuário busca/filtra
// como na tela de Leads e vê exatamente quem vai entrar na campanha antes
// de salvar — a campanha guarda os lead_ids escolhidos, não um filtro solto.
function SeletorDestinatarios({ empresas, tagsDisponiveis, selecionados, setSelecionados }) {
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [tagsFiltro, setTagsFiltro] = useState([])
  const [origemFiltro, setOrigemFiltro] = useState('')
  const [municipioFiltro, setMunicipioFiltro] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const comEmail = useMemo(() => empresas.filter(e => e.email?.includes('@')), [empresas])

  const municipiosDisponiveis = useMemo(() => {
    const set = new Set()
    comEmail.forEach(e => { if (e.municipio) set.add(e.municipio) })
    return Array.from(set).sort()
  }, [comEmail])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return comEmail.filter(e => {
      if (statusFiltro && e.status_prospeccao !== statusFiltro) return false
      if (tagsFiltro.length && !(e.tags || []).some(t => tagsFiltro.includes(t))) return false
      if (origemFiltro && e.origem !== origemFiltro) return false
      if (municipioFiltro && e.municipio !== municipioFiltro) return false
      if (dataInicio && (!e.criado_em || new Date(e.criado_em) < new Date(dataInicio))) return false
      if (dataFim && (!e.criado_em || new Date(e.criado_em) > new Date(`${dataFim}T23:59:59`))) return false
      if (q && !(leadName(e).toLowerCase().includes(q) || e.email.toLowerCase().includes(q))) return false
      return true
    })
  }, [comEmail, busca, statusFiltro, tagsFiltro, origemFiltro, municipioFiltro, dataInicio, dataFim])

  function toggleTagFiltro(tag) {
    setTagsFiltro(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function toggleLead(id) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function selecionarVisiveis() {
    setSelecionados(prev => [...new Set([...prev, ...filtrados.map(e => e.id)])])
  }

  function limparVisiveis() {
    const idsVisiveis = new Set(filtrados.map(e => e.id))
    setSelecionados(prev => prev.filter(id => !idsVisiveis.has(id)))
  }

  return (
    <div>
      <label style={labelStyle}>Destinatários ({selecionados.length} selecionado{selecionados.length !== 1 ? 's' : ''} de {comEmail.length} lead{comEmail.length !== 1 ? 's' : ''} com email)</label>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
            <IconSearch size={12} color="var(--text3)" />
          </span>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou email..."
            style={{ ...inputStyle, padding: '7px 10px 7px 28px', fontSize: 12 }}
          />
        </div>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '7px 10px', fontSize: 12 }}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
        </select>
        <select value={origemFiltro} onChange={e => setOrigemFiltro(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '7px 10px', fontSize: 12 }}>
          <option value="">Todas as origens</option>
          {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={municipioFiltro} onChange={e => setMunicipioFiltro(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '7px 10px', fontSize: 12 }}>
          <option value="">Todos os municípios</option>
          {municipiosDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Criado entre</span>
        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '6px 9px', fontSize: 12 }} />
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>e</span>
        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '6px 9px', fontSize: 12 }} />
        {(dataInicio || dataFim) && (
          <button onClick={() => { setDataInicio(''); setDataFim('') }} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            Limpar datas
          </button>
        )}
      </div>

      {tagsDisponiveis.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {tagsDisponiveis.map(tag => {
            const ativo = tagsFiltro.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleTagFiltro(tag)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20,
                  border: '1px solid var(--border)', background: ativo ? 'var(--accent)' : 'var(--bg3)',
                  color: ativo ? '#fff' : 'var(--text2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <IconTag size={10} color={ativo ? '#fff' : 'var(--text3)'} /> {tag}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{filtrados.length} lead{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''} com esse filtro</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={selecionarVisiveis} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            Selecionar todos visíveis
          </button>
          <button onClick={limparVisiveis} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            Remover visíveis
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 320, overflowY: 'auto', background: 'var(--bg2)' }}>
        {filtrados.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
            Nenhum lead com email encontrado para esse filtro.
          </div>
        ) : filtrados.map(e => {
          const marcado = selecionados.includes(e.id)
          return (
            <div
              key={e.id}
              onClick={() => toggleLead(e.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 4, border: `1px solid ${marcado ? 'var(--accent)' : 'var(--border)'}`,
                background: marcado ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {marcado && <IconCheck size={10} color="#fff" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{leadName(e)}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.email}</div>
              </div>
              <span style={{ fontSize: 10, color: STATUS_CONFIG[e.status_prospeccao]?.color || 'var(--text3)', background: STATUS_CONFIG[e.status_prospeccao]?.bg || 'var(--bg3)', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>
                {STATUS_CONFIG[e.status_prospeccao]?.label || e.status_prospeccao}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Página de nova campanha (etapas) ────────────────────────────────────── */
function NovaCampanhaPage({ empresas, tagsDisponiveis, onCancel, onSaved }) {
  const [step, setStep] = useState(1)
  const [maxStepAtingido, setMaxStepAtingido] = useState(1)
  const [nome, setNome] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpoHtml, setCorpoHtml] = useState('')
  const [selecionados, setSelecionados] = useState([])
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState(null)

  const selecionadosLeads = useMemo(() => empresas.filter(e => selecionados.includes(e.id)), [empresas, selecionados])

  function irParaStep(s) {
    setErro(null)
    setStep(s)
    setMaxStepAtingido(prev => Math.max(prev, s))
  }

  function avancar() {
    if (step === 1) {
      if (!nome.trim() || !assunto.trim() || !corpoHtml.trim()) {
        setErro('Nome, assunto e corpo são obrigatórios')
        return
      }
    }
    if (step === 2 && selecionados.length === 0) {
      setErro('Selecione ao menos um destinatário')
      return
    }
    irParaStep(step + 1)
  }

  async function salvar() {
    if (selecionados.length === 0) {
      setErro('Selecione ao menos um destinatário')
      return
    }
    setSaving(true)
    setErro(null)
    const { error } = await supabase.from('email_campaigns').insert({
      nome: nome.trim(),
      assunto: assunto.trim(),
      corpo_html: corpoHtml,
      lead_ids: selecionados,
    })
    setSaving(false)
    if (error) { setErro(error.message); return }
    onSaved()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <IconArrowLeft size={18} color="var(--text3)" />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Nova campanha</h1>
      </div>

      <StepIndicator step={step} maxStepAtingido={maxStepAtingido} onJump={irParaStep} />

      <div className="card" style={{ padding: 24, maxWidth: 760 }}>
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Nome da campanha</label>
              <input style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Black Friday 2026" />
            </div>
            <div>
              <label style={labelStyle}>Assunto do email</label>
              <input style={inputStyle} value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Ex: {{nome}}, uma oferta especial pra você" />
            </div>
            <div>
              <label style={labelStyle}>Corpo do email (HTML)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 220, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                value={corpoHtml}
                onChange={e => setCorpoHtml(e.target.value)}
                placeholder={'<p>Olá {{nome}},</p>\n<p>Texto da sua campanha aqui...</p>'}
              />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                Variáveis disponíveis: <code>{'{{nome}}'}</code>, <code>{'{{empresa}}'}</code>, <code>{'{{email}}'}</code>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <SeletorDestinatarios
            empresas={empresas}
            tagsDisponiveis={tagsDisponiveis}
            selecionados={selecionados}
            setSelecionados={setSelecionados}
          />
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Campanha</label>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{nome}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{assunto}</div>
            </div>
            <div>
              <label style={labelStyle}>Prévia do conteúdo</label>
              <div
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: '#fff', maxHeight: 240, overflowY: 'auto' }}
                dangerouslySetInnerHTML={{ __html: corpoHtml }}
              />
            </div>
            <div>
              <label style={labelStyle}>Destinatários ({selecionadosLeads.length})</label>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', background: 'var(--bg2)' }}>
                {selecionadosLeads.map(e => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{leadName(e)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{e.email}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              A campanha será salva como rascunho. O envio é feito depois, na lista de campanhas.
            </div>
          </div>
        )}

        {erro && <div style={{ fontSize: 12, color: '#c0392b', marginTop: 14 }}>{erro}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 22 }}>
          <button
            onClick={() => step === 1 ? onCancel() : irParaStep(step - 1)}
            style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          {step < 3 ? (
            <button
              onClick={avancar}
              style={{ padding: '9px 18px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Continuar
            </button>
          ) : (
            <button
              onClick={salvar}
              disabled={saving}
              style={{ padding: '9px 18px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit' }}
            >
              {saving ? 'Salvando...' : 'Salvar como rascunho'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EmailMarketing({ empresas = [] }) {
  const [campanhas, setCampanhas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNova, setShowNova] = useState(false)
  const [enviandoId, setEnviandoId] = useState(null)
  const [erroEnvio, setErroEnvio] = useState(null)

  const tagsDisponiveis = useMemo(() => {
    const set = new Set()
    empresas.forEach(e => (e.tags || []).forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [empresas])

  const fetchCampanhas = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('email_campaigns').select('*').order('created_at', { ascending: false })
    if (!error) setCampanhas(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchCampanhas() }, [fetchCampanhas])

  function destinatarios(campanha) {
    if (campanha.lead_ids?.length) return campanha.lead_ids.length
    if (!campanha.segmento_tags?.length) return empresas.filter(e => e.email?.includes('@')).length
    return empresas.filter(e => e.email?.includes('@') && (e.tags || []).some(t => campanha.segmento_tags.includes(t))).length
  }

  async function excluir(id) {
    if (!confirm('Excluir esta campanha?')) return
    await supabase.from('email_campaigns').delete().eq('id', id)
    fetchCampanhas()
  }

  async function enviar(campanha) {
    const dest = destinatarios(campanha)
    if (!confirm(`Enviar "${campanha.nome}" para ${dest} destinatário(s)? Essa ação não pode ser desfeita.`)) return
    setEnviandoId(campanha.id)
    setErroEnvio(null)
    const { data, error } = await supabase.functions.invoke('email-send', { body: { campaign_id: campanha.id } })
    setEnviandoId(null)
    if (error || data?.error) {
      let msg = data?.error || error?.message || 'Erro ao enviar campanha'
      if (error?.context) {
        try {
          const errBody = await error.context.json()
          if (errBody?.error) msg = errBody.error
        } catch {}
      }
      setErroEnvio(msg)
    }
    fetchCampanhas()
  }

  if (showNova) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <NovaCampanhaPage
          empresas={empresas}
          tagsDisponiveis={tagsDisponiveis}
          onCancel={() => setShowNova(false)}
          onSaved={() => { setShowNova(false); fetchCampanhas() }}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconMail size={20} color="var(--text)" /> Email Marketing
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>Crie e envie campanhas de email personalizadas para seus leads</div>
        </div>
        <button
          onClick={() => setShowNova(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <IconPlus size={14} color="#fff" /> Nova campanha
        </button>
      </div>

      {erroEnvio && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f8d7da', color: '#c0392b', fontSize: 13, marginBottom: 16 }}>
          {erroEnvio}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
      ) : campanhas.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>
          Nenhuma campanha criada ainda.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {campanhas.map(c => (
            <div key={c.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.nome}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{c.assunto}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {destinatarios(c)} destinatário(s)
                  {c.status === 'enviado' && ` · ${c.total_enviados} enviado(s), ${c.total_falhas} falha(s)`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {c.status === 'rascunho' && (
                  <button
                    onClick={() => enviar(c)}
                    disabled={enviandoId === c.id}
                    style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: enviandoId === c.id ? 'default' : 'pointer', opacity: enviandoId === c.id ? 0.6 : 1, fontFamily: 'inherit' }}
                  >
                    {enviandoId === c.id ? 'Enviando...' : 'Enviar'}
                  </button>
                )}
                {c.status !== 'enviando' && (
                  <button onClick={() => excluir(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex' }}>
                    <IconTrash size={14} color="var(--text3)" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

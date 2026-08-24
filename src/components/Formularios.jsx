import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase.js'
import { IconPlus, IconEdit, IconTrash, IconCheck, IconX, IconLink, IconFileText, IconArrowLeft } from './Icons.jsx'
import { useDialog } from './Dialog.jsx'

const TIPOS = [
  { value: 'briefing',  label: 'Briefing' },
  { value: 'campanha',  label: 'Campanha de Captação' },
  { value: 'pesquisa',  label: 'Pesquisa de Satisfação' },
  { value: 'captacao',  label: 'Captação de Leads' },
  { value: 'geral',     label: 'Geral / Outro' },
]

const FIELD_TYPES = [
  { value: 'texto',    label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'email',    label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'numero',   label: 'Número' },
  { value: 'data',     label: 'Data' },
  { value: 'select',   label: 'Lista suspensa' },
  { value: 'radio',    label: 'Escolha única' },
  { value: 'checkbox', label: 'Múltipla escolha' },
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function publicUrl(id) {
  return `${window.location.origin}${window.location.pathname}#/f/${id}`
}

// ─── Campo Editor ────────────────────────────────────────────────────────────
function CampoEditor({ campo, onChange, onRemove, index }) {
  const needsOptions = ['select', 'radio', 'checkbox'].includes(campo.tipo)
  const [opText, setOpText] = useState('')

  function addOpcao() {
    const txt = opText.trim()
    if (!txt) return
    onChange({ ...campo, opcoes: [...(campo.opcoes || []), txt] })
    setOpText('')
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 4 }}>
          Campo {index + 1}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', display: 'flex' }}
        >
          <IconTrash size={14} color="var(--text3)" />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Rótulo *</label>
          <input
            value={campo.label}
            onChange={e => onChange({ ...campo, label: e.target.value })}
            placeholder="Ex: Nome completo"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Tipo</label>
          <select
            value={campo.tipo}
            onChange={e => onChange({ ...campo, tipo: e.target.value, opcoes: [] })}
            style={inputStyle}
          >
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {!needsOptions && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Placeholder</label>
          <input
            value={campo.placeholder || ''}
            onChange={e => onChange({ ...campo, placeholder: e.target.value })}
            placeholder="Texto de ajuda (opcional)"
            style={inputStyle}
          />
        </div>
      )}

      {needsOptions && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Opções</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={opText}
              onChange={e => setOpText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOpcao() } }}
              placeholder="Adicionar opção..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addOpcao} style={btnSmall}>Adicionar</button>
          </div>
          {(campo.opcoes || []).map((op, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text2)', padding: '5px 10px', background: 'var(--bg3)', borderRadius: 6 }}>{op}</span>
              <button
                onClick={() => onChange({ ...campo, opcoes: campo.opcoes.filter((_, j) => j !== i) })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}
              >
                <IconX size={13} color="var(--text3)" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
        <input
          type="checkbox"
          checked={campo.obrigatorio}
          onChange={e => onChange({ ...campo, obrigatorio: e.target.checked })}
          style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
        />
        Campo obrigatório
      </label>
    </div>
  )
}

// ─── Editor de Formulário ─────────────────────────────────────────────────────
function FormEditor({ form, onSave, onCancel }) {
  const { notifyError } = useDialog()
  const isNew = !form?.id
  const [titulo, setTitulo] = useState(form?.titulo || '')
  const [descricao, setDescricao] = useState(form?.descricao || '')
  const [tipo, setTipo] = useState(form?.tipo || 'geral')
  const [campos, setCampos] = useState(form?.campos || [])
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  function addCampo() {
    setCampos(c => [...c, { id: uid(), tipo: 'texto', label: '', placeholder: '', obrigatorio: false, opcoes: [] }])
  }

  function updateCampo(index, updated) {
    setCampos(c => c.map((f, i) => i === index ? updated : f))
  }

  function removeCampo(index) {
    setCampos(c => c.filter((_, i) => i !== index))
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl(form.id))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave() {
    if (!titulo.trim()) return
    setSaving(true)
    const payload = { titulo: titulo.trim(), descricao: descricao.trim(), tipo, campos, atualizado_em: new Date().toISOString() }
    let error
    if (isNew) {
      const { data, error: err } = await supabase.from('formularios').insert(payload).select().single()
      error = err
      if (!err) onSave(data)
    } else {
      const { error: err } = await supabase.from('formularios').update(payload).eq('id', form.id)
      error = err
      if (!err) onSave({ ...form, ...payload })
    }
    if (error) notifyError('Erro ao salvar: ' + error.message)
    setSaving(false)
  }

  return (
    <div className="workspace-page form-editor" style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div className="form-page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          onClick={onCancel}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 14px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ← Voltar
        </button>
        <h2 className="workspace-heading" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          {isNew ? 'Novo formulário' : 'Editar formulário'}
        </h2>
        <div style={{ flex: 1 }} />
        {!isNew && (
          <button onClick={copyLink} style={{ ...btnPrimary, background: copied ? '#059669' : '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
            {copied ? <><IconCheck size={14} color="#fff" /> Copiado!</> : <><IconLink size={14} color="#fff" /> Copiar link</>}
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !titulo.trim()}
          style={{ ...btnPrimary, opacity: saving || !titulo.trim() ? 0.6 : 1 }}
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* Configurações */}
      <div className="workspace-section-card" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Configurações</div>
        <div className="form-editor-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Título *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Briefing de Campanha" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={inputStyle}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Descrição / Instrução (opcional)</label>
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Explique ao respondente o objetivo do formulário..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      </div>

      {/* Campos */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Campos ({campos.length})
        </div>
        <button onClick={addCampo} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <IconPlus size={13} color="#fff" /> Adicionar campo
        </button>
      </div>

      {campos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg2)', border: '1.5px dashed var(--border2)', borderRadius: 12, color: 'var(--text3)', fontSize: 13 }}>
          Nenhum campo ainda. Clique em "Adicionar campo" para começar.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {campos.map((campo, i) => (
          <CampoEditor
            key={campo.id}
            index={i}
            campo={campo}
            onChange={updated => updateCampo(i, updated)}
            onRemove={() => removeCampo(i)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Lista de Formulários ─────────────────────────────────────────────────────
function FormulariosList({ forms, loading, onNew, onEdit, onDelete, onToggleAtivo, onViewRespostas }) {
  const [copied, setCopied] = useState(null)

  function copyLink(id) {
    navigator.clipboard.writeText(publicUrl(id))
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
  )

  return (
    <div className="workspace-page forms-list-page" style={{ padding: '28px 32px' }}>
      <div className="form-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="workspace-heading" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Formulários</h1>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Crie formulários públicos para briefings, pesquisas e campanhas.</div>
        </div>
        <button onClick={onNew} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 7 }}>
          <IconPlus size={15} color="#fff" /> Novo formulário
        </button>
      </div>

      {forms.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg2)', border: '1.5px dashed var(--border2)', borderRadius: 14, color: 'var(--text3)' }}>
          <IconFileText size={36} color="var(--border2)" />
          <div style={{ marginTop: 14, fontSize: 15, fontWeight: 600, color: 'var(--text2)' }}>Nenhum formulário ainda</div>
          <div style={{ fontSize: 13, marginTop: 6, marginBottom: 20 }}>Clique em "Novo formulário" para criar o primeiro.</div>
          <button onClick={onNew} style={btnPrimary}>Criar formulário</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {forms.map(f => (
          <div key={f.id} className="form-list-item" style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
            opacity: f.ativo ? 1 : 0.5,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{f.titulo}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 4,
                  background: f.ativo ? 'var(--accent-soft)' : 'var(--bg3)',
                  color: f.ativo ? 'var(--accent)' : 'var(--text3)',
                }}>
                  {f.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 12 }}>
                <span>{TIPOS.find(t => t.value === f.tipo)?.label || f.tipo}</span>
                <span>·</span>
                <span>{(f.campos || []).length} campos</span>
                <span>·</span>
                <button
                  onClick={() => onViewRespostas(f)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: f.total_respostas > 0 ? 'var(--accent)' : 'var(--text3)', fontFamily: 'inherit', fontWeight: f.total_respostas > 0 ? 600 : 400 }}
                >
                  {f.total_respostas} resposta{f.total_respostas !== 1 ? 's' : ''}
                </button>
              </div>
            </div>

            <div className="form-list-actions" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => copyLink(f.id)}
                title="Copiar link público"
                style={{ ...btnIcon, background: copied === f.id ? '#059669' : 'var(--bg3)', color: copied === f.id ? '#fff' : 'var(--text2)' }}
              >
                {copied === f.id ? <IconCheck size={14} /> : <IconLink size={14} />}
              </button>
              <button onClick={() => onEdit(f)} title="Editar" style={btnIcon}>
                <IconEdit size={14} />
              </button>
              <button
                onClick={() => onToggleAtivo(f)}
                title={f.ativo ? 'Desativar' : 'Ativar'}
                style={{ ...btnIcon, fontSize: 11, width: 'auto', padding: '0 10px' }}
              >
                {f.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button onClick={() => onDelete(f)} title="Excluir" style={{ ...btnIcon, color: '#DC2626' }}>
                <IconTrash size={14} color="#DC2626" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Respostas ────────────────────────────────────────────────────────────────
function RespostasViewer({ form, onBack }) {
  const [respostas, setRespostas] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('formulario_respostas')
        .select('*')
        .eq('formulario_id', form.id)
        .order('enviado_em', { ascending: false })
      setRespostas(data || [])
      setLoading(false)
    }
    load()
  }, [form.id])

  function formatDate(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function getPreview(respostas_obj) {
    const first = form.campos?.[0]
    if (!first) return '—'
    const val = respostas_obj?.[first.id]
    if (Array.isArray(val)) return val.join(', ')
    return val || '—'
  }

  if (selected) {
    return (
      <div className="workspace-page response-view" style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>
        <div className="form-page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button
            onClick={() => setSelected(null)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 14px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ← Voltar
          </button>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Resposta #{respostas.findIndex(r => r.id === selected.id) + 1}</h2>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{formatDate(selected.enviado_em)}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(form.campos || []).map(campo => {
            const val = selected.respostas?.[campo.id]
            const display = Array.isArray(val) ? val.join(', ') : val
            return (
              <div key={campo.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {campo.label}
                </div>
                <div style={{ fontSize: 14, color: display ? 'var(--text)' : 'var(--text3)', fontStyle: display ? 'normal' : 'italic', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {display || 'Não respondido'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="workspace-page response-view" style={{ padding: '28px 32px' }}>
      <div className="form-page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 14px', fontSize: 13, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ← Voltar
        </button>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>Respostas</h2>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>{form.titulo}</div>
        </div>
        <div style={{ marginLeft: 'auto', background: 'var(--bg3)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
          {respostas.length} resposta{respostas.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>}

      {!loading && respostas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg2)', border: '1.5px dashed var(--border2)', borderRadius: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Nenhuma resposta ainda</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Compartilhe o link público para começar a receber respostas.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {respostas.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setSelected(r)}
            className="response-list-item"
            style={{
              display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left',
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '14px 18px', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'border-color 0.15s',
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
              {respostas.length - i}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getPreview(r.respostas)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{formatDate(r.enviado_em)}</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Ver →</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Principal ────────────────────────────────────────────────────────────────
export default function Formularios({ logAction }) {
  const { confirmDialog } = useDialog()
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)   // null = list, {} = new, form = edit
  const [viewing, setViewing] = useState(null)   // form whose responses to show

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('formularios')
      .select('*, total_respostas:formulario_respostas(count)')
      .order('criado_em', { ascending: false })
    setForms((data || []).map(f => ({ ...f, total_respostas: f.total_respostas?.[0]?.count || 0 })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(f) {
    const ok = await confirmDialog(`Excluir "${f.titulo}"? As respostas também serão apagadas.`, { title: 'Excluir formulário', danger: true, confirmLabel: 'Excluir' })
    if (!ok) return
    await supabase.from('formularios').delete().eq('id', f.id)
    logAction?.('deletar', 'formularios', f.id, { titulo: f.titulo })
    setForms(prev => prev.filter(x => x.id !== f.id))
  }

  async function handleToggleAtivo(f) {
    const { error } = await supabase.from('formularios').update({ ativo: !f.ativo }).eq('id', f.id)
    if (!error) {
      logAction?.('atualizar', 'formularios', f.id, { titulo: f.titulo, ativo: !f.ativo })
      setForms(prev => prev.map(x => x.id === f.id ? { ...x, ativo: !f.ativo } : x))
    }
  }

  function handleSaved(saved) {
    const ehNovo = !forms.find(f => f.id === saved.id)
    logAction?.(ehNovo ? 'criar' : 'atualizar', 'formularios', saved.id, { titulo: saved.titulo, tipo: saved.tipo })
    setForms(prev => {
      const exists = prev.find(f => f.id === saved.id)
      return exists ? prev.map(f => f.id === saved.id ? { ...f, ...saved } : f) : [saved, ...prev]
    })
    setEditing(null)
  }

  if (viewing) {
    return <RespostasViewer form={viewing} onBack={() => setViewing(null)} />
  }

  if (editing !== null) {
    return (
      <FormEditor
        form={editing.id ? editing : null}
        onSave={handleSaved}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <FormulariosList
      forms={forms}
      loading={loading}
      onNew={() => setEditing({})}
      onEdit={f => setEditing(f)}
      onDelete={handleDelete}
      onToggleAtivo={handleToggleAtivo}
      onViewRespostas={f => setViewing(f)}
    />
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1.5px solid var(--border)', background: 'var(--bg)',
  fontSize: 13, color: 'var(--text)', fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6,
}
const btnPrimary = {
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}
const btnSmall = {
  padding: '8px 12px', borderRadius: 7, border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const btnIcon = {
  width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)',
  background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit', fontSize: 12,
}

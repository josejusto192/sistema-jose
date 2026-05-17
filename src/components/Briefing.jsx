import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'
import { useIsSuperAdmin } from '../App.jsx'
import { IconCheck, IconEdit, IconPlus, IconTrash, IconX } from './Icons.jsx'

const TIPOS = [
  { value: 'text',     label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'select',   label: 'Lista (select)' },
  { value: 'radio',    label: 'Opção única' },
  { value: 'checkbox', label: 'Múltipla escolha' },
  { value: 'number',   label: 'Número' },
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function QuestionInput({ q, value, onChange, onCheckbox }) {
  const base = {
    width: '100%', padding: '8px 10px', background: 'var(--bg3)',
    border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  if (q.tipo === 'textarea')
    return <textarea value={value || ''} onChange={e => onChange(q.id, e.target.value)} rows={3} style={{ ...base, resize: 'vertical', lineHeight: 1.5 }} />

  if (q.tipo === 'select')
    return (
      <select value={value || ''} onChange={e => onChange(q.id, e.target.value)} style={base}>
        <option value="">Selecionar...</option>
        {(q.opcoes || []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )

  if (q.tipo === 'radio')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {(q.opcoes || []).map(o => (
          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
            <input type="radio" name={q.id} value={o} checked={value === o} onChange={() => onChange(q.id, o)} style={{ accentColor: 'var(--accent)' }} />
            {o}
          </label>
        ))}
      </div>
    )

  if (q.tipo === 'checkbox') {
    const sel = Array.isArray(value) ? value : []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {(q.opcoes || []).map(o => (
          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
            <input type="checkbox" checked={sel.includes(o)} onChange={e => onCheckbox(q.id, o, e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            {o}
          </label>
        ))}
      </div>
    )
  }

  if (q.tipo === 'number')
    return <input type="number" value={value || ''} onChange={e => onChange(q.id, e.target.value)} style={base} />

  return <input type="text" value={value || ''} onChange={e => onChange(q.id, e.target.value)} style={base} />
}

export default function Briefing({ lead }) {
  const isSuperAdmin = useIsSuperAdmin()
  const [currentTemplate, setCurrentTemplate] = useState(null)  // template atual do banco
  const [templateId, setTemplateId]           = useState(null)
  const [activeTemplate, setActiveTemplate]   = useState(null)  // template em uso para exibir
  const [respostas, setRespostas]             = useState({})
  const [hasSnapshot, setHasSnapshot]         = useState(false) // briefing foi salvo com template antigo?
  const [loading, setLoading]                 = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [saved, setSaved]                     = useState(false)
  const [editMode, setEditMode]               = useState(false)
  const [editTpl, setEditTpl]                 = useState(null)
  const [savingTpl, setSavingTpl]             = useState(false)

  useEffect(() => { load() }, [lead.id])

  async function load() {
    setLoading(true)
    const [{ data: tpl }, { data: resp }] = await Promise.all([
      supabase.from('briefing_template').select('*').limit(1).single(),
      supabase.from('briefing_respostas')
        .select('respostas, template_snapshot')
        .eq('empresa_id', lead.id)
        .maybeSingle(),
    ])
    if (tpl) { setTemplateId(tpl.id); setCurrentTemplate(tpl.secoes || []) }

    if (resp) {
      setRespostas(resp.respostas || {})
      // Se o briefing tem snapshot E é diferente do template atual, usa o snapshot
      if (resp.template_snapshot && tpl) {
        const snapshotIds = resp.template_snapshot.flatMap(s => s.perguntas.map(q => q.id)).sort().join()
        const currentIds  = (tpl.secoes || []).flatMap(s => s.perguntas.map(q => q.id)).sort().join()
        if (snapshotIds !== currentIds) {
          setActiveTemplate(resp.template_snapshot)
          setHasSnapshot(true)
          setLoading(false)
          return
        }
      }
    }

    if (tpl) setActiveTemplate(tpl.secoes || [])
    setHasSnapshot(false)
    setLoading(false)
  }

  function switchToCurrentTemplate() {
    setActiveTemplate(currentTemplate)
    setHasSnapshot(false)
  }

  function handleChange(qid, val)             { setRespostas(p => ({ ...p, [qid]: val })) }
  function handleCheckbox(qid, opt, checked)  {
    setRespostas(p => {
      const cur = Array.isArray(p[qid]) ? p[qid] : []
      return { ...p, [qid]: checked ? [...cur, opt] : cur.filter(o => o !== opt) }
    })
  }

  async function save() {
    setSaving(true)
    // Salva respostas + snapshot do template atual — protege contra mudanças futuras
    await supabase.from('briefing_respostas').upsert(
      {
        empresa_id:        lead.id,
        respostas,
        template_snapshot: currentTemplate,
        atualizado_em:     new Date().toISOString(),
      },
      { onConflict: 'empresa_id' }
    )
    setActiveTemplate(currentTemplate)
    setHasSnapshot(false)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Template editor helpers ───────────────────────────────────────────────
  function startEdit() { setEditTpl(JSON.parse(JSON.stringify(currentTemplate))); setEditMode(true) }
  function cancelEdit() { setEditMode(false); setEditTpl(null) }

  async function saveTemplate() {
    setSavingTpl(true)
    const { error } = await supabase
      .from('briefing_template')
      .update({ secoes: editTpl, atualizado_em: new Date().toISOString() })
      .eq('id', templateId)
    if (!error) { setCurrentTemplate(editTpl); setActiveTemplate(editTpl); setEditMode(false); setEditTpl(null) }
    setSavingTpl(false)
  }

  function updSec(si, key, val) {
    setEditTpl(p => p.map((s, i) => i === si ? { ...s, [key]: val } : s))
  }
  function addSec() {
    setEditTpl(p => [...p, { id: uid(), titulo: 'Nova seção', perguntas: [] }])
  }
  function delSec(si) { setEditTpl(p => p.filter((_, i) => i !== si)) }

  function addQ(si) {
    setEditTpl(p => p.map((s, i) => i === si
      ? { ...s, perguntas: [...s.perguntas, { id: uid(), tipo: 'text', label: '', obrigatorio: false, opcoes: [] }] }
      : s))
  }
  function updQ(si, qi, key, val) {
    setEditTpl(p => p.map((s, i) => i === si
      ? { ...s, perguntas: s.perguntas.map((q, j) => j === qi ? { ...q, [key]: val } : q) }
      : s))
  }
  function delQ(si, qi) {
    setEditTpl(p => p.map((s, i) => i === si
      ? { ...s, perguntas: s.perguntas.filter((_, j) => j !== qi) }
      : s))
  }
  function updOpts(si, qi, raw) {
    updQ(si, qi, 'opcoes', raw.split('\n').map(o => o.trim()).filter(Boolean))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
  )
  if (!activeTemplate) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Template não encontrado. Rode a migration 005.</div>
  )

  const answered = Object.keys(respostas).filter(k => {
    const v = respostas[k]; return v !== '' && v != null && !(Array.isArray(v) && v.length === 0)
  }).length
  const total = activeTemplate.reduce((n, s) => n + s.perguntas.length, 0)

  const SaveBtn = ({ style }) => (
    <button onClick={save} disabled={saving} style={{
      padding: '8px 18px', borderRadius: 8, border: saved ? '1px solid var(--green)' : 'none',
      background: saved ? 'var(--green-bg)' : 'var(--accent)',
      color: saved ? 'var(--green)' : '#fff',
      fontSize: 13, fontWeight: 500, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 5, ...style,
    }}>
      {saving ? 'Salvando...' : saved ? <><IconCheck size={13} color="var(--green)" /> Salvo!</> : 'Salvar briefing'}
    </button>
  )

  // ── Template editor ──────────────────────────────────────────────────────
  if (editMode && editTpl) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Editar Template</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={cancelEdit} style={{ padding: '7px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={saveTemplate} disabled={savingTpl} style={{ padding: '7px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            {savingTpl ? 'Salvando...' : 'Salvar template'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {editTpl.map((sec, si) => (
          <div key={sec.id} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <input
                value={sec.titulo}
                onChange={e => updSec(si, 'titulo', e.target.value)}
                placeholder="Título da seção"
                style={{ flex: 1, padding: '7px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontWeight: 600, outline: 'none' }}
              />
              <button onClick={() => delSec(si)} style={{ padding: '6px 8px', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                <IconTrash size={14} color="var(--text3)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sec.perguntas.map((q, qi) => (
                <div key={q.id} style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input
                      value={q.label}
                      onChange={e => updQ(si, qi, 'label', e.target.value)}
                      placeholder="Texto da pergunta"
                      style={{ flex: 1, padding: '5px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none' }}
                    />
                    <select
                      value={q.tipo}
                      onChange={e => updQ(si, qi, 'tipo', e.target.value)}
                      style={{ padding: '5px 7px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 11, outline: 'none' }}
                    >
                      {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button onClick={() => delQ(si, qi)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
                      <IconX size={12} color="var(--text3)" />
                    </button>
                  </div>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)', cursor: 'pointer', marginBottom: ['select','radio','checkbox'].includes(q.tipo) ? 6 : 0 }}>
                    <input type="checkbox" checked={q.obrigatorio} onChange={e => updQ(si, qi, 'obrigatorio', e.target.checked)} />
                    Obrigatório
                  </label>

                  {['select', 'radio', 'checkbox'].includes(q.tipo) && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Opções (uma por linha):</div>
                      <textarea
                        value={(q.opcoes || []).join('\n')}
                        onChange={e => updOpts(si, qi, e.target.value)}
                        rows={3}
                        placeholder={"Opção 1\nOpção 2\nOpção 3"}
                        style={{ width: '100%', padding: '5px 7px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 11, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                </div>
              ))}

              <button onClick={() => addQ(si)} style={{ padding: '7px', background: 'none', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <IconPlus size={12} color="var(--text3)" /> Adicionar pergunta
              </button>
            </div>
          </div>
        ))}

        <button onClick={addSec} style={{ padding: '10px', background: 'none', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <IconPlus size={14} color="var(--text3)" /> Adicionar seção
        </button>
      </div>
    </div>
  )

  // ── Briefing form ────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasSnapshot ? 12 : 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>Briefing</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{answered}/{total} perguntas respondidas</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isSuperAdmin && (
            <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>
              <IconEdit size={12} color="var(--text3)" /> Editar template
            </button>
          )}
          <SaveBtn />
        </div>
      </div>

      {/* Banner: template foi alterado após o último save */}
      {hasSnapshot && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--yellow-bg, #FFFBEB)', border: '1px solid var(--yellow, #D97706)30', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--yellow, #92400E)' }}>
            O template foi alterado desde o último salvamento. Exibindo a versão com que este briefing foi preenchido.
          </div>
          <button
            onClick={switchToCurrentTemplate}
            style={{ flexShrink: 0, padding: '5px 12px', background: 'none', border: '1px solid var(--yellow, #D97706)', borderRadius: 6, color: 'var(--yellow, #92400E)', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Usar template atual
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {activeTemplate.map(sec => (
          <div key={sec.id} className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              {sec.titulo}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sec.perguntas.map(q => (
                <div key={q.id}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
                    {q.label}
                    {q.obrigatorio && <span style={{ color: 'var(--accent)', marginLeft: 3 }}>*</span>}
                  </label>
                  <QuestionInput q={q} value={respostas[q.id]} onChange={handleChange} onCheckbox={handleCheckbox} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
        <SaveBtn />
      </div>
    </div>
  )
}

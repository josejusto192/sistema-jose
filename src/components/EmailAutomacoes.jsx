import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase.js'
import { leadName } from '../constants.js'
import { IconPlus, IconTrash, IconArrowLeft, IconCheck } from './Icons.jsx'

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
const chipStyle = (ativo) => ({
  padding: '5px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)',
  background: ativo ? 'var(--accent)' : 'var(--bg2)', color: ativo ? '#fff' : 'var(--text2)',
})

function novoStep() {
  return { ordem: 0, atraso_dias: 0, usar_ia: false, assunto: '', corpo_html: '', ia_objetivo: '' }
}

/* ─── Form de criação/edição ──────────────────────────────────────────────── */
function AutomacaoForm({ automacao, tagsDisponiveis, onCancel, onSaved }) {
  const [nome, setNome] = useState(automacao?.nome || '')
  const [ativo, setAtivo] = useState(automacao?.ativo ?? true)
  const [origemFiltro, setOrigemFiltro] = useState(automacao?.origem_filtro || [])
  const [segmentoTags, setSegmentoTags] = useState(automacao?.segmento_tags || [])
  const [steps, setSteps] = useState(automacao?.steps?.length ? automacao.steps : [novoStep()])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  function toggleOrigem(v) {
    setOrigemFiltro(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }
  function toggleTag(t) {
    setSegmentoTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }
  function updateStep(i, patch) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }
  function addStep() {
    setSteps(prev => [...prev, novoStep()])
  }
  function removeStep(i) {
    setSteps(prev => prev.filter((_, idx) => idx !== i))
  }

  async function salvar() {
    if (!nome.trim()) { setErro('Dê um nome para a automação'); return }
    if (steps.length === 0) { setErro('Adicione pelo menos um passo/email'); return }
    for (const s of steps) {
      if (s.usar_ia && !s.ia_objetivo?.trim()) { setErro('Defina o objetivo de IA em todos os passos com IA'); return }
      if (!s.usar_ia && (!s.assunto?.trim() || !s.corpo_html?.trim())) { setErro('Defina assunto e corpo em todos os passos sem IA'); return }
    }
    setSalvando(true)
    setErro(null)
    try {
      let automationId = automacao?.id
      const payload = {
        nome: nome.trim(), ativo,
        origem_filtro: origemFiltro.length ? origemFiltro : null,
        segmento_tags: segmentoTags.length ? segmentoTags : null,
      }
      if (automationId) {
        const { error } = await supabase.from('email_automations').update(payload).eq('id', automationId)
        if (error) throw error
        await supabase.from('email_automation_steps').delete().eq('automation_id', automationId)
      } else {
        const { data, error } = await supabase.from('email_automations').insert(payload).select('id').single()
        if (error) throw error
        automationId = data.id
      }
      const stepsPayload = steps.map((s, i) => ({
        automation_id: automationId, ordem: i + 1, atraso_dias: Number(s.atraso_dias) || 0,
        usar_ia: s.usar_ia, assunto: s.usar_ia ? null : s.assunto.trim(), corpo_html: s.usar_ia ? null : s.corpo_html,
        ia_objetivo: s.usar_ia ? s.ia_objetivo.trim() : null,
      }))
      const { error: stepsError } = await supabase.from('email_automation_steps').insert(stepsPayload)
      if (stepsError) throw stepsError
      onSaved()
    } catch (e) {
      setErro(e.message || 'Erro ao salvar automação')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <button onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 13, marginBottom: 16, padding: 0, fontFamily: 'inherit' }}>
        <IconArrowLeft size={14} color="var(--text2)" /> Voltar
      </button>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>{automacao ? 'Editar automação' : 'Nova automação'}</h2>

      {erro && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f8d7da', color: '#c0392b', fontSize: 13, marginBottom: 16 }}>{erro}</div>}

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nome da automação</label>
          <input style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Boas-vindas leads Casa dos Dados" />
        </div>
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} id="ativo-automacao" />
          <label htmlFor="ativo-automacao" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>Automação ativa (matricula leads novos automaticamente)</label>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Disparar para leads com origem (vazio = qualquer origem)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ORIGENS.map(o => (
              <span key={o.value} onClick={() => toggleOrigem(o.value)} style={chipStyle(origemFiltro.includes(o.value))}>{o.label}</span>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>E que tenham a(s) tag(s) (vazio = qualquer tag)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tagsDisponiveis.length === 0 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhuma tag cadastrada ainda</span>}
            {tagsDisponiveis.map(t => (
              <span key={t} onClick={() => toggleTag(t)} style={chipStyle(segmentoTags.includes(t))}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '20px 0 10px' }}>Sequência de emails</div>
      {steps.map((s, i) => (
        <div key={i} className="card" style={{ padding: 18, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Email {i + 1}</span>
            {steps.length > 1 && (
              <button onClick={() => removeStep(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <IconTrash size={14} color="var(--text3)" />
              </button>
            )}
          </div>
          <div style={{ marginBottom: 12, maxWidth: 260 }}>
            <label style={labelStyle}>{i === 0 ? 'Enviar quantos dias após a matrícula' : 'Esperar quantos dias após o email anterior'}</label>
            <input type="number" min={0} style={inputStyle} value={s.atraso_dias} onChange={e => updateStep(i, { atraso_dias: e.target.value })} />
          </div>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={s.usar_ia} onChange={e => updateStep(i, { usar_ia: e.target.checked })} id={`ia-step-${i}`} />
            <label htmlFor={`ia-step-${i}`} style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>Gerar este email com IA (individual por lead)</label>
          </div>
          {s.usar_ia ? (
            <div>
              <label style={labelStyle}>Objetivo deste email (a IA recebe isso + os dados do lead)</label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={s.ia_objetivo} onChange={e => updateStep(i, { ia_objetivo: e.target.value })} placeholder="Ex: Se apresentar e oferecer uma consultoria jurídica gratuita..." />
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Assunto (use {'{{nome}}'}, {'{{empresa}}'})</label>
                <input style={inputStyle} value={s.assunto} onChange={e => updateStep(i, { assunto: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Corpo do email (HTML)</label>
                <textarea style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} value={s.corpo_html} onChange={e => updateStep(i, { corpo_html: e.target.value })} />
              </div>
            </>
          )}
        </div>
      ))}
      <button onClick={addStep} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: '1px dashed var(--border)', background: 'none', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20 }}>
        <IconPlus size={12} color="var(--text2)" /> Adicionar próximo email
      </button>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={salvar} disabled={salvando} style={{ padding: '10px 18px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1, fontFamily: 'inherit' }}>
          {salvando ? 'Salvando...' : 'Salvar automação'}
        </button>
        <button onClick={onCancel} style={{ padding: '10px 18px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
      </div>
    </div>
  )
}

/* ─── Detalhe (matrículas/envios) ─────────────────────────────────────────── */
function AutomacaoDetalhe({ automacao, empresas, onBack }) {
  const [enrollments, setEnrollments] = useState([])
  const [envios, setEnvios] = useState([])
  const [loading, setLoading] = useState(true)
  const leadById = useState(() => new Map(empresas.map(e => [e.id, e])))[0]

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: en } = await supabase.from('email_automation_enrollments').select('*').eq('automation_id', automacao.id).order('enrolled_at', { ascending: false })
      const { data: ev } = await supabase.from('email_automation_envios').select('*').eq('automation_id', automacao.id)
      setEnrollments(en || [])
      setEnvios(ev || [])
      setLoading(false)
    })()
  }, [automacao.id])

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 13, marginBottom: 16, padding: 0, fontFamily: 'inherit' }}>
        <IconArrowLeft size={14} color="var(--text2)" /> Voltar
      </button>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{automacao.nome}</h2>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>{enrollments.length} lead(s) matriculado(s)</div>

      {enrollments.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Nenhum lead matriculado ainda. Leads novos que baterem com o filtro entram automaticamente.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {enrollments.map(en => {
            const lead = leadById.get(en.lead_id)
            const meusEnvios = envios.filter(e => e.enrollment_id === en.id).sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))
            return (
              <div key={en.id} className="card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{lead ? leadName(lead) : 'Lead removido'}</span>
                  <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: en.status === 'ativo' ? '#fff3cd' : en.status === 'concluido' ? '#d4edda' : 'var(--bg3)', color: en.status === 'ativo' ? '#92740c' : en.status === 'concluido' ? '#1e7e34' : 'var(--text3)' }}>
                    {en.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {meusEnvios.map((e, i) => (
                    <span key={e.id} title={e.erro || ''} style={{
                      fontSize: 11, padding: '3px 9px', borderRadius: 20,
                      background: e.status === 'enviado' ? '#d4edda' : e.status === 'falhou' ? '#f8d7da' : e.status === 'cancelado' ? 'var(--bg3)' : 'var(--bg3)',
                      color: e.status === 'enviado' ? '#1e7e34' : e.status === 'falhou' ? '#c0392b' : 'var(--text3)',
                    }}>
                      Email {i + 1}: {e.status} {e.status === 'pendente' && `(${new Date(e.scheduled_for).toLocaleDateString('pt-BR')})`}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Lista ────────────────────────────────────────────────────────────────── */
export default function EmailAutomacoes({ empresas = [] }) {
  const [automacoes, setAutomacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [detalhe, setDetalhe] = useState(null)

  const tagsDisponiveis = useState(() => {
    const set = new Set()
    empresas.forEach(e => (e.tags || []).forEach(t => set.add(t)))
    return Array.from(set).sort()
  })[0]

  const fetchAutomacoes = useCallback(async () => {
    setLoading(true)
    const { data: autos } = await supabase.from('email_automations').select('*').order('created_at', { ascending: false })
    const { data: steps } = await supabase.from('email_automation_steps').select('*').order('ordem', { ascending: true })
    const { data: enrollCounts } = await supabase.from('email_automation_enrollments').select('automation_id, status')
    const stepsByAuto = {}
    ;(steps || []).forEach(s => { (stepsByAuto[s.automation_id] = stepsByAuto[s.automation_id] || []).push(s) })
    const countsByAuto = {}
    ;(enrollCounts || []).forEach(e => {
      const c = countsByAuto[e.automation_id] || (countsByAuto[e.automation_id] = { total: 0, ativos: 0 })
      c.total++
      if (e.status === 'ativo') c.ativos++
    })
    setAutomacoes((autos || []).map(a => ({ ...a, steps: stepsByAuto[a.id] || [], counts: countsByAuto[a.id] || { total: 0, ativos: 0 } })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAutomacoes() }, [fetchAutomacoes])

  async function excluir(id) {
    if (!confirm('Excluir esta automação? Leads já matriculados deixarão de receber os próximos emails da sequência.')) return
    await supabase.from('email_automations').delete().eq('id', id)
    fetchAutomacoes()
  }

  async function toggleAtivo(a) {
    await supabase.from('email_automations').update({ ativo: !a.ativo }).eq('id', a.id)
    fetchAutomacoes()
  }

  if (showForm) {
    return (
      <AutomacaoForm
        automacao={editando}
        tagsDisponiveis={tagsDisponiveis}
        onCancel={() => { setShowForm(false); setEditando(null) }}
        onSaved={() => { setShowForm(false); setEditando(null); fetchAutomacoes() }}
      />
    )
  }

  if (detalhe) {
    return <AutomacaoDetalhe automacao={detalhe} empresas={empresas} onBack={() => setDetalhe(null)} />
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Sequências automáticas disparadas quando um lead novo bate com o filtro definido.</div>
        <button
          onClick={() => { setEditando(null); setShowForm(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <IconPlus size={14} color="#fff" /> Nova automação
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
      ) : automacoes.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>Nenhuma automação criada ainda.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {automacoes.map(a => (
            <div key={a.id} className="card" onClick={() => setDetalhe(a)} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{a.nome}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: a.ativo ? '#d4edda' : 'var(--bg3)', color: a.ativo ? '#1e7e34' : 'var(--text3)' }}>
                    {a.ativo ? 'Ativa' : 'Pausada'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  {a.steps.length} email(s) na sequência
                  {a.origem_filtro?.length ? ` · origem: ${a.origem_filtro.join(', ')}` : ''}
                  {a.segmento_tags?.length ? ` · tags: ${a.segmento_tags.join(', ')}` : ''}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {a.counts.total} matriculado(s) · {a.counts.ativos} em andamento
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => toggleAtivo(a)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {a.ativo ? 'Pausar' : 'Ativar'}
                </button>
                <button onClick={() => { setEditando(a); setShowForm(true) }} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Editar
                </button>
                <button onClick={() => excluir(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex' }}>
                  <IconTrash size={14} color="var(--text3)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

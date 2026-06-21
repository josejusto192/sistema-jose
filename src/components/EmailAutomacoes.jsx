import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../supabase.js'
import { leadName, STATUS_CONFIG } from '../constants.js'
import { IconPlus, IconTrash, IconArrowLeft, IconCheck, IconZap, IconFilter, IconFlag, IconMail, IconClock, IconX } from './Icons.jsx'
import CnaeFilter from './CnaeFilter.jsx'
import SeletorDestinatarios from './SeletorDestinatarios.jsx'

const ORIGENS = [
  { value: 'manual',         label: 'Manual (app)' },
  { value: 'n8n',            label: 'Automação n8n' },
  { value: 'site',           label: 'Site / formulário' },
  { value: 'indicacao',      label: 'Indicação' },
  { value: 'casa_dos_dados', label: 'Casa dos Dados' },
  { value: 'outro',          label: 'Outro' },
]

const TIPOS_GATILHO = [
  { value: 'lead_criado',    label: 'Lead novo for criado' },
  { value: 'status_mudou',   label: 'Status do lead mudar para...' },
  { value: 'tag_adicionada', label: 'Uma tag for adicionada ao lead' },
  { value: 'tag_removida',   label: 'Uma tag for removida do lead' },
]

function gatilhoLabel(t) {
  if (t.tipo === 'lead_criado') return 'Lead novo for criado'
  if (t.tipo === 'status_mudou') return `status mudar para "${STATUS_CONFIG[t.valor]?.label || t.valor}"`
  if (t.tipo === 'tag_adicionada') return `tag "${t.valor}" for adicionada`
  if (t.tipo === 'tag_removida') return `tag "${t.valor}" for removida`
  return t.tipo
}

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
  return { ordem: 0, atraso_dias: 0, usar_ia: false, assunto: '', corpo_html: '', ia_objetivo: '', responder_para: '', cc: '', cco: '', anexos: [] }
}

function emailsDeLista(texto) {
  return texto.split(',').map(s => s.trim()).filter(Boolean)
}

// Normaliza um step vindo do banco (cc/cco como array) pro formato editável (string separada por vírgula).
function stepParaEdicao(s) {
  return { ...s, cc: (s.cc || []).join(', '), cco: (s.cco || []).join(', '), anexos: s.anexos || [] }
}

function novoGatilho() {
  return { tipo: 'lead_criado', valor: null }
}

const pillNumberStyle = {
  width: 42, padding: '2px 4px', border: 'none', borderRadius: 4, background: 'var(--bg3)',
  color: 'var(--text)', fontSize: 12, fontWeight: 700, textAlign: 'center', fontFamily: 'inherit',
}

// Um "nó" do fluxo: bolinha colorida com ícone + linha vertical conectando ao próximo nó.
function FlowNode({ icon, color, isLast, children }) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
          {icon}
        </div>
        {!isLast && <div style={{ flex: 1, width: 2, background: 'var(--border)', minHeight: 18 }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: 18, minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}

function FlowCard({ color, children }) {
  return (
    <div className="card" style={{ padding: 16, borderLeft: `3px solid ${color}` }}>
      {children}
    </div>
  )
}

/* ─── Form de criação/edição ──────────────────────────────────────────────── */
function AutomacaoForm({ automacao, empresas, tagsDisponiveis, cnaesDisponiveis, onCancel, onSaved }) {
  const [nome, setNome] = useState(automacao?.nome || '')
  const [ativo, setAtivo] = useState(automacao?.ativo ?? true)
  const [publicoModo, setPublicoModo] = useState(automacao?.leads_manual?.length ? 'manual' : 'segmento')
  const [leadsManual, setLeadsManual] = useState(automacao?.leads_manual || [])
  const [origemFiltro, setOrigemFiltro] = useState(automacao?.origem_filtro || [])
  const [segmentoTags, setSegmentoTags] = useState(automacao?.segmento_tags || [])
  const [cnaeFiltro, setCnaeFiltro] = useState(automacao?.cnae_filtro || [])
  const [steps, setSteps] = useState(automacao?.steps?.length ? automacao.steps.map(stepParaEdicao) : [novoStep()])
  const [opcoesAvancadasStep, setOpcoesAvancadasStep] = useState({})
  const [triggers, setTriggers] = useState(automacao?.triggers?.length ? automacao.triggers : [novoGatilho()])
  const [pararSePerdido, setPararSePerdido] = useState(automacao?.parar_se_perdido ?? true)
  const [iniciarAgora, setIniciarAgora] = useState(!automacao)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  const segmentoCount = useMemo(() => {
    return empresas.filter(e => {
      if (!e.email?.includes('@') || e.email_opt_out) return false
      if (origemFiltro.length && !origemFiltro.includes(e.origem)) return false
      if (segmentoTags.length && !(e.tags || []).some(t => segmentoTags.includes(t))) return false
      if (cnaeFiltro.length && !cnaeFiltro.includes(e.cnae_principal_descricao)) return false
      return true
    }).length
  }, [empresas, origemFiltro, segmentoTags, cnaeFiltro])

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
  function toggleOpcoesAvancadasStep(i) {
    setOpcoesAvancadasStep(prev => ({ ...prev, [i]: !prev[i] }))
  }
  function addAnexoStep(i) {
    updateStep(i, { anexos: [...(steps[i].anexos || []), { filename: '', url: '' }] })
  }
  function atualizarAnexoStep(i, j, campo, valor) {
    updateStep(i, { anexos: steps[i].anexos.map((a, idx) => idx === j ? { ...a, [campo]: valor } : a) })
  }
  function removerAnexoStep(i, j) {
    updateStep(i, { anexos: steps[i].anexos.filter((_, idx) => idx !== j) })
  }
  function updateTrigger(i, patch) {
    setTriggers(prev => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t))
  }
  function addTrigger() {
    setTriggers(prev => [...prev, novoGatilho()])
  }
  function removeTrigger(i) {
    setTriggers(prev => prev.filter((_, idx) => idx !== i))
  }

  async function salvar() {
    if (!nome.trim()) { setErro('Dê um nome para a campanha'); return }
    if (publicoModo === 'manual' && leadsManual.length === 0) { setErro('Selecione pelo menos um lead'); return }
    if (steps.length === 0) { setErro('Adicione pelo menos um passo/email'); return }
    for (const s of steps) {
      if (s.usar_ia && !s.ia_objetivo?.trim()) { setErro('Defina o objetivo de IA em todos os passos com IA'); return }
      if (!s.usar_ia && (!s.assunto?.trim() || !s.corpo_html?.trim())) { setErro('Defina assunto e corpo em todos os passos sem IA'); return }
    }
    for (const t of triggers) {
      if (t.tipo !== 'lead_criado' && !t.valor?.trim()) { setErro('Defina o valor de todos os gatilhos (status ou tag)'); return }
    }
    setSalvando(true)
    setErro(null)
    try {
      let automationId = automacao?.id
      const payload = {
        nome: nome.trim(), ativo, parar_se_perdido: pararSePerdido,
        leads_manual: publicoModo === 'manual' ? leadsManual : null,
        origem_filtro: publicoModo === 'manual' || !origemFiltro.length ? null : origemFiltro,
        segmento_tags: publicoModo === 'manual' || !segmentoTags.length ? null : segmentoTags,
        cnae_filtro: publicoModo === 'manual' || !cnaeFiltro.length ? null : cnaeFiltro,
      }
      if (automationId) {
        const { error } = await supabase.from('email_automations').update(payload).eq('id', automationId)
        if (error) throw error
        await supabase.from('email_automation_steps').delete().eq('automation_id', automationId)
        await supabase.from('email_automation_triggers').delete().eq('automation_id', automationId)
      } else {
        const { data, error } = await supabase.from('email_automations').insert(payload).select('id').single()
        if (error) throw error
        automationId = data.id
      }
      const stepsPayload = steps.map((s, i) => ({
        automation_id: automationId, ordem: i + 1, atraso_dias: Number(s.atraso_dias) || 0,
        usar_ia: s.usar_ia, assunto: s.usar_ia ? null : s.assunto.trim(), corpo_html: s.usar_ia ? null : s.corpo_html,
        ia_objetivo: s.usar_ia ? s.ia_objetivo.trim() : null,
        responder_para: s.responder_para?.trim() || null,
        cc: emailsDeLista(s.cc || ''),
        cco: emailsDeLista(s.cco || ''),
        anexos: (s.anexos || []).filter(a => a.url?.trim()),
      }))
      const { error: stepsError } = await supabase.from('email_automation_steps').insert(stepsPayload)
      if (stepsError) throw stepsError
      if (triggers.length) {
        const triggersPayload = triggers.map(t => ({
          automation_id: automationId, tipo: t.tipo, valor: t.tipo === 'lead_criado' ? null : t.valor.trim(),
        }))
        const { error: triggersError } = await supabase.from('email_automation_triggers').insert(triggersPayload)
        if (triggersError) throw triggersError
      }
      let matriculados = null
      if (iniciarAgora) {
        const { data: count, error: rpcError } = await supabase.rpc('fn_matricular_leads_existentes', { p_automation_id: automationId })
        if (rpcError) throw rpcError
        matriculados = count
      }
      onSaved(matriculados)
    } catch (e) {
      setErro(e.message || 'Erro ao salvar campanha')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <button onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 13, marginBottom: 16, padding: 0, fontFamily: 'inherit' }}>
        <IconArrowLeft size={14} color="var(--text2)" /> Voltar
      </button>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>{automacao ? 'Editar campanha' : 'Nova campanha'}</h2>

      {erro && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f8d7da', color: '#c0392b', fontSize: 13, marginBottom: 16 }}>{erro}</div>}

      <div className="card" style={{ padding: 18, marginBottom: 24 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nome da campanha</label>
          <input style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Boas-vindas leads Casa dos Dados" />
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} id="ativo-automacao" />
            <label htmlFor="ativo-automacao" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>Campanha ativa</label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={pararSePerdido} onChange={e => setPararSePerdido(e.target.checked)} id="parar-perdido-automacao" />
            <label htmlFor="parar-perdido-automacao" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>Cancelar pendentes se o lead virar "Perdido"</label>
          </div>
        </div>
      </div>

      <div>
        <FlowNode icon={<IconZap size={15} color="#fff" />} color="#F59E0B">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Quando (qualquer um dos gatilhos abaixo dispara)</div>
          <FlowCard color="#F59E0B">
            {triggers.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i === triggers.length - 1 ? 0 : 8 }}>
                <select style={{ ...inputStyle, width: 'auto', flex: '0 0 240px' }} value={t.tipo} onChange={e => updateTrigger(i, { tipo: e.target.value, valor: null })}>
                  {TIPOS_GATILHO.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
                {t.tipo === 'status_mudou' && (
                  <select style={{ ...inputStyle, width: 'auto', flex: '0 0 180px' }} value={t.valor || ''} onChange={e => updateTrigger(i, { valor: e.target.value })}>
                    <option value="">Selecione o status...</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                )}
                {(t.tipo === 'tag_adicionada' || t.tipo === 'tag_removida') && (
                  <input style={{ ...inputStyle, width: 'auto', flex: '0 0 180px' }} value={t.valor || ''} onChange={e => updateTrigger(i, { valor: e.target.value })} placeholder="Nome da tag" list="tags-disponiveis-automacao" />
                )}
                <button onClick={() => removeTrigger(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                  <IconTrash size={14} color="var(--text3)" />
                </button>
              </div>
            ))}
            {triggers.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                Sem gatilho: a campanha não matricula ninguém sozinha. Use "Iniciar agora" abaixo pra mandar pros leads que já existem, ou adicione um gatilho pra também pegar leads novos automaticamente.
              </div>
            )}
            <datalist id="tags-disponiveis-automacao">
              {tagsDisponiveis.map(t => <option key={t} value={t} />)}
            </datalist>
            <button onClick={addTrigger} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', marginTop: 10, borderRadius: 6, border: '1px dashed var(--border)', background: 'none', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              <IconPlus size={12} color="var(--text2)" /> Adicionar gatilho
            </button>
          </FlowCard>
        </FlowNode>

        <FlowNode icon={<IconFilter size={14} color="#fff" />} color="#8B5CF6">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Para quem</div>
          <FlowCard color="#8B5CF6">
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <span onClick={() => setPublicoModo('segmento')} style={chipStyle(publicoModo === 'segmento')}>Segmento (filtros)</span>
              <span onClick={() => setPublicoModo('manual')} style={chipStyle(publicoModo === 'manual')}>Leads específicos</span>
            </div>

            {publicoModo === 'segmento' ? (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Origem (vazio = qualquer origem)</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ORIGENS.map(o => (
                      <span key={o.value} onClick={() => toggleOrigem(o.value)} style={chipStyle(origemFiltro.includes(o.value))}>{o.label}</span>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Tag(s) (vazio = qualquer tag)</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {tagsDisponiveis.length === 0 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhuma tag cadastrada ainda</span>}
                    {tagsDisponiveis.map(t => (
                      <span key={t} onClick={() => toggleTag(t)} style={chipStyle(segmentoTags.includes(t))}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Segmento/CNAE (vazio = qualquer segmento)</label>
                  <CnaeFilter allCnaes={cnaesDisponiveis} cnaeFilter={cnaeFiltro} setCnaeFilter={setCnaeFiltro} label="Selecionar segmentos" />
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: segmentoCount > 0 ? 'var(--accent)' : 'var(--text3)' }}>
                  <IconMail size={12} color={segmentoCount > 0 ? 'var(--accent)' : 'var(--text3)'} />
                  {segmentoCount} lead{segmentoCount !== 1 ? 's' : ''} com email bate{segmentoCount !== 1 ? 'm' : ''} com esse filtro agora
                </div>
              </>
            ) : (
              <SeletorDestinatarios
                empresas={empresas}
                tagsDisponiveis={tagsDisponiveis}
                cnaesDisponiveis={cnaesDisponiveis}
                selecionados={leadsManual}
                setSelecionados={setLeadsManual}
              />
            )}

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input type="checkbox" checked={iniciarAgora} onChange={e => setIniciarAgora(e.target.checked)} id="iniciar-agora-automacao" style={{ marginTop: 2 }} />
              <label htmlFor="iniciar-agora-automacao" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                Ao salvar, matricular imediatamente os leads que já existem e batem com esse filtro
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontWeight: 400 }}>
                  Igual disparar pra esses leads agora, mas continua valendo a sequência de dias acima. Não duplica quem já estiver matriculado.
                </div>
              </label>
            </div>
          </FlowCard>
        </FlowNode>

        {steps.map((s, i) => (
          <FlowNode key={i} icon={<IconMail size={14} color="#fff" />} color="#2563EB">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 6px 3px 10px' }}>
                {i === 0 ? 'Enviar após' : 'Esperar'}
                <input type="number" min={0} style={pillNumberStyle} value={s.atraso_dias} onChange={e => updateStep(i, { atraso_dias: e.target.value })} />
                {i === 0 ? 'dia(s) da matrícula' : 'dia(s) do anterior'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Email {i + 1}</span>
              {s.usar_ia && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 20 }}>IA</span>}
              {steps.length > 1 && (
                <button onClick={() => removeStep(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', marginLeft: 'auto' }}>
                  <IconTrash size={14} color="var(--text3)" />
                </button>
              )}
            </div>
            <FlowCard color="#2563EB">
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

              <button
                type="button"
                onClick={() => toggleOpcoesAvancadasStep(i)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginTop: 12, textAlign: 'left' }}
              >
                {opcoesAvancadasStep[i] ? '− Ocultar opções avançadas' : '+ Opções avançadas (responder para, cc/cco, anexos)'}
              </button>

              {opcoesAvancadasStep[i] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg2)' }}>
                  <div>
                    <label style={labelStyle}>Responder para (reply-to)</label>
                    <input style={inputStyle} value={s.responder_para} onChange={e => updateStep(i, { responder_para: e.target.value })} placeholder="ex: vendas@seudominio.com" />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Cc (separados por vírgula)</label>
                      <input style={inputStyle} value={s.cc} onChange={e => updateStep(i, { cc: e.target.value })} placeholder="ex: copia@seudominio.com" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Cco (separados por vírgula)</label>
                      <input style={inputStyle} value={s.cco} onChange={e => updateStep(i, { cco: e.target.value })} placeholder="ex: oculto@seudominio.com" />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Anexos (link do arquivo)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(s.anexos || []).map((a, j) => (
                        <div key={j} style={{ display: 'flex', gap: 8 }}>
                          <input style={{ ...inputStyle, flex: 1 }} value={a.filename} onChange={e => atualizarAnexoStep(i, j, 'filename', e.target.value)} placeholder="nome-do-arquivo.pdf" />
                          <input style={{ ...inputStyle, flex: 2 }} value={a.url} onChange={e => atualizarAnexoStep(i, j, 'url', e.target.value)} placeholder="https://..." />
                          <button type="button" onClick={() => removerAnexoStep(i, j)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', display: 'flex' }}>
                            <IconTrash size={14} color="var(--text3)" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addAnexoStep(i)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                        + Adicionar anexo
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      Informe o link público do arquivo (ex: já hospedado no seu storage) — não é feito upload aqui.
                    </div>
                  </div>
                </div>
              )}
            </FlowCard>
          </FlowNode>
        ))}

        <FlowNode icon={<IconFlag size={14} color="#fff" />} color="#10B981" isLast>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Fim da sequência</div>
          <button onClick={addStep} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: '1px dashed var(--border)', background: 'none', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            <IconPlus size={12} color="var(--text2)" /> Adicionar próximo email
          </button>
        </FlowNode>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button onClick={salvar} disabled={salvando} style={{ padding: '10px 18px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1, fontFamily: 'inherit' }}>
          {salvando ? 'Salvando...' : 'Salvar campanha'}
        </button>
        <button onClick={onCancel} style={{ padding: '10px 18px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
      </div>
    </div>
  )
}

const ENVIO_DOT_CONFIG = {
  enviado:   { bg: '#10B981', icon: <IconCheck size={11} color="#fff" />, label: 'Enviado',   textColor: '#10B981' },
  falhou:    { bg: '#EF4444', icon: <IconX size={11} color="#fff" />,    label: 'Falhou',     textColor: '#EF4444' },
  cancelado: { bg: '#9CA3AF', icon: <IconX size={11} color="#fff" />,    label: 'Cancelado',  textColor: 'var(--text3)' },
  pendente:  { bg: 'var(--bg3)', icon: <IconClock size={10} color="var(--text3)" />, label: 'Agendado', textColor: 'var(--text3)' },
}

// Resumo do progresso de um lead na sequência: "2 de 3 emails enviados" + barra.
function ProgressoResumo({ envios }) {
  const total = envios.length
  const enviados = envios.filter(e => e.status === 'enviado').length
  const falhou = envios.some(e => e.status === 'falhou')
  const cancelado = envios.every(e => e.status === 'cancelado')
  let texto = `${enviados} de ${total} email(s) enviado(s)`
  let cor = 'var(--text3)'
  if (cancelado) { texto = 'Sequência cancelada'; cor = 'var(--text3)' }
  else if (falhou) { texto = `${enviados} de ${total} enviado(s) · houve falha`; cor = '#EF4444' }
  else if (enviados === total) { texto = 'Sequência concluída'; cor = '#10B981' }
  else if (enviados > 0) { cor = '#10B981' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg3)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: total ? `${(enviados / total) * 100}%` : 0, background: falhou ? '#EF4444' : '#10B981', borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: cor, whiteSpace: 'nowrap' }}>{texto}</span>
    </div>
  )
}

// Linha do tempo visual dos envios de um lead matriculado: bolinha por email, conectadas por um traço,
// com rótulo de status explícito embaixo de cada uma (não dá pra confundir enviado x pendente).
function EnvioStepper({ envios }) {
  return (
    <div>
      <div style={{ marginBottom: 10 }}><ProgressoResumo envios={envios} /></div>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {envios.map((e, i) => {
          const conf = ENVIO_DOT_CONFIG[e.status] || ENVIO_DOT_CONFIG.pendente
          const data = new Date(e.status === 'enviado' ? (e.enviado_em || e.scheduled_for) : e.scheduled_for).toLocaleDateString('pt-BR')
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', flex: i === envios.length - 1 ? '0 0 auto' : 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div title={e.erro || ''} style={{ width: 26, height: 26, borderRadius: '50%', background: conf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: e.status === 'enviado' ? '0 0 0 3px rgba(16,185,129,0.15)' : 'none' }}>
                  {conf.icon}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: conf.textColor, whiteSpace: 'nowrap' }}>
                  {conf.label}
                </span>
                <span style={{ fontSize: 9, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                  Email {i + 1} · {data}
                </span>
              </div>
              {i < envios.length - 1 && <div style={{ flex: 1, height: 2, background: envios[i].status === 'enviado' ? '#10B981' : 'var(--border)', margin: '0 4px', minWidth: 16, marginTop: 13 }} />}
            </div>
          )
        })}
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
    <div style={{ padding: '28px 32px' }}>
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
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: en.status === 'ativo' ? '#fff3cd' : en.status === 'concluido' ? '#d4edda' : 'var(--bg3)', color: en.status === 'ativo' ? '#92740c' : en.status === 'concluido' ? '#1e7e34' : 'var(--text3)' }}>
                    {en.status === 'ativo' ? 'Em andamento' : en.status === 'concluido' ? 'Concluído' : 'Cancelado'}
                  </span>
                </div>
                <EnvioStepper envios={meusEnvios} />
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

  const tagsDisponiveis = useMemo(() => {
    const set = new Set()
    empresas.forEach(e => (e.tags || []).forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [empresas])

  const cnaesDisponiveis = useMemo(() => {
    const set = new Set()
    empresas.forEach(e => { if (e.cnae_principal_descricao) set.add(e.cnae_principal_descricao) })
    return Array.from(set).sort()
  }, [empresas])

  const fetchAutomacoes = useCallback(async () => {
    setLoading(true)
    const { data: autos } = await supabase.from('email_automations').select('*').order('created_at', { ascending: false })
    const { data: steps } = await supabase.from('email_automation_steps').select('*').order('ordem', { ascending: true })
    const { data: triggers } = await supabase.from('email_automation_triggers').select('*')
    const { data: enrollCounts } = await supabase.from('email_automation_enrollments').select('automation_id, status')
    const { data: envioCounts } = await supabase.from('email_automation_envios').select('automation_id, status')
    const stepsByAuto = {}
    ;(steps || []).forEach(s => { (stepsByAuto[s.automation_id] = stepsByAuto[s.automation_id] || []).push(s) })
    const triggersByAuto = {}
    ;(triggers || []).forEach(t => { (triggersByAuto[t.automation_id] = triggersByAuto[t.automation_id] || []).push(t) })
    const countsByAuto = {}
    ;(enrollCounts || []).forEach(e => {
      const c = countsByAuto[e.automation_id] || (countsByAuto[e.automation_id] = { total: 0, ativos: 0 })
      c.total++
      if (e.status === 'ativo') c.ativos++
    })
    const envioCountsByAuto = {}
    ;(envioCounts || []).forEach(e => {
      const c = envioCountsByAuto[e.automation_id] || (envioCountsByAuto[e.automation_id] = { enviados: 0, pendentes: 0, falhas: 0 })
      if (e.status === 'enviado') c.enviados++
      else if (e.status === 'pendente') c.pendentes++
      else if (e.status === 'falhou') c.falhas++
    })
    setAutomacoes((autos || []).map(a => ({
      ...a,
      steps: stepsByAuto[a.id] || [],
      triggers: triggersByAuto[a.id] || [],
      counts: countsByAuto[a.id] || { total: 0, ativos: 0 },
      envioCounts: envioCountsByAuto[a.id] || { enviados: 0, pendentes: 0, falhas: 0 },
    })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAutomacoes() }, [fetchAutomacoes])

  const [matriculando, setMatriculando] = useState(null) // id da automação rodando "iniciar agora"

  async function iniciarAgora(a) {
    if (!confirm(`Matricular agora os leads que já existem e batem com o público de "${a.nome}"? Quem já estiver matriculado não é duplicado.`)) return
    setMatriculando(a.id)
    try {
      const { data: count, error } = await supabase.rpc('fn_matricular_leads_existentes', { p_automation_id: a.id })
      if (error) throw error
      alert(`${count} lead(s) existente(s) matriculado(s) na sequência.`)
      fetchAutomacoes()
    } catch (e) {
      alert('Erro ao matricular leads: ' + (e.message || e))
    } finally {
      setMatriculando(null)
    }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta campanha? Leads já matriculados deixarão de receber os próximos emails da sequência.')) return
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
        empresas={empresas}
        tagsDisponiveis={tagsDisponiveis}
        cnaesDisponiveis={cnaesDisponiveis}
        onCancel={() => { setShowForm(false); setEditando(null) }}
        onSaved={(matriculados) => {
          setShowForm(false); setEditando(null); fetchAutomacoes()
          if (matriculados !== null) alert(`${matriculados} lead(s) existente(s) matriculado(s) na sequência.`)
        }}
      />
    )
  }

  if (detalhe) {
    return <AutomacaoDetalhe automacao={detalhe} empresas={empresas} onBack={() => setDetalhe(null)} />
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <IconMail size={20} color="var(--text)" />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Campanhas</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Dispare agora pros leads que já existem e/ou deixe rodando automaticamente pra leads novos.</div>
        <button
          onClick={() => { setEditando(null); setShowForm(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <IconPlus size={14} color="#fff" /> Nova campanha
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
      ) : automacoes.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>Nenhuma campanha criada ainda.</div>
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
                  Quando: {a.triggers.length ? a.triggers.map(gatilhoLabel).join(' OU ') : 'Sem gatilho automático (só via "Iniciar agora")'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  {a.steps.length} email(s) na sequência
                  {a.leads_manual?.length ? ` · ${a.leads_manual.length} lead(s) específico(s)` : ''}
                  {a.origem_filtro?.length ? ` · origem: ${a.origem_filtro.join(', ')}` : ''}
                  {a.segmento_tags?.length ? ` · tags: ${a.segmento_tags.join(', ')}` : ''}
                  {a.cnae_filtro?.length ? ` · segmento: ${a.cnae_filtro.join(', ')}` : ''}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {a.counts.total} matriculado(s) · {a.counts.ativos} em andamento
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#10B981' }}>
                    <IconCheck size={11} color="#10B981" /> {a.envioCounts.enviados} enviado(s)
                  </span>
                  {a.envioCounts.pendentes > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>
                      <IconClock size={11} color="var(--text3)" /> {a.envioCounts.pendentes} agendado(s)
                    </span>
                  )}
                  {a.envioCounts.falhas > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#EF4444' }}>
                      <IconX size={11} color="#EF4444" /> {a.envioCounts.falhas} falhou(falharam)
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => iniciarAgora(a)}
                  disabled={matriculando === a.id}
                  title="Matricular agora os leads existentes que batem com o filtro"
                  style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--accent)', background: 'none', color: 'var(--accent)', fontSize: 12, cursor: matriculando === a.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: matriculando === a.id ? 0.6 : 1 }}
                >
                  {matriculando === a.id ? 'Matriculando...' : 'Iniciar agora'}
                </button>
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

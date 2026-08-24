import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../supabase.js'
import { leadName, STATUS_CONFIG } from '../constants.js'
import { useTheme } from '../App.jsx'
import { IconPlus, IconTrash, IconArrowLeft, IconCheck, IconZap, IconFilter, IconFlag, IconMail, IconClock, IconX } from './Icons.jsx'
import CnaeFilter from './CnaeFilter.jsx'
import SeletorDestinatarios from './SeletorDestinatarios.jsx'
import { useDialog } from './Dialog.jsx'
import '../styles/communications.css'

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
  return { ordem: 0, atraso_dias: 0, usar_ia: false, gerar_assunto_ia: true, assunto: '', corpo_html: '', ia_objetivo: '', responder_para: '', cc: '', cco: '', anexos: [] }
}

function emailsDeLista(texto) {
  return texto.split(',').map(s => s.trim()).filter(Boolean)
}

// Normaliza um step vindo do banco (cc/cco como array) pro formato editável (string separada por vírgula).
function stepParaEdicao(s) {
  return { ...s, gerar_assunto_ia: s.gerar_assunto_ia ?? true, cc: (s.cc || []).join(', '), cco: (s.cco || []).join(', '), anexos: s.anexos || [] }
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
    <div className="email-flow-node">
      <div className="email-flow-rail">
        <div className="email-flow-icon" style={{ background: color }}>
          {icon}
        </div>
        {!isLast && <div className="email-flow-line" />}
      </div>
      <div className="email-flow-content">
        {children}
      </div>
    </div>
  )
}

function FlowCard({ color, children }) {
  return (
    <div className="card email-flow-card" style={{ borderLeftColor: color }}>
      {children}
    </div>
  )
}

/* ─── Form de criação/edição ──────────────────────────────────────────────── */
function AutomacaoForm({ automacao, empresas, tagsDisponiveis, cnaesDisponiveis, onCancel, onSaved, logAction }) {
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
      if (s.usar_ia && !s.gerar_assunto_ia && !s.assunto?.trim()) { setErro('Defina o assunto nos passos em que a IA não cria o assunto'); return }
      if (!s.usar_ia && (!s.assunto?.trim() || !s.corpo_html?.trim())) { setErro('Defina assunto e corpo em todos os passos sem IA'); return }
    }
    for (const t of triggers) {
      if (t.tipo !== 'lead_criado' && !t.valor?.trim()) { setErro('Defina o valor de todos os gatilhos (status ou tag)'); return }
    }
    setSalvando(true)
    setErro(null)
    try {
      let automationId = automacao?.id
      const ehNova = !automationId
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
        usar_ia: s.usar_ia,
        gerar_assunto_ia: s.usar_ia ? !!s.gerar_assunto_ia : true,
        assunto: (s.usar_ia && s.gerar_assunto_ia) ? null : s.assunto.trim(),
        corpo_html: s.usar_ia ? null : s.corpo_html,
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
      logAction?.(ehNova ? 'criar' : 'atualizar', 'email_automations', automationId, { nome: payload.nome, ativo: payload.ativo, steps: stepsPayload.length })
      onSaved(matriculados)
    } catch (e) {
      setErro(e.message || 'Erro ao salvar campanha')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="email-automation-page email-automation-form">
      <button onClick={onCancel} className="email-back-button">
        <IconArrowLeft size={14} color="var(--text2)" /> Voltar
      </button>
      <div className="email-form-heading">
        <span>Construtor de jornada</span>
        <h2>{automacao ? 'Editar campanha' : 'Nova campanha'}</h2>
        <p>Defina quem entra, quando a sequência começa e quais mensagens cada lead recebe.</p>
      </div>

      {erro && <div className="email-form-error" role="alert">{erro}</div>}

      <div className="card email-form-basics">
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle} htmlFor="automation-name">Nome da campanha</label>
          <input id="automation-name" style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Boas-vindas leads Casa dos Dados" />
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
              <div key={i} className="email-trigger-row" style={{ marginBottom: i === triggers.length - 1 ? 0 : 8 }}>
                <select aria-label={`Tipo do gatilho ${i + 1}`} style={{ ...inputStyle, width: 'auto', flex: '0 0 240px' }} value={t.tipo} onChange={e => updateTrigger(i, { tipo: e.target.value, valor: null })}>
                  {TIPOS_GATILHO.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
                {t.tipo === 'status_mudou' && (
                  <select aria-label={`Status do gatilho ${i + 1}`} style={{ ...inputStyle, width: 'auto', flex: '0 0 180px' }} value={t.valor || ''} onChange={e => updateTrigger(i, { valor: e.target.value })}>
                    <option value="">Selecione o status...</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                )}
                {(t.tipo === 'tag_adicionada' || t.tipo === 'tag_removida') && (
                  <input aria-label={`Tag do gatilho ${i + 1}`} style={{ ...inputStyle, width: 'auto', flex: '0 0 180px' }} value={t.valor || ''} onChange={e => updateTrigger(i, { valor: e.target.value })} placeholder="Nome da tag" list="tags-disponiveis-automacao" />
                )}
                <button onClick={() => removeTrigger(i)} className="email-icon-button" aria-label={`Remover gatilho ${i + 1}`}>
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
            <div className="email-mode-tabs">
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
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={s.gerar_assunto_ia} onChange={e => updateStep(i, { gerar_assunto_ia: e.target.checked })} id={`ia-assunto-step-${i}`} />
                    <label htmlFor={`ia-assunto-step-${i}`} style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>Deixar a IA criar o assunto também</label>
                  </div>
                  {!s.gerar_assunto_ia && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={labelStyle}>Assunto (use {'{{nome}}'}, {'{{empresa}}'})</label>
                      <input style={inputStyle} value={s.assunto} onChange={e => updateStep(i, { assunto: e.target.value })} />
                    </div>
                  )}
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
                  <div className="email-form-columns">
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
                        <div key={j} className="email-attachment-row">
                          <input style={{ ...inputStyle, flex: 1 }} value={a.filename} onChange={e => atualizarAnexoStep(i, j, 'filename', e.target.value)} placeholder="nome-do-arquivo.pdf" />
                          <input style={{ ...inputStyle, flex: 2 }} value={a.url} onChange={e => atualizarAnexoStep(i, j, 'url', e.target.value)} placeholder="https://..." />
                          <button type="button" onClick={() => removerAnexoStep(i, j)} className="email-icon-button" aria-label={`Remover anexo ${j + 1}`}>
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

      <div className="email-form-actions">
        <button onClick={salvar} disabled={salvando} className="email-primary-button">
          {salvando ? 'Salvando...' : 'Salvar campanha'}
        </button>
        <button onClick={onCancel} className="email-secondary-button">Cancelar</button>
      </div>
    </div>
  )
}

const ENVIO_DOT_CONFIG = {
  enviado:   { bg: '#10B981', icon: <IconCheck size={11} color="#fff" />, label: 'Enviado',   textColor: '#10B981' },
  falhou:    { bg: '#EF4444', icon: <IconX size={11} color="#fff" />,    label: 'Falhou',     textColor: '#EF4444' },
  cancelado: { bg: '#9CA3AF', icon: <IconX size={11} color="#fff" />,    label: 'Cancelado',  textColor: 'var(--text3)' },
  pendente:  { bg: 'var(--bg3)', icon: <IconClock size={10} color="var(--text3)" />, label: 'Agendado', textColor: 'var(--text3)' },
  rejeitado: { bg: '#B91C1C', icon: <IconX size={11} color="#fff" />,    label: 'Rejeitado (bounce)', textColor: '#B91C1C' },
  spam:      { bg: '#B91C1C', icon: <IconX size={11} color="#fff" />,    label: 'Marcado como spam',  textColor: '#B91C1C' },
}

// O Resend aceita o envio (status fica "enviado") mas bounce/reclamação de
// spam acontecem depois, de forma assíncrona — usa as colunas preenchidas
// pelo webhook pra refletir isso, já que "enviado" sozinho seria enganoso.
function statusVisual(e) {
  if (e.status === 'enviado' && e.bounced_em) return 'rejeitado'
  if (e.status === 'enviado' && e.reclamado_em) return 'spam'
  return e.status
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
    <div className="email-progress-summary">
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg3)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: total ? `${(enviados / total) * 100}%` : 0, background: falhou ? '#EF4444' : '#10B981', borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: cor, whiteSpace: 'nowrap' }}>{texto}</span>
    </div>
  )
}

// Linha do tempo visual dos envios de um lead matriculado: bolinha por email, conectadas por um traço,
// com rótulo de status explícito embaixo de cada uma (não dá pra confundir enviado x pendente).
function EnvioStepper({ envios, detalheAberto, onToggleDetalhe }) {
  return (
    <div className="email-send-stepper">
      <div style={{ marginBottom: 10 }}><ProgressoResumo envios={envios} /></div>
      <div className="email-send-stepper-track">
        {envios.map((e, i) => {
          const status = statusVisual(e)
          const conf = ENVIO_DOT_CONFIG[status] || ENVIO_DOT_CONFIG.pendente
          const data = new Date(e.status === 'enviado' ? (e.enviado_em || e.scheduled_for) : e.scheduled_for).toLocaleDateString('pt-BR')
          const clicavel = !!(e.assunto_gerado || e.corpo_gerado || e.prompt_ia || e.erro)
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', flex: i === envios.length - 1 ? '0 0 auto' : 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => clicavel && onToggleDetalhe(e.id)}
                  style={{
                    width: 26, height: 26, borderRadius: '50%', background: conf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    boxShadow: e.status === 'enviado' ? '0 0 0 3px rgba(16,185,129,0.15)' : (clicavel ? '0 0 0 3px rgba(239,68,68,0.18)' : 'none'),
                    border: 'none', padding: 0, cursor: clicavel ? 'pointer' : 'default',
                  }}
                >
                  {conf.icon}
                </button>
                <span style={{ fontSize: 10, fontWeight: 600, color: conf.textColor, whiteSpace: 'nowrap' }}>
                  {conf.label}{clicavel ? ' · ver detalhes' : ''}
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
      {detalheAberto && (() => {
        const e = envios.find(e => e.id === detalheAberto)
        if (!e) return null
        return (
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
            {(e.bounced_em || e.reclamado_em || (e.status === 'falhou' && e.erro)) && (
              <div style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#EF4444', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 140, overflowY: 'auto' }}>
                {e.bounced_em
                  ? `Bounce: ${e.bounce_motivo || 'endereço rejeitou o email (provavelmente inválido).'}`
                  : e.reclamado_em
                  ? 'O destinatário marcou este email como spam. O lead foi descadastrado automaticamente.'
                  : e.erro}
              </div>
            )}
            {e.assunto_gerado && (
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: 'var(--text2)' }}>Assunto: </strong>
                <span style={{ color: 'var(--text)' }}>{e.assunto_gerado}</span>
              </div>
            )}
            {e.corpo_gerado && (
              <details style={{ marginBottom: e.prompt_ia ? 10 : 0 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text2)', fontWeight: 600 }}>Email enviado</summary>
                <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  <iframe sandbox="" srcDoc={e.corpo_gerado} title="Email enviado" style={{ width: '100%', height: 280, border: 'none', background: '#fff' }} />
                </div>
              </details>
            )}
            {e.prompt_ia && (
              <details>
                <summary style={{ cursor: 'pointer', color: 'var(--text2)', fontWeight: 600 }}>Prompt enviado à IA</summary>
                <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflowY: 'auto', color: 'var(--text2)' }}>
                  {e.prompt_ia}
                </div>
              </details>
            )}
            {!e.assunto_gerado && !e.corpo_gerado && !e.prompt_ia && !e.erro && !e.bounced_em && !e.reclamado_em && (
              <div style={{ color: 'var(--text3)' }}>Nenhum detalhe registrado pra este envio ainda.</div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

/* ─── Detalhe (matrículas/envios) ─────────────────────────────────────────── */
function AutomacaoDetalhe({ automacao, empresas, onBack, onOpenLead }) {
  const { confirmDialog, notify, notifyError, notifySuccess } = useDialog()
  const [enrollments, setEnrollments] = useState([])
  const [envios, setEnvios] = useState([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [detalheAberto, setDetalheAberto] = useState(null) // id do envio cujos detalhes estão expandidos
  const leadById = useState(() => new Map(empresas.map(e => [e.id, e])))[0]

  const carregar = useCallback(async () => {
    setLoading(true)
    const [en, ev] = await Promise.all([
      fetchAllRows('email_automation_enrollments', '*', ['automation_id', automacao.id]),
      fetchAllRows('email_automation_envios', '*', ['automation_id', automacao.id]),
    ])
    en.sort((a, b) => new Date(b.enrolled_at) - new Date(a.enrolled_at))
    setEnrollments(en)
    setEnvios(ev)
    setLoading(false)
  }, [automacao.id])

  useEffect(() => { carregar() }, [carregar])

  const falhas = envios.filter(e => e.status === 'falhou')

  const metrics = useMemo(() => {
    const total = enrollments.length
    const ativos = enrollments.filter(e => e.status === 'ativo').length
    const pausados = enrollments.filter(e => e.status === 'pausado').length
    const concluidos = enrollments.filter(e => e.status === 'concluido').length
    const cancelados = enrollments.filter(e => e.status === 'cancelado').length
    const enviados = envios.filter(e => e.status === 'enviado').length
    const entregues = envios.filter(e => e.entregue_em).length
    const abertos = envios.filter(e => e.aberto_em).length
    const clicados = envios.filter(e => e.clicado_em).length
    const rejeitados = envios.filter(e => e.bounced_em || e.reclamado_em).length
    const pct = (n, d) => d ? Math.round((n / d) * 100) : 0
    return {
      total, ativos, pausados, concluidos, cancelados, enviados, entregues, abertos, clicados, rejeitados,
      taxaAbertura: pct(abertos, enviados), taxaClique: pct(clicados, enviados), taxaRejeicao: pct(rejeitados, enviados),
    }
  }, [enrollments, envios])

  // Funil por etapa da sequência: quantos leads chegaram/abriram/clicaram em cada email,
  // pra ver onde a sequência perde gente (em vez de só uma contagem geral).
  const funilEtapas = useMemo(() => {
    return (automacao.steps || []).map(step => {
      const desteStep = envios.filter(e => e.step_id === step.id)
      return {
        ordem: step.ordem,
        usar_ia: step.usar_ia,
        total: desteStep.length,
        enviados: desteStep.filter(e => e.status === 'enviado').length,
        abertos: desteStep.filter(e => e.aberto_em).length,
        clicados: desteStep.filter(e => e.clicado_em).length,
        falhas: desteStep.filter(e => e.status === 'falhou').length,
        rejeitados: desteStep.filter(e => e.bounced_em || e.reclamado_em).length,
      }
    })
  }, [automacao.steps, envios])

  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca] = useState('')

  const enrollmentsFiltrados = useMemo(() => {
    return enrollments.filter(en => {
      if (filtroStatus !== 'todos' && en.status !== filtroStatus) return false
      if (busca.trim()) {
        const lead = leadById.get(en.lead_id)
        const nome = lead ? leadName(lead) : ''
        if (!nome.toLowerCase().includes(busca.trim().toLowerCase())) return false
      }
      return true
    })
  }, [enrollments, filtroStatus, busca, leadById])

  async function tentarNovamente() {
    if (!falhas.length) return
    const ok = await confirmDialog(
      `Isso vai marcar os ${falhas.length} email(s) que falharam para serem enviados novamente na próxima execução automática (em até 10 min). Útil depois de resolver um problema de crédito/cota da IA ou do provedor de email. Continuar?`,
      { title: 'Tentar novamente', confirmLabel: 'Tentar novamente' }
    )
    if (!ok) return
    setRetrying(true)
    try {
      const agora = new Date().toISOString()
      const idsEnvios = falhas.map(e => e.id)
      const { error } = await supabase.from('email_automation_envios')
        .update({ status: 'pendente', erro: null, scheduled_for: agora })
        .in('id', idsEnvios)
      if (error) throw error
      // Se a falha foi a última pendência do lead, o worker já marcou a matrícula
      // como "concluído" — reabre essas matrículas para o reenvio não ser ignorado.
      const idsEnrollments = [...new Set(falhas.map(e => e.enrollment_id))]
      await supabase.from('email_automation_enrollments').update({ status: 'ativo' }).in('id', idsEnrollments).eq('status', 'concluido')
      notifySuccess(`${falhas.length} email(s) marcado(s) para tentar novamente.`)
      await carregar()
    } catch (e) {
      notifyError('Erro ao tentar novamente: ' + (e.message || e))
    } finally {
      setRetrying(false)
    }
  }

  if (loading) return <div className="email-page-loading" role="status">Carregando campanha...</div>

  return (
    <div className="email-automation-page email-automation-detail">
      <button onClick={onBack} className="email-back-button">
        <IconArrowLeft size={14} color="var(--text2)" /> Voltar
      </button>
      <div className="email-detail-heading">
        <div>
          <span>Desempenho da campanha</span>
          <h2>{automacao.nome}</h2>
          <p>{enrollments.length} lead(s) matriculado(s)</p>
        </div>
        {falhas.length > 0 && (
          <button
            onClick={tentarNovamente}
            disabled={retrying}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #EF4444', background: 'none', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: retrying ? 'default' : 'pointer', opacity: retrying ? 0.6 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            {retrying ? 'Reenviando...' : `Tentar novamente (${falhas.length} falha(s))`}
          </button>
        )}
      </div>

      {enrollments.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Nenhum lead matriculado ainda. Leads novos que baterem com o filtro entram automaticamente.</div>
      ) : (
        <>
          <MetricasResumo metrics={metrics} />
          {funilEtapas.length > 0 && <FunilEtapas etapas={funilEtapas} />}

          <div className="email-enrollment-toolbar">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0, flex: 1 }}>Leads matriculados ({enrollmentsFiltrados.length})</h3>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}>
              <option value="todos">Todos os status</option>
              <option value="ativo">Em andamento</option>
              <option value="pausado">Pausado (respondeu)</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar lead..."
              aria-label="Buscar lead matriculado"
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', width: 180 }}
            />
          </div>

          {enrollmentsFiltrados.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Nenhum lead bate com esse filtro.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {enrollmentsFiltrados.map(en => {
                const lead = leadById.get(en.lead_id)
                const meusEnvios = envios.filter(e => e.enrollment_id === en.id).sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))
                return (
                  <div key={en.id} className="card email-enrollment-card">
                    <div className="email-enrollment-card-heading">
                      {lead ? (
                        <button
                          onClick={() => onOpenLead?.(lead)}
                          style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
                        >
                          {leadName(lead)}
                        </button>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Lead removido</span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                          background: en.status === 'ativo' ? '#fff3cd' : en.status === 'pausado' ? '#dbeafe' : en.status === 'concluido' ? '#d4edda' : 'var(--bg3)',
                          color: en.status === 'ativo' ? '#92740c' : en.status === 'pausado' ? '#1d4ed8' : en.status === 'concluido' ? '#1e7e34' : 'var(--text3)',
                        }}>
                          {en.status === 'ativo' ? 'Em andamento' : en.status === 'pausado' ? 'Pausado (respondeu)' : en.status === 'concluido' ? 'Concluído' : 'Cancelado'}
                        </span>
                        {en.status === 'pausado' && (
                          <button
                            onClick={async () => {
                              await supabase.from('email_automation_enrollments').update({ status: 'ativo' }).eq('id', en.id)
                              await carregar()
                            }}
                            style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
                          >
                            Retomar sequência
                          </button>
                        )}
                      </div>
                    </div>
                    <EnvioStepper
                      envios={meusEnvios}
                      detalheAberto={meusEnvios.some(e => e.id === detalheAberto) ? detalheAberto : null}
                      onToggleDetalhe={id => setDetalheAberto(prev => prev === id ? null : id)}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Dashboard da campanha: métricas + funil por etapa ─────────────────────── */
function MetricasResumo({ metrics: m }) {
  const cards = [
    { label: 'Matriculados', valor: m.total, cor: 'var(--text)' },
    { label: 'Em andamento', valor: m.ativos, cor: '#92740c' },
    { label: 'Concluídos', valor: m.concluidos, cor: '#1e7e34' },
    { label: 'Enviados', valor: m.enviados, cor: 'var(--text)' },
    { label: 'Abertos', valor: m.abertos, sub: `${m.taxaAbertura}% dos enviados`, cor: '#2563EB' },
    { label: 'Clicados', valor: m.clicados, sub: `${m.taxaClique}% dos enviados`, cor: '#7C3AED' },
    { label: 'Rejeitados', valor: m.rejeitados, sub: `${m.taxaRejeicao}% dos enviados · bounce/spam`, cor: '#B91C1C' },
  ]
  return (
    <div className="email-metrics-grid">
      {cards.map(c => (
        <div key={c.label} className="card email-metric-card">
          <span>{c.label}</span>
          <strong style={{ color: c.cor }}>{c.valor}</strong>
          {c.sub && <small>{c.sub}</small>}
        </div>
      ))}
    </div>
  )
}

// Funil de cada email da sequência: quantos chegaram a esse passo, foram
// enviados, abriram, clicaram ou tiveram problema — mostra onde a sequência
// perde gente, em vez de só uma contagem geral da campanha.
function FunilEtapas({ etapas }) {
  return (
    <div className="card email-funnel-card">
      <div className="email-card-title">Funil por email da sequência</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {etapas.map(et => {
          const base = et.total || 1
          const segmentos = [
            { label: 'Enviado', valor: et.enviados, cor: '#10B981' },
            { label: 'Aberto', valor: et.abertos, cor: '#2563EB' },
            { label: 'Clicado', valor: et.clicados, cor: '#7C3AED' },
            { label: 'Falhou', valor: et.falhas, cor: '#EF4444' },
            { label: 'Bounce/Spam', valor: et.rejeitados, cor: '#B91C1C' },
          ]
          return (
            <div key={et.ordem}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Email {et.ordem}{et.usar_ia ? ' (IA)' : ''}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{et.total} agendado(s)</span>
              </div>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg3)', marginBottom: 6 }}>
                {segmentos.filter(s => s.valor > 0).map(s => (
                  <div key={s.label} style={{ width: `${(s.valor / base) * 100}%`, background: s.cor }} title={`${s.label}: ${s.valor}`} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {segmentos.map(s => (
                  <span key={s.label} style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.cor, display: 'inline-block' }} />
                    {s.label}: {s.valor}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Lista ────────────────────────────────────────────────────────────────── */
// O Supabase/PostgREST limita cada select a 1000 linhas por padrão; com
// milhares de matrículas/envios acumulados, isso truncava silenciosamente
// as contagens da lista de campanhas. Pagina em blocos de 1000 até esgotar.
async function fetchAllRows(table, columns, eqFilter) {
  const all = []
  let from = 0
  const pageSize = 1000
  while (true) {
    let query = supabase.from(table).select(columns).range(from, from + pageSize - 1)
    if (eqFilter) query = query.eq(eqFilter[0], eqFilter[1])
    const { data, error } = await query
    if (error || !data?.length) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

const SERIES_CHART = [
  { key: 'enviados',   nome: 'Enviados',   cor: '#2563EB' },
  { key: 'entregues',  nome: 'Entregues',  cor: '#10B981' },
  { key: 'abertos',    nome: 'Abertos',    cor: '#7C3AED' },
  { key: 'rejeitados', nome: 'Rejeitados', cor: '#B91C1C' },
]

function ChartTooltipEmail({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

// Gráfico de volume de emails por dia (estilo "Metrics" do Resend), com filtro por campanha.
function EmailMetricasChart({ chartData, automacoes, chartFiltro, onChangeFiltro }) {
  const theme = useTheme()
  const tickColor = theme === 'dark' ? '#4B5563' : '#9CA3AF'

  return (
    <div className="card email-chart-card">
      <div className="email-chart-heading">
        <div>
          <span>Atividade recente</span>
          <strong>Volume de emails</strong>
          <small>Últimos 15 dias</small>
        </div>
        <select
          value={chartFiltro}
          onChange={e => onChangeFiltro(e.target.value)}
          aria-label="Filtrar gráfico por campanha"
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
        >
          <option value="todas">Todas as campanhas</option>
          {automacoes.map(a => (
            <option key={a.id} value={a.id}>{a.nome}</option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
          <defs>
            {SERIES_CHART.map(s => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.cor} stopOpacity={0.18} />
                <stop offset="95%" stopColor={s.cor} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="dia" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} interval={1} />
          <YAxis hide />
          <Tooltip content={<ChartTooltipEmail />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SERIES_CHART.map(s => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.nome}
              stroke={s.cor}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              dot={false}
              activeDot={{ r: 4, fill: s.cor, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function EmailAutomacoes({ empresas = [], onOpenLead, logAction }) {
  const { confirmDialog, notify, notifyError, notifySuccess } = useDialog()
  const [automacoes, setAutomacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [todosEnvios, setTodosEnvios] = useState([])
  const [chartFiltro, setChartFiltro] = useState('todas')

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
    const enrollCounts = await fetchAllRows('email_automation_enrollments', 'automation_id, status')
    const envioCounts = await fetchAllRows('email_automation_envios', 'automation_id, status, enviado_em, entregue_em, bounced_em, reclamado_em, aberto_em')
    setTodosEnvios(envioCounts || [])
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

  const PERIODO_DIAS = 15
  const chartData = useMemo(() => {
    const envios = chartFiltro === 'todas' ? todosEnvios : todosEnvios.filter(e => e.automation_id === chartFiltro)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    return Array.from({ length: PERIODO_DIAS }, (_, i) => {
      const dia = new Date(hoje)
      dia.setDate(hoje.getDate() - (PERIODO_DIAS - 1 - i))
      const proximoDia = new Date(dia)
      proximoDia.setDate(dia.getDate() + 1)
      const noDia = (iso) => { if (!iso) return false; const d = new Date(iso); return d >= dia && d < proximoDia }
      return {
        dia: `${String(dia.getDate()).padStart(2, '0')}/${String(dia.getMonth() + 1).padStart(2, '0')}`,
        enviados: envios.filter(e => noDia(e.enviado_em)).length,
        entregues: envios.filter(e => noDia(e.entregue_em)).length,
        abertos: envios.filter(e => noDia(e.aberto_em)).length,
        rejeitados: envios.filter(e => noDia(e.bounced_em) || noDia(e.reclamado_em)).length,
      }
    })
  }, [todosEnvios, chartFiltro])

  const [matriculando, setMatriculando] = useState(null) // id da automação rodando "iniciar agora"

  async function iniciarAgora(a) {
    const ok = await confirmDialog(
      `Matricular agora os leads que já existem e batem com o público de "${a.nome}"? Quem já estiver matriculado não é duplicado.`,
      { title: 'Iniciar campanha agora' }
    )
    if (!ok) return
    setMatriculando(a.id)
    try {
      const { data: count, error } = await supabase.rpc('fn_matricular_leads_existentes', { p_automation_id: a.id })
      if (error) throw error
      if (count > 0) {
        logAction?.('atualizar', 'email_automations', a.id, { nome: a.nome, acao_detalhe: 'iniciar_agora', matriculados: count })
        notifySuccess(`${count} novo(s) lead(s) matriculado(s) agora na sequência.`)
      } else {
        notify(`Nenhum lead novo para matricular: todos os leads que batem com o público de "${a.nome}" já estavam matriculados (${a.counts?.total || 0} no total).`)
      }
      fetchAutomacoes()
    } catch (e) {
      notifyError('Erro ao matricular leads: ' + (e.message || e))
    } finally {
      setMatriculando(null)
    }
  }

  async function excluir(a) {
    const ok = await confirmDialog('Excluir esta campanha? Leads já matriculados deixarão de receber os próximos emails da sequência.', { title: 'Excluir campanha', danger: true, confirmLabel: 'Excluir' })
    if (!ok) return
    await supabase.from('email_automations').delete().eq('id', a.id)
    logAction?.('deletar', 'email_automations', a.id, { nome: a.nome })
    fetchAutomacoes()
  }

  async function toggleAtivo(a) {
    await supabase.from('email_automations').update({ ativo: !a.ativo }).eq('id', a.id)
    logAction?.('atualizar', 'email_automations', a.id, { nome: a.nome, ativo: !a.ativo })
    fetchAutomacoes()
  }

  if (showForm) {
    return (
      <AutomacaoForm
        automacao={editando}
        empresas={empresas}
        tagsDisponiveis={tagsDisponiveis}
        cnaesDisponiveis={cnaesDisponiveis}
        logAction={logAction}
        onCancel={() => { setShowForm(false); setEditando(null) }}
        onSaved={(matriculados) => {
          setShowForm(false); setEditando(null); fetchAutomacoes()
          if (matriculados !== null) {
            if (matriculados > 0) notifySuccess(`${matriculados} lead(s) já existente(s) matriculado(s) na sequência.`)
            else notify('Nenhum lead existente bate com o público da campanha por enquanto. Novos leads que baterem com o filtro serão matriculados automaticamente.')
          }
        }}
      />
    )
  }

  if (detalhe) {
    return <AutomacaoDetalhe automacao={detalhe} empresas={empresas} onBack={() => setDetalhe(null)} onOpenLead={onOpenLead} />
  }

  return (
    <div className="email-automation-page email-automation-list">
      <header className="email-automation-hero">
        <div className="email-automation-hero-icon" aria-hidden="true">
          <IconMail size={21} color="var(--accent)" />
        </div>
        <div className="email-automation-hero-copy">
          <span>Relacionamento em escala</span>
          <h1>Email Marketing</h1>
          <p>Crie jornadas automáticas para novos leads ou comece uma sequência com a sua base atual.</p>
        </div>
        <button
          onClick={() => { setEditando(null); setShowForm(true) }}
          className="email-primary-button email-new-campaign"
        >
          <IconPlus size={14} color="#fff" /> Nova campanha
        </button>
      </header>

      {!loading && automacoes.length > 0 && (
        <EmailMetricasChart
          chartData={chartData}
          automacoes={automacoes}
          chartFiltro={chartFiltro}
          onChangeFiltro={setChartFiltro}
        />
      )}

      {loading ? (
        <div className="email-page-loading" role="status">Carregando campanhas...</div>
      ) : automacoes.length === 0 ? (
        <div className="card email-empty-state">
          <div className="email-empty-icon"><IconMail size={24} color="var(--accent)" /></div>
          <strong>Comece sua primeira jornada</strong>
          <span>Nenhuma campanha criada ainda.</span>
          <button onClick={() => { setEditando(null); setShowForm(true) }} className="email-primary-button">
            <IconPlus size={14} color="#fff" /> Criar campanha
          </button>
        </div>
      ) : (
        <div className="email-campaign-list">
          {automacoes.map(a => (
            <article key={a.id} className="card email-campaign-card" onClick={() => setDetalhe(a)}>
              <div className="email-campaign-accent" aria-hidden="true"><IconZap size={15} color="var(--accent)" /></div>
              <div className="email-campaign-content">
                <div className="email-campaign-title-row">
                  <button
                    type="button"
                    className="email-campaign-open"
                    onClick={e => { e.stopPropagation(); setDetalhe(a) }}
                  >
                    {a.nome}
                  </button>
                  <span className={`email-status-pill ${a.ativo ? 'is-active' : 'is-paused'}`}>
                    {a.ativo ? 'Ativa' : 'Pausada'}
                  </span>
                </div>
                <div className="email-campaign-trigger">
                  Quando: {a.triggers.length ? a.triggers.map(gatilhoLabel).join(' OU ') : 'Sem gatilho automático (só via "Iniciar agora")'}
                </div>
                <div className="email-campaign-meta">
                  {a.steps.length} email(s) na sequência
                  {a.leads_manual?.length ? ` · ${a.leads_manual.length} lead(s) específico(s)` : ''}
                  {a.origem_filtro?.length ? ` · origem: ${a.origem_filtro.join(', ')}` : ''}
                  {a.segmento_tags?.length ? ` · tags: ${a.segmento_tags.join(', ')}` : ''}
                  {a.cnae_filtro?.length ? ` · segmento: ${a.cnae_filtro.join(', ')}` : ''}
                </div>
                <div className="email-campaign-stats">
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
              <div className="email-campaign-actions" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => iniciarAgora(a)}
                  disabled={matriculando === a.id}
                  title="Matricular agora os leads existentes que batem com o filtro"
                  className="email-outline-button is-accent"
                >
                  {matriculando === a.id ? 'Matriculando...' : 'Iniciar agora'}
                </button>
                <button onClick={() => toggleAtivo(a)} className="email-outline-button">
                  {a.ativo ? 'Pausar' : 'Ativar'}
                </button>
                <button onClick={() => { setEditando(a); setShowForm(true) }} className="email-outline-button">
                  Editar
                </button>
                <button onClick={() => excluir(a)} className="email-icon-button is-danger" aria-label={`Excluir campanha ${a.nome}`}>
                  <IconTrash size={14} color="var(--text3)" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

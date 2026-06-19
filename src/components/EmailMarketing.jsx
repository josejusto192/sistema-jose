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
function SeletorDestinatarios({ empresas, tagsDisponiveis, selecionados, setSelecionados, contatados }) {
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [tagsFiltro, setTagsFiltro] = useState([])
  const [origemFiltro, setOrigemFiltro] = useState('')
  const [municipioFiltro, setMunicipioFiltro] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const comEmail = useMemo(() => empresas.filter(e => e.email?.includes('@') && !e.email_opt_out), [empresas])

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
              {contatados?.has(e.id) && (
                <span style={{ fontSize: 10, color: '#92740c', background: '#fff3cd', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>
                  Já contatado
                </span>
              )}
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
function NovaCampanhaPage({ empresas, tagsDisponiveis, contatados, onCancel, onSaved }) {
  const [step, setStep] = useState(1)
  const [maxStepAtingido, setMaxStepAtingido] = useState(1)
  const [nome, setNome] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpoHtml, setCorpoHtml] = useState('')
  const [usarIa, setUsarIa] = useState(false)
  const [iaObjetivo, setIaObjetivo] = useState('')
  const [responderPara, setResponderPara] = useState('')
  const [cc, setCc] = useState('')
  const [cco, setCco] = useState('')
  const [agendadoPara, setAgendadoPara] = useState('')
  const [anexos, setAnexos] = useState([])
  const [mostrarOpcoes, setMostrarOpcoes] = useState(false)
  const [selecionados, setSelecionados] = useState([])
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState(null)

  function emailsDeLista(texto) {
    return texto.split(',').map(s => s.trim()).filter(Boolean)
  }

  function addAnexo() {
    setAnexos(prev => [...prev, { filename: '', url: '' }])
  }

  function atualizarAnexo(i, campo, valor) {
    setAnexos(prev => prev.map((a, idx) => idx === i ? { ...a, [campo]: valor } : a))
  }

  function removerAnexo(i) {
    setAnexos(prev => prev.filter((_, idx) => idx !== i))
  }

  const selecionadosLeads = useMemo(() => empresas.filter(e => selecionados.includes(e.id)), [empresas, selecionados])

  function irParaStep(s) {
    setErro(null)
    setStep(s)
    setMaxStepAtingido(prev => Math.max(prev, s))
  }

  function avancar() {
    if (step === 1) {
      if (!nome.trim()) { setErro('Nome da campanha é obrigatório'); return }
      if (usarIa) {
        if (!iaObjetivo.trim()) { setErro('Descreva o objetivo da campanha pra IA'); return }
      } else if (!assunto.trim() || !corpoHtml.trim()) {
        setErro('Assunto e corpo são obrigatórios')
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
      assunto: usarIa ? null : assunto.trim(),
      corpo_html: usarIa ? null : corpoHtml,
      usar_ia: usarIa,
      ia_objetivo: usarIa ? iaObjetivo.trim() : null,
      responder_para: responderPara.trim() || null,
      cc: emailsDeLista(cc),
      cco: emailsDeLista(cco),
      agendado_para: agendadoPara || null,
      anexos: anexos.filter(a => a.url.trim()),
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
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={usarIa} onChange={e => setUsarIa(e.target.checked)} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Gerar email com IA (individual por lead)</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  A IA escreve um assunto e corpo diferentes para cada lead, usando os dados que já temos dele (empresa, sócios, segmento etc). Configure a chave da IA em Configurações &gt; Email.
                </div>
              </div>
            </label>

            {usarIa ? (
              <div>
                <label style={labelStyle}>Objetivo da campanha (o que a IA deve tentar alcançar)</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontSize: 13 }}
                  value={iaObjetivo}
                  onChange={e => setIaObjetivo(e.target.value)}
                  placeholder="Ex: Prospectar escritórios de advocacia oferecendo nosso serviço de gestão de mídias sociais. Quero um tom consultivo, sem parecer spam, terminando com um convite pra uma call rápida."
                />
              </div>
            ) : (
              <>
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
              </>
            )}

            <button
              type="button"
              onClick={() => setMostrarOpcoes(s => !s)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left' }}
            >
              {mostrarOpcoes ? '− Ocultar opções avançadas' : '+ Opções avançadas (responder para, cc/cco, agendamento, anexos)'}
            </button>

            {mostrarOpcoes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg2)' }}>
                <div>
                  <label style={labelStyle}>Responder para (reply-to)</label>
                  <input style={inputStyle} value={responderPara} onChange={e => setResponderPara(e.target.value)} placeholder="ex: vendas@seudominio.com" />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Cc (separados por vírgula)</label>
                    <input style={inputStyle} value={cc} onChange={e => setCc(e.target.value)} placeholder="ex: copia@seudominio.com" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Cco (separados por vírgula)</label>
                    <input style={inputStyle} value={cco} onChange={e => setCco(e.target.value)} placeholder="ex: oculto@seudominio.com" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Agendar envio (opcional)</label>
                  <input
                    type="datetime-local"
                    style={{ ...inputStyle, width: 'auto' }}
                    value={agendadoPara}
                    onChange={e => setAgendadoPara(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    Se preenchido, o Resend entrega no horário marcado — você ainda precisa clicar em "Enviar" na lista de campanhas pra disparar a chamada.
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Anexos (link do arquivo)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {anexos.map((a, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8 }}>
                        <input
                          style={{ ...inputStyle, flex: 1 }}
                          value={a.filename}
                          onChange={e => atualizarAnexo(i, 'filename', e.target.value)}
                          placeholder="nome-do-arquivo.pdf"
                        />
                        <input
                          style={{ ...inputStyle, flex: 2 }}
                          value={a.url}
                          onChange={e => atualizarAnexo(i, 'url', e.target.value)}
                          placeholder="https://..."
                        />
                        <button type="button" onClick={() => removerAnexo(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', display: 'flex' }}>
                          <IconTrash size={14} color="var(--text3)" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addAnexo}
                      style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                    >
                      + Adicionar anexo
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    Informe o link público do arquivo (ex: já hospedado no seu storage) — não é feito upload aqui.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <SeletorDestinatarios
            empresas={empresas}
            tagsDisponiveis={tagsDisponiveis}
            selecionados={selecionados}
            setSelecionados={setSelecionados}
            contatados={contatados}
          />
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Campanha</label>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{nome}</div>
              {!usarIa && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{assunto}</div>}
              {usarIa && <span style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--bg3)', padding: '2px 7px', borderRadius: 20 }}>Gerado por IA</span>}
            </div>
            {usarIa ? (
              <div>
                <label style={labelStyle}>Objetivo passado pra IA</label>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: 'var(--bg2)', fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>
                  {iaObjetivo}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  O assunto e o corpo de cada email serão gerados na hora do envio, um por lead.
                </div>
              </div>
            ) : (
              <div>
                <label style={labelStyle}>Prévia do conteúdo</label>
                <div
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: '#fff', maxHeight: 240, overflowY: 'auto' }}
                  dangerouslySetInnerHTML={{ __html: corpoHtml }}
                />
              </div>
            )}
            {(responderPara || cc || cco || agendadoPara || anexos.some(a => a.url)) && (
              <div>
                <label style={labelStyle}>Opções avançadas</label>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
                  {responderPara && <div>Responder para: {responderPara}</div>}
                  {cc && <div>Cc: {cc}</div>}
                  {cco && <div>Cco: {cco}</div>}
                  {agendadoPara && <div>Agendado para: {new Date(agendadoPara).toLocaleString('pt-BR')}</div>}
                  {anexos.filter(a => a.url).length > 0 && <div>Anexos: {anexos.filter(a => a.url).map(a => a.filename || a.url).join(', ')}</div>}
                </div>
              </div>
            )}
            <div>
              <label style={labelStyle}>Destinatários ({selecionadosLeads.length})</label>
              {selecionadosLeads.some(e => contatados?.has(e.id)) && (
                <div style={{ fontSize: 11, color: '#92740c', marginBottom: 6 }}>
                  Alguns leads selecionados já receberam email de outra campanha antes.
                </div>
              )}
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', background: 'var(--bg2)' }}>
                {selecionadosLeads.map(e => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{leadName(e)}{contatados?.has(e.id) ? ' ⚠' : ''}</span>
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

const ENVIO_STATUS_LABEL = {
  pendente: { label: 'Pendente', bg: 'var(--bg3)', color: 'var(--text2)' },
  enviado:  { label: 'Enviado', bg: '#d4edda', color: '#1e7e34' },
  falhou:   { label: 'Falhou', bg: '#f8d7da', color: '#c0392b' },
}

/* ─── Detalhe da campanha (lista de envios) ───────────────────────────────── */
function CampanhaDetalhe({ campanha, empresas, onBack }) {
  const [envios, setEnvios] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    let ativo = true
    setLoading(true)
    supabase.from('email_campaign_envios').select('*').eq('campaign_id', campanha.id).order('created_at', { ascending: true })
      .then(({ data }) => { if (ativo) { setEnvios(data || []); setLoading(false) } })
    return () => { ativo = false }
  }, [campanha.id])

  const leadById = useMemo(() => {
    const m = {}
    empresas.forEach(e => { m[e.id] = e })
    return m
  }, [empresas])

  const totals = useMemo(() => ({
    total: envios.length,
    enviados: envios.filter(e => e.status === 'enviado').length,
    falhas: envios.filter(e => e.status === 'falhou').length,
    abertos: envios.filter(e => e.aberto_em).length,
    cliques: envios.filter(e => e.clicado_em).length,
    descadastros: envios.filter(e => e.descadastrado_em).length,
  }), [envios])

  const filtrados = useMemo(() => {
    if (filtro === 'aberto') return envios.filter(e => e.aberto_em)
    if (filtro === 'clicado') return envios.filter(e => e.clicado_em)
    if (filtro === 'falhou') return envios.filter(e => e.status === 'falhou')
    if (filtro === 'descadastrou') return envios.filter(e => e.descadastrado_em)
    return envios
  }, [envios, filtro])

  function cardFiltro(key, label, valor, cor) {
    const ativo = filtro === key
    return (
      <button
        onClick={() => setFiltro(ativo ? '' : key)}
        className="card"
        style={{ padding: '12px 18px', textAlign: 'left', cursor: 'pointer', border: ativo ? `1px solid ${cor || 'var(--accent)'}` : undefined, background: ativo ? 'var(--bg2)' : undefined }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: cor || 'var(--text)' }}>{valor}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
      </button>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <IconArrowLeft size={18} color="var(--text3)" />
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{campanha.nome}</h1>
            <StatusBadge status={campanha.status} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{campanha.assunto}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {cardFiltro('', 'Destinatários', totals.total)}
        {cardFiltro('', 'Enviados', totals.enviados, '#1e7e34')}
        {cardFiltro('falhou', 'Falhas', totals.falhas, '#c0392b')}
        {cardFiltro('aberto', 'Aberturas', totals.abertos, '#92740c')}
        {cardFiltro('clicado', 'Cliques', totals.cliques, 'var(--accent)')}
        {cardFiltro('descadastrou', 'Descadastros', totals.descadastros, '#9ca3af')}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Nenhum envio encontrado para esse filtro.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 0.8fr 0.8fr 0.8fr 1.4fr', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>
            <div>Nome</div><div>Email</div><div>Status</div><div>Aberto</div><div>Clicado</div><div>Detalhe</div>
          </div>
          {filtrados.map(e => {
            const lead = leadById[e.lead_id]
            const s = ENVIO_STATUS_LABEL[e.status] || ENVIO_STATUS_LABEL.pendente
            return (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 0.8fr 0.8fr 0.8fr 1.4fr', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead ? leadName(lead) : '—'}</div>
                <div style={{ color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.email}</div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
                </div>
                <div style={{ color: e.aberto_em ? '#1e7e34' : 'var(--text3)' }}>{e.aberto_em ? 'Sim' : '—'}</div>
                <div style={{ color: e.clicado_em ? 'var(--accent)' : 'var(--text3)' }}>{e.clicado_em ? 'Sim' : '—'}</div>
                <div style={{ color: e.erro ? '#c0392b' : '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.erro || (e.descadastrado_em ? 'Descadastrou' : '')}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function EmailMarketing({ empresas = [] }) {
  const [campanhas, setCampanhas] = useState([])
  const [aberturas, setAberturas] = useState({})
  const [contatados, setContatados] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [showNova, setShowNova] = useState(false)
  const [campanhaDetalhe, setCampanhaDetalhe] = useState(null)
  const [enviandoId, setEnviandoId] = useState(null)
  const [erroEnvio, setErroEnvio] = useState(null)
  const [progressoIa, setProgressoIa] = useState(null)

  const tagsDisponiveis = useMemo(() => {
    const set = new Set()
    empresas.forEach(e => (e.tags || []).forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [empresas])

  const fetchCampanhas = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('email_campaigns').select('*').order('created_at', { ascending: false })
    const enviadas = (data || []).filter(c => c.status === 'enviado')
    if (enviadas.length > 0) {
      const { data: envios } = await supabase
        .from('email_campaign_envios')
        .select('campaign_id, aberto_em, clicado_em')
        .in('campaign_id', enviadas.map(c => c.id))
      const stats = {}
      ;(envios || []).forEach(e => {
        const s = stats[e.campaign_id] || (stats[e.campaign_id] = { abertos: 0, cliques: 0 })
        if (e.aberto_em) s.abertos++
        if (e.clicado_em) s.cliques++
      })
      setAberturas(stats)
    }
    if (!error) setCampanhas(data || [])
    setLoading(false)
  }, [])

  const fetchContatados = useCallback(async () => {
    const { data } = await supabase.from('email_campaign_envios').select('lead_id').eq('status', 'enviado').not('lead_id', 'is', null)
    setContatados(new Set((data || []).map(e => e.lead_id)))
  }, [])

  useEffect(() => { fetchCampanhas(); fetchContatados() }, [fetchCampanhas, fetchContatados])

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

  function extrairErro(data, error) {
    return data?.error || error?.message || 'Erro ao enviar campanha'
  }

  async function enviar(campanha) {
    const dest = destinatarios(campanha)
    const aviso = campanha.usar_ia
      ? `Enviar "${campanha.nome}" para ${dest} destinatário(s)? Cada email será gerado individualmente por IA. Essa ação não pode ser desfeita.`
      : `Enviar "${campanha.nome}" para ${dest} destinatário(s)? Essa ação não pode ser desfeita.`
    if (!confirm(aviso)) return
    setEnviandoId(campanha.id)
    setErroEnvio(null)

    if (campanha.usar_ia) {
      setProgressoIa({ processado: 0, total: dest })
      let done = false
      let safety = 0
      while (!done && safety < 500) {
        safety++
        const { data, error } = await supabase.functions.invoke('email-send-ia', { body: { campaign_id: campanha.id } })
        if (error || data?.error) {
          let msg = extrairErro(data, error)
          if (error?.context) {
            try { const errBody = await error.context.json(); if (errBody?.error) msg = errBody.error } catch {}
          }
          setErroEnvio(msg)
          break
        }
        done = data.done
        setProgressoIa({ processado: data.totalProcessados, total: data.total })
        fetchCampanhas()
        if (!done) await new Promise(r => setTimeout(r, 400))
      }
      setProgressoIa(null)
      setEnviandoId(null)
      fetchCampanhas()
      fetchContatados()
      return
    }

    const { data, error } = await supabase.functions.invoke('email-send', { body: { campaign_id: campanha.id } })
    setEnviandoId(null)
    if (error || data?.error) {
      let msg = extrairErro(data, error)
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
          contatados={contatados}
          onCancel={() => setShowNova(false)}
          onSaved={() => { setShowNova(false); fetchCampanhas(); fetchContatados() }}
        />
      </div>
    )
  }

  if (campanhaDetalhe) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <CampanhaDetalhe campanha={campanhaDetalhe} empresas={empresas} onBack={() => setCampanhaDetalhe(null)} />
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
            <div
              key={c.id}
              className="card"
              onClick={() => setCampanhaDetalhe(c)}
              style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.nome}</span>
                  <StatusBadge status={c.status} />
                  {c.usar_ia && <span style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--bg3)', padding: '2px 7px', borderRadius: 20 }}>IA</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{c.usar_ia ? c.ia_objetivo : c.assunto}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {destinatarios(c)} destinatário(s)
                  {(c.status === 'enviado' || c.status === 'enviando') && ` · ${c.total_enviados} enviado(s), ${c.total_falhas} falha(s)`}
                  {c.status === 'enviado' && ` · ${aberturas[c.id]?.abertos || 0} aberto(s), ${aberturas[c.id]?.cliques || 0} clique(s)`}
                  {enviandoId === c.id && progressoIa && ` · gerando e enviando... ${progressoIa.processado}/${progressoIa.total}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                {(c.status === 'rascunho' || (c.status === 'enviando' && c.usar_ia)) && (
                  <button
                    onClick={() => enviar(c)}
                    disabled={enviandoId === c.id}
                    style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: enviandoId === c.id ? 'default' : 'pointer', opacity: enviandoId === c.id ? 0.6 : 1, fontFamily: 'inherit' }}
                  >
                    {enviandoId === c.id ? 'Enviando...' : c.status === 'enviando' ? 'Continuar envio' : 'Enviar'}
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

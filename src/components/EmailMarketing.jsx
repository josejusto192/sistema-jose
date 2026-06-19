import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabase.js'
import { IconPlus, IconTrash, IconX, IconMail, IconTag } from './Icons.jsx'

const STATUS_LABEL = {
  rascunho: { label: 'Rascunho', bg: 'var(--bg3)', color: 'var(--text2)' },
  enviando: { label: 'Enviando...', bg: '#fff3cd', color: '#92740c' },
  enviado:  { label: 'Enviado', bg: '#d4edda', color: '#1e7e34' },
  erro:     { label: 'Erro', bg: '#f8d7da', color: '#c0392b' },
}

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

function NovaCampanhaModal({ tagsDisponiveis, onClose, onSaved }) {
  const [nome, setNome] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpoHtml, setCorpoHtml] = useState('')
  const [tagsSelecionadas, setTagsSelecionadas] = useState([])
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState(null)

  function toggleTag(tag) {
    setTagsSelecionadas(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  async function salvar() {
    if (!nome.trim() || !assunto.trim() || !corpoHtml.trim()) {
      setErro('Nome, assunto e corpo são obrigatórios')
      return
    }
    setSaving(true)
    setErro(null)
    const { error } = await supabase.from('email_campaigns').insert({
      nome: nome.trim(),
      assunto: assunto.trim(),
      corpo_html: corpoHtml,
      segmento_tags: tagsSelecionadas.length ? tagsSelecionadas : null,
    })
    setSaving(false)
    if (error) { setErro(error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg1)', borderRadius: 12, padding: 24, width: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Nova campanha</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <IconX size={18} color="var(--text3)" />
          </button>
        </div>

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
              style={{ ...inputStyle, minHeight: 200, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
              value={corpoHtml}
              onChange={e => setCorpoHtml(e.target.value)}
              placeholder={'<p>Olá {{nome}},</p>\n<p>Texto da sua campanha aqui...</p>'}
            />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              Variáveis disponíveis: <code>{'{{nome}}'}</code>, <code>{'{{empresa}}'}</code>, <code>{'{{email}}'}</code>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Segmento (tags) — vazio envia para todos os leads com email</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tagsDisponiveis.length === 0 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhuma tag cadastrada nos leads ainda</span>}
              {tagsDisponiveis.map(tag => {
                const ativo = tagsSelecionadas.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20,
                      border: '1px solid var(--border)', background: ativo ? 'var(--accent)' : 'var(--bg3)',
                      color: ativo ? '#fff' : 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <IconTag size={11} color={ativo ? '#fff' : 'var(--text3)'} /> {tag}
                  </button>
                )
              })}
            </div>
          </div>

          {erro && <div style={{ fontSize: 12, color: '#c0392b' }}>{erro}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={saving}
              style={{ padding: '9px 18px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit' }}
            >
              {saving ? 'Salvando...' : 'Salvar como rascunho'}
            </button>
          </div>
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

  function destinatariosEstimados(campanha) {
    if (!campanha.segmento_tags?.length) return empresas.filter(e => e.email?.includes('@')).length
    return empresas.filter(e => e.email?.includes('@') && (e.tags || []).some(t => campanha.segmento_tags.includes(t))).length
  }

  async function excluir(id) {
    if (!confirm('Excluir esta campanha?')) return
    await supabase.from('email_campaigns').delete().eq('id', id)
    fetchCampanhas()
  }

  async function enviar(campanha) {
    const dest = destinatariosEstimados(campanha)
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
                  {c.segmento_tags?.length ? `Tags: ${c.segmento_tags.join(', ')}` : 'Todos os leads com email'}
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

      {showNova && (
        <NovaCampanhaModal
          tagsDisponiveis={tagsDisponiveis}
          onClose={() => setShowNova(false)}
          onSaved={() => { setShowNova(false); fetchCampanhas() }}
        />
      )}
    </div>
  )
}

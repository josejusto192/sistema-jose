import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'

const TIPO_LABELS = {
  briefing: 'Briefing',
  campanha: 'Campanha',
  pesquisa: 'Pesquisa de Satisfação',
  captacao: 'Captação',
  geral: 'Formulário',
}

function FieldInput({ campo, value, onChange }) {
  const base = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1.5px solid #D9DFE9', background: '#fff',
    fontSize: 14, color: '#0E0F10', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  }

  if (campo.tipo === 'textarea') return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={campo.placeholder || ''}
      required={campo.obrigatorio}
      rows={4}
      style={{ ...base, resize: 'vertical' }}
    />
  )

  if (campo.tipo === 'select') return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      required={campo.obrigatorio}
      style={{ ...base, cursor: 'pointer' }}
    >
      <option value="">Selecione...</option>
      {(campo.opcoes || []).map((op, i) => <option key={i} value={op}>{op}</option>)}
    </select>
  )

  if (campo.tipo === 'radio') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
      {(campo.opcoes || []).map((op, i) => (
        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
          <input
            type="radio"
            name={campo.id}
            value={op}
            checked={value === op}
            onChange={() => onChange(op)}
            required={campo.obrigatorio && !value}
            style={{ accentColor: '#F05B17', width: 16, height: 16 }}
          />
          {op}
        </label>
      ))}
    </div>
  )

  if (campo.tipo === 'checkbox') {
    const selected = value || []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        {(campo.opcoes || []).map((op, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
            <input
              type="checkbox"
              checked={selected.includes(op)}
              onChange={e => {
                if (e.target.checked) onChange([...selected, op])
                else onChange(selected.filter(s => s !== op))
              }}
              style={{ accentColor: '#F05B17', width: 16, height: 16 }}
            />
            {op}
          </label>
        ))}
      </div>
    )
  }

  const typeMap = { email: 'email', telefone: 'tel', numero: 'number', data: 'date', texto: 'text' }
  return (
    <input
      type={typeMap[campo.tipo] || 'text'}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={campo.placeholder || ''}
      required={campo.obrigatorio}
      style={base}
    />
  )
}

export default function FormPublico({ formId }) {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [respostas, setRespostas] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('formularios')
        .select('*')
        .eq('id', formId)
        .eq('ativo', true)
        .single()
      if (error || !data) setErro('Formulário não encontrado ou inativo.')
      else setForm(data)
      setLoading(false)
    }
    load()
  }, [formId])

  async function handleSubmit(e) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    const { error } = await supabase
      .from('formulario_respostas')
      .insert({ formulario_id: formId, respostas })
    if (error) {
      setErro('Erro ao enviar. Tente novamente.')
      setEnviando(false)
    } else {
      setEnviado(true)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA', fontFamily: "'Funnel Sans', sans-serif" }}>
      <div style={{ color: '#64748B', fontSize: 14 }}>Carregando...</div>
    </div>
  )

  if (erro && !form) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA', fontFamily: "'Funnel Sans', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#0E0F10', marginBottom: 8 }}>Formulário não encontrado</div>
        <div style={{ fontSize: 13, color: '#64748B' }}>O link pode estar incorreto ou o formulário foi desativado.</div>
      </div>
    </div>
  )

  if (enviado) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA', fontFamily: "'Funnel Sans', sans-serif" }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#0E0F10', marginBottom: 10 }}>Resposta enviada!</div>
        <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6 }}>Obrigado por preencher o formulário. Suas respostas foram registradas com sucesso.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: "'Funnel Sans', sans-serif", padding: '40px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: '#F05B17', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {TIPO_LABELS[form.tipo] || 'Formulário'}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0E0F10', margin: '0 0 8px', letterSpacing: '-0.5px' }}>{form.titulo}</h1>
        {form.descricao && (
          <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7, margin: '0 0 32px' }}>{form.descricao}</p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {(form.campos || []).map(campo => (
              <div key={campo.id}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  {campo.label}
                  {campo.obrigatorio && <span style={{ color: '#F05B17', marginLeft: 3 }}>*</span>}
                </label>
                <FieldInput
                  campo={campo}
                  value={respostas[campo.id]}
                  onChange={val => setRespostas(r => ({ ...r, [campo.id]: val }))}
                />
              </div>
            ))}
          </div>

          {erro && (
            <div style={{ marginTop: 20, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            style={{
              marginTop: 32, width: '100%', padding: '14px', borderRadius: 10, border: 'none',
              background: enviando ? '#EF713A' : '#F05B17', color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: enviando ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background 0.15s',
            }}
          >
            {enviando ? 'Enviando...' : 'Enviar respostas'}
          </button>
        </form>

        <div style={{ marginTop: 40, textAlign: 'center', fontSize: 11, color: '#C2CAD8' }}>
          Powered by Justo Mídias CRM
        </div>
      </div>
    </div>
  )
}

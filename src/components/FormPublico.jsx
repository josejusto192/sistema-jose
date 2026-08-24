import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'
import '../styles/public-form.css'

const TIPO_LABELS = {
  briefing: 'Briefing',
  campanha: 'Campanha',
  pesquisa: 'Pesquisa de Satisfação',
  captacao: 'Captação',
  geral: 'Formulário',
}

function FieldInput({ campo, value, onChange, inputId, labelId }) {
  if (campo.tipo === 'textarea') return (
    <textarea
      id={inputId}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={campo.placeholder || ''}
      required={campo.obrigatorio}
      rows={4}
      className="public-field-control"
    />
  )

  if (campo.tipo === 'select') return (
    <select
      id={inputId}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      required={campo.obrigatorio}
      className="public-field-control"
    >
      <option value="">Selecione...</option>
      {(campo.opcoes || []).map((op, i) => <option key={i} value={op}>{op}</option>)}
    </select>
  )

  if (campo.tipo === 'radio') return (
    <div className="public-choice-list" role="radiogroup" aria-labelledby={labelId}>
      {(campo.opcoes || []).map((op, i) => (
        <label key={i} className="public-choice">
          <input
            id={`${inputId}-${i}`}
            type="radio"
            name={campo.id}
            value={op}
            checked={value === op}
            onChange={() => onChange(op)}
            required={campo.obrigatorio && !value}
          />
          {op}
        </label>
      ))}
    </div>
  )

  if (campo.tipo === 'checkbox') {
    const selected = value || []
    return (
      <div className="public-choice-list" role="group" aria-labelledby={labelId}>
        {(campo.opcoes || []).map((op, i) => (
          <label key={i} className="public-choice">
            <input
              id={`${inputId}-${i}`}
              type="checkbox"
              checked={selected.includes(op)}
              onChange={e => {
                if (e.target.checked) onChange([...selected, op])
                else onChange(selected.filter(s => s !== op))
              }}
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
      id={inputId}
      type={typeMap[campo.tipo] || 'text'}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={campo.placeholder || ''}
      required={campo.obrigatorio}
      className="public-field-control"
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
    <div className="public-form-page public-form-state">
      <span className="public-form-loader" aria-hidden="true" />
      <div>Carregando formulário...</div>
    </div>
  )

  if (erro && !form) return (
    <div className="public-form-page public-form-state">
      <div className="public-state-card">
        <div className="public-state-icon" aria-hidden="true">⌕</div>
        <h1>Formulário não encontrado</h1>
        <p>O link pode estar incorreto ou o formulário foi desativado.</p>
      </div>
    </div>
  )

  if (enviado) return (
    <div className="public-form-page public-form-state">
      <div className="public-state-card">
        <div className="public-state-icon is-success" aria-hidden="true">✓</div>
        <h1>Resposta enviada!</h1>
        <p>Obrigado por preencher o formulário. Suas respostas foram registradas com sucesso.</p>
      </div>
    </div>
  )

  return (
    <main className="public-form-page">
      <div className="public-form-container">
        <div className="public-form-brand">
          <img src="/icone.svg" alt="Justo Mídias" />
          <span>Justo Mídias</span>
        </div>
        {/* Header */}
        <div className="public-form-eyebrow">
          {TIPO_LABELS[form.tipo] || 'Formulário'}
        </div>
        <h1 className="public-form-title">{form.titulo}</h1>
        {form.descricao && (
          <p className="public-form-description">{form.descricao}</p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="public-form-card">
          <div className="public-form-fields">
            {(form.campos || []).map(campo => {
              const inputId = `public-field-${campo.id}`
              const labelId = `${inputId}-label`
              const isChoice = campo.tipo === 'radio' || campo.tipo === 'checkbox'
              const labelContent = (
                <>
                  {campo.label}
                  {campo.obrigatorio && <span aria-hidden="true">*</span>}
                </>
              )

              return (
                <div key={campo.id} className="public-form-field">
                  {isChoice
                    ? <div id={labelId} className="public-field-label">{labelContent}</div>
                    : <label id={labelId} className="public-field-label" htmlFor={inputId}>{labelContent}</label>}
                  <FieldInput
                    campo={campo}
                    value={respostas[campo.id]}
                    onChange={val => setRespostas(r => ({ ...r, [campo.id]: val }))}
                    inputId={inputId}
                    labelId={labelId}
                  />
                </div>
              )
            })}
          </div>

          {erro && (
            <div className="public-form-error" role="alert">
              {erro}
            </div>
          )}

          <button type="submit" disabled={enviando} className="public-form-submit">
            <span>{enviando ? 'Enviando...' : 'Enviar respostas'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className="public-form-footer">
          Enviado com segurança por Justo Mídias CRM
        </div>
      </div>
    </main>
  )
}

import React, { useState, useMemo } from 'react'
import { STATUS_CONFIG, leadName } from '../constants.js'
import { IconSearch, IconCheck, IconTag } from './Icons.jsx'
import CnaeFilter from './CnaeFilter.jsx'

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

// Seletor de leads específicos: busca/filtra como na tela de Leads e o usuário
// vê exatamente quem vai entrar antes de salvar — guarda os lead_ids escolhidos,
// não um filtro solto que pode mudar quem bate depois.
export default function SeletorDestinatarios({ empresas, tagsDisponiveis, cnaesDisponiveis, selecionados, setSelecionados, contatados }) {
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [tagsFiltro, setTagsFiltro] = useState([])
  const [origemFiltro, setOrigemFiltro] = useState('')
  const [municipioFiltro, setMunicipioFiltro] = useState('')
  const [cnaeFiltro, setCnaeFiltro] = useState([])
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
      if (cnaeFiltro.length && !cnaeFiltro.includes(e.cnae_principal_descricao)) return false
      if (dataInicio && (!e.criado_em || new Date(e.criado_em) < new Date(dataInicio))) return false
      if (dataFim && (!e.criado_em || new Date(e.criado_em) > new Date(`${dataFim}T23:59:59`))) return false
      if (q && !(leadName(e).toLowerCase().includes(q) || e.email.toLowerCase().includes(q))) return false
      return true
    })
  }, [comEmail, busca, statusFiltro, tagsFiltro, origemFiltro, municipioFiltro, cnaeFiltro, dataInicio, dataFim])

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
        <CnaeFilter allCnaes={cnaesDisponiveis} cnaeFilter={cnaeFiltro} setCnaeFilter={setCnaeFiltro} />
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

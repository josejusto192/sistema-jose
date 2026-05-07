import React, { useState } from 'react'
import { STATUS_CONFIG, CANAL_CONFIG } from '../constants.js'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../supabase.js'

function Field({ label, value, mono }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'var(--font-mono)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)' }}>{value}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>{title}</div>
      {children}
    </div>
  )
}

export default function LeadDetail({ lead, onBack, onUpdate }) {
  const [status, setStatus] = useState(lead.status_prospeccao || 'novo')
  const [canal, setCanal] = useState(lead.canal_envio || '')
  const [obs, setObs] = useState(lead.observacoes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nota, setNota] = useState('')
  const [notas, setNotas] = useState(() => {
    try { return JSON.parse(lead.observacoes_json || '[]') } catch { return [] }
  })

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.novo

  async function save() {
    setSaving(true)
    const updates = {
      status_prospeccao: status,
      canal_envio: canal,
      observacoes: obs,
    }
    if (status !== lead.status_prospeccao && !lead.data_envio) {
      updates.data_envio = new Date().toISOString()
    }
    await onUpdate(lead.id, updates)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addNota() {
    if (!nota.trim()) return
    const nova = { texto: nota, data: new Date().toISOString() }
    const updated = [...notas, nova]
    setNotas(updated)
    setNota('')
    onUpdate(lead.id, { observacoes_json: JSON.stringify(updated) })
  }

  const cnpjFormatado = lead.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  const telefoneLink = lead.telefone ? `https://wa.me/55${lead.telefone.replace(/\D/g, '')}` : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Voltar para leads
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lead.nome_fantasia || lead.razao_social}
            </h1>
            {lead.nome_fantasia && (
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{lead.razao_social}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
                {cfg.label}
              </span>
              {lead.eh_mei && <span className="badge" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>MEI</span>}
              {lead.optante_simples && <span className="badge" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>Simples Nacional</span>}
              {lead.matriz_filial && <span className="badge" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>{lead.matriz_filial}</span>}
            </div>
          </div>

          {/* Ações rápidas de contato */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {lead.telefone && (
              <a
                href={telefoneLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  background: '#0d2e20', border: '1px solid var(--green)', borderRadius: 8,
                  color: 'var(--green)', fontSize: 12, fontWeight: 500, textDecoration: 'none',
                }}
              >
                📱 WhatsApp
              </a>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8,
                  color: 'var(--text2)', fontSize: 12, textDecoration: 'none',
                }}
              >
                📧 E-mail
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, flex: 1 }}>
        {/* Coluna esquerda */}
        <div>
          {/* Dados da empresa */}
          <Section title="Dados cadastrais">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Field label="CNPJ" value={cnpjFormatado} mono />
              <Field label="CNPJ Raiz" value={lead.cnpj_raiz} mono />
              <Field label="Natureza jurídica" value={lead.natureza_juridica_descricao} />
              <Field label="Porte" value={lead.porte_descricao} />
              <Field label="Data de abertura" value={lead.data_abertura ? format(new Date(lead.data_abertura), 'dd/MM/yyyy') : null} />
              <Field label="Situação" value={lead.situacao_cadastral} />
              <Field label="Capital social" value={lead.capital_social ? `R$ ${Number(lead.capital_social).toLocaleString('pt-BR')}` : null} />
              <Field label="Captado em" value={lead.criado_em ? format(new Date(lead.criado_em), "dd/MM/yyyy 'às' HH:mm") : null} />
            </div>
          </Section>

          {/* Atividade */}
          <Section title="Atividade econômica">
            <Field label="CNAE Principal" value={lead.cnae_principal_descricao ? `${lead.cnae_principal_codigo} — ${lead.cnae_principal_descricao}` : null} />
            {lead.cnaes_secundarios?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>CNAEs secundários</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {lead.cnaes_secundarios.slice(0, 5).map((c, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text3)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>{c.codigo}</span> — {c.descricao}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Endereço */}
          <Section title="Localização">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Field label="Logradouro" value={[lead.tipo_logradouro, lead.logradouro, lead.numero].filter(Boolean).join(' ')} />
              <Field label="Bairro" value={lead.bairro} />
              <Field label="Município" value={lead.municipio} />
              <Field label="UF" value={lead.uf} />
              <Field label="CEP" value={lead.cep} mono />
            </div>
            {lead.latitude && lead.longitude && (
              <a
                href={`https://maps.google.com/?q=${lead.latitude},${lead.longitude}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
              >
                📍 Ver no Maps
              </a>
            )}
          </Section>

          {/* Contato */}
          <Section title="Contato">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Field label="E-mail" value={lead.email} />
              <Field label="Válido" value={lead.email_valido != null ? (lead.email_valido ? 'Sim ✓' : 'Não ✗') : null} />
              <Field label="Telefone" value={lead.telefone} mono />
              <Field label="DDD / Tipo" value={lead.telefone_ddd ? `${lead.telefone_ddd} · ${lead.telefone_tipo || ''}` : null} />
            </div>
          </Section>

          {/* Sócios */}
          {lead.quadro_societario?.length > 0 && (
            <Section title={`Quadro societário (${lead.quadro_societario.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lead.quadro_societario.map((s, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{s.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.qualificacao_socio} · {s.faixa_etaria_descricao}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', flexShrink: 0 }}>
                      {s.data_entrada_sociedade ? format(new Date(s.data_entrada_sociedade), 'dd/MM/yyyy') : ''}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Coluna direita — CRM */}
        <div>
          {/* Controle de prospecção */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 12, position: 'sticky', top: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              CRM
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', background: cfg.bg,
                  border: `1px solid ${cfg.color}40`, borderRadius: 8,
                  color: cfg.color, fontSize: 13, outline: 'none', cursor: 'pointer',
                }}
              >
                {Object.entries(STATUS_CONFIG).map(([key, c]) => (
                  <option key={key} value={key} style={{ background: 'var(--bg2)', color: 'var(--text)' }}>{c.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Canal de contato</label>
              <select
                value={canal}
                onChange={e => setCanal(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', background: 'var(--bg3)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--text2)', fontSize: 13, outline: 'none',
                }}
              >
                <option value="">Selecionar canal</option>
                {Object.entries(CANAL_CONFIG).map(([key, c]) => (
                  <option key={key} value={key}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Observações</label>
              <textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                rows={4}
                placeholder="Notas sobre este lead..."
                style={{
                  width: '100%', padding: '8px 10px', background: 'var(--bg3)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--text2)', fontSize: 12, outline: 'none', resize: 'vertical',
                  lineHeight: 1.5,
                }}
              />
            </div>

            <button
              onClick={save}
              disabled={saving}
              style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                background: saved ? 'var(--green-bg)' : 'var(--accent)', color: saved ? 'var(--green)' : '#fff',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
                border: saved ? '1px solid var(--green)' : 'none',
              }}
            >
              {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar alterações'}
            </button>

            {/* Info de envio */}
            {lead.data_envio && (
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                Contatado em {format(new Date(lead.data_envio), 'dd/MM/yyyy')}
              </div>
            )}
          </div>

          {/* Timeline de notas */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              Histórico / Notas
            </div>

            {notas.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>Nenhuma nota ainda</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {notas.map((n, i) => (
                <div key={i} style={{ padding: '8px 10px', background: 'var(--bg3)', borderRadius: 8, borderLeft: '2px solid var(--accent)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                    {format(new Date(n.data), "dd/MM 'às' HH:mm")}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{n.texto}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={nota}
                onChange={e => setNota(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNota()}
                placeholder="Adicionar nota..."
                style={{
                  flex: 1, padding: '7px 10px', background: 'var(--bg3)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--text)', fontSize: 12, outline: 'none',
                }}
              />
              <button
                onClick={addNota}
                style={{ padding: '7px 12px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

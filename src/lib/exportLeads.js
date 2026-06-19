import * as XLSX from 'xlsx'
import { STATUS_CONFIG, leadName } from '../constants.js'

// Colunas exportadas — nomes amigáveis em vez dos nomes técnicos das colunas
// do banco, pra abrir bem tanto no Excel quanto no Google Sheets.
function leadToRow(e) {
  return {
    Nome: leadName(e),
    'Razão Social': e.razao_social || '',
    'Nome Fantasia': e.nome_fantasia || '',
    Telefone: e.telefone || '',
    Email: e.email || '',
    Status: STATUS_CONFIG[e.status_prospeccao]?.label || e.status_prospeccao || '',
    Tags: (e.tags || []).join(', '),
    Vendedor: e.vendedor_nome || '',
    Município: e.municipio || '',
    'Data de Abertura': e.data_abertura || '',
    'Criado em': e.criado_em ? new Date(e.criado_em).toLocaleDateString('pt-BR') : '',
  }
}

export function exportLeads(leads, format = 'xlsx') {
  const rows = leads.map(leadToRow)
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Leads')
  const data = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `leads-${data}.${format}`, { bookType: format })
}

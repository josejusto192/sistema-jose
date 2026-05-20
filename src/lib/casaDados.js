export const API_KEY          = import.meta.env.VITE_CASA_DADOS_KEY
export const API_BUSCA_URL    = 'https://api.casadosdados.com.br/v5/cnpj/pesquisa'
export const API_CONSULTA_URL = 'https://api.casadosdados.com.br/v4/cnpj'

export async function consultarCnpj(cnpj) {
  const raw = (cnpj || '').replace(/\D/g, '')
  if (!API_KEY) throw new Error('VITE_CASA_DADOS_KEY não configurada')
  const res = await fetch(`${API_CONSULTA_URL}/${raw}`, {
    headers: { 'api-key': API_KEY },
  })
  if (!res.ok) throw new Error(`Erro ${res.status}`)
  return res.json()
}

export function mapCnpjToLead(item) {
  const sit     = item.situacao_cadastral?.situacao_atual || item.situacao_cadastral?.situacao_cadastral || null
  const abertura = item.data_abertura ? item.data_abertura.slice(0, 10) : null
  const email    = item.contato_email?.[0]?.email || null
  const telefone = item.contato_telefonico?.[0]?.completo || null
  return {
    razao_social:             item.razao_social               || null,
    nome_fantasia:            item.nome_fantasia              || null,
    municipio:                item.endereco?.municipio        || null,
    uf:                       item.endereco?.uf               || null,
    email,
    telefone,
    cnae_principal_codigo:    item.atividade_principal?.codigo    || null,
    cnae_principal_descricao: item.atividade_principal?.descricao || null,
    porte_descricao:          item.porte_empresa?.descricao   || null,
    eh_mei:                   item.mei?.optante               || false,
    capital_social:           item.capital_social             || null,
    data_abertura:            abertura,
    situacao_cadastral:       sit,
    matriz_filial:            item.matriz_filial              || null,
    cnpj_raiz:                item.cnpj_raiz                  || null,
  }
}

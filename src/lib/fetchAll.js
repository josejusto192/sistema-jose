import { supabase } from '../supabase.js'

// O Supabase/PostgREST limita cada select a 1000 linhas por padrão. Tabelas
// que crescem (leads, envios de campanha etc.) precisam paginar com .range()
// para não ter os dados silenciosamente truncados.
export async function fetchAllRows(table, columns = '*', build) {
  const all = []
  let from = 0
  const pageSize = 1000
  while (true) {
    let query = supabase.from(table).select(columns).range(from, from + pageSize - 1)
    if (build) query = build(query)
    const { data, error } = await query
    if (error || !data?.length) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

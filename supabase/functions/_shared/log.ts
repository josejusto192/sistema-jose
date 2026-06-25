// Helper de log de atividades para uso em edge functions (que não têm um
// usuário logado disparando a ação — é "Sistema" ou um nome de origem
// específico, ex.: "Webhook Casa dos Dados"). Mesma tabela `logs` usada
// pelo logAction do front-end (src/App.jsx), só que sem usuario_id.
export async function registrarLog(
  db: any,
  { acao, tabela, registroId, detalhes, usuarioNome = 'Sistema' }: {
    acao: string
    tabela: string
    registroId?: string | null
    detalhes?: Record<string, unknown>
    usuarioNome?: string
  }
) {
  try {
    await db.from('logs').insert({
      acao,
      tabela,
      registro_id: registroId ?? null,
      detalhes: detalhes ?? null,
      usuario_nome: usuarioNome,
    })
  } catch (err) {
    console.error('registrarLog: erro ao inserir log', err)
  }
}

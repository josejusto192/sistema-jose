// Configuração padrão (fallback). O usuário pode sobrescrever tudo isso
// na própria extensão, na tela "Configurações" do popup — sem editar código.
// Os valores definitivos são carregados de chrome.storage.local (chave
// "justo_crm_config") por background.js.

const DEFAULT_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  GEMINI_API_KEY: '',
  GEMINI_MODEL: 'gemini-2.0-flash',
  APP_URL: 'https://sistema.josejusto.com.br',
}

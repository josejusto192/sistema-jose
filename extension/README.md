# Justo CRM — Extensão de Prospecção (WhatsApp Web)

Extensão para Chrome/Edge que injeta um painel lateral no WhatsApp Web,
permitindo:

- Ver se o número da conversa já é um lead no Justo CRM
- Criar um lead diretamente do WhatsApp
- Atualizar o status de prospecção (salva em `leads` + `status_history`)
- Gerar mensagens de abordagem personalizadas com Gemini e inserir no campo de mensagem

## 1. Configuração

Edite o arquivo `config.js`:

```js
const CONFIG = {
  SUPABASE_URL:      'https://SEU_PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'SUA_ANON_KEY',
  GEMINI_API_KEY:    'SUA_GEMINI_API_KEY',
  GEMINI_MODEL:      'gemini-2.0-flash',
  APP_URL: 'https://SEU_DOMINIO_DO_SISTEMA',
}
```

- `SUPABASE_URL` e `SUPABASE_ANON_KEY`: os mesmos valores usados em `src/supabase.js` do sistema principal (são públicos, protegidos por RLS).
- `GEMINI_API_KEY`: gere em https://aistudio.google.com/app/apikey (gratuito).

## 2. Instalação (modo desenvolvedor)

1. Abra `chrome://extensions`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `extension/`

## 3. Uso

1. Clique no ícone da extensão na barra do navegador e faça **login** com sua conta do Justo CRM (mesmo e-mail/senha do sistema).
2. Abra o **WhatsApp Web** (`web.whatsapp.com`).
3. Um botão laranja "Justo CRM" aparece no canto superior direito — clique para abrir/fechar o painel.
4. Ao abrir uma conversa, o painel mostra:
   - Se o número já é um lead → empresa, vendedor responsável e seletor de status
   - Se não é → campo para criar o lead com um clique
5. Use **"Gerar mensagem"** para criar uma abordagem personalizada com IA e **"Inserir no WhatsApp"** para colocá-la direto no campo de digitação.

## Como funciona o casamento de números

O WhatsApp fornece o número no formato `55DDDNNNNNNNNN@c.us`. A extensão
normaliza esse número e o telefone cadastrado no CRM para o formato
**DDD + 8 dígitos** (removendo o 9º dígito do celular, DDI, zeros, etc.),
e compara os últimos 8 dígitos. Isso resolve a maioria das divergências de
formatação entre o WhatsApp e o cadastro manual.

## Limitações conhecidas / próximos passos

- A extração do número ativo depende da estrutura do DOM do WhatsApp Web,
  que muda com frequência — se parar de detectar o chat, pode ser necessário
  ajustar os seletores em `content.js` (`extractActiveChat`).
- A busca de lead usa `ilike` nos últimos 8 dígitos do campo `telefone`; se
  houver múltiplos leads com o mesmo final de número, retorna o primeiro.
- Templates/formulários de envio rápido ainda não implementados (próxima fase).
- Registro automático de "última interação" (timestamp da conversa) ainda não implementado.

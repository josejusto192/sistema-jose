# Justo Mídias CRM — Extensão de Prospecção (WhatsApp Web)

Extensão para Chrome/Edge que injeta um painel lateral no WhatsApp Web,
permitindo:

- Ver se o número da conversa já é um lead no Justo Mídias CRM
- Criar um lead diretamente do WhatsApp
- Atualizar o status de prospecção (salva em `leads` + `status_history`)
- Gerar mensagens de abordagem personalizadas com IA (Gemini) e inserir no campo de mensagem

## 1. Instalação (modo desenvolvedor)

Não é necessário editar nenhum arquivo de configuração — a extensão se
conecta automaticamente ao sistema.

1. Baixe a extensão pela tela **Configurações → Extensão** do sistema (botão
   "Baixar extensão") ou use a pasta `extension/` deste repositório.
2. Se baixou o `.zip`, extraia em uma pasta no seu computador.
3. Abra `chrome://extensions`
4. Ative o **Modo do desenvolvedor** (canto superior direito)
5. Clique em **Carregar sem compactação**
6. Selecione a pasta extraída (ou `extension/`)

## 2. Uso

1. Clique no ícone da extensão na barra do navegador e faça **login** com sua conta do Justo Mídias CRM (mesmo e-mail/senha do sistema).
   - No primeiro login, a extensão busca automaticamente `SUPABASE_URL`/`SUPABASE_ANON_KEY`
     em `https://sistema.josejusto.com.br/justo-crm-config.json` (gerado no build do sistema) e os salva localmente.
2. Abra o **WhatsApp Web** (`web.whatsapp.com`).
3. Um botão laranja "Justo CRM" aparece no canto superior direito — clique para abrir/fechar o painel.
4. Ao abrir uma conversa, o painel mostra:
   - Se o número já é um lead → empresa, vendedor responsável e seletor de status
   - Se não é → campo para criar o lead com um clique
5. Use **"Gerar mensagem"** para criar uma abordagem personalizada com IA e **"Inserir no WhatsApp"** para colocá-la direto no campo de digitação.

## Como funciona a geração de mensagens com IA

A extensão chama a Edge Function `generate-message` do Supabase (autenticada
com o token de login do usuário), que por sua vez chama a API do Gemini.
A chave do Gemini fica apenas no Supabase, como secret da função — nunca na
extensão. Para configurar (uma única vez, feito pelo administrador do sistema):

```
supabase secrets set GEMINI_API_KEY=sua_chave --project-ref prilivwxekihepvdeass
supabase functions deploy generate-message --project-ref prilivwxekihepvdeass
```

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

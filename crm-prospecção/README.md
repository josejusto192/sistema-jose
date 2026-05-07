# CRM Prospecção — José Justo

Dashboard CRM para gestão de leads de empresas recém-abertas, captadas via webhook do Casa dos Dados.

## Setup

1. Clone o repositório
2. Copie o arquivo de ambiente:
   ```
   cp .env.example .env
   ```
3. Preencha no `.env`:
   - `VITE_SUPABASE_URL` — URL do seu projeto Supabase
   - `VITE_SUPABASE_ANON_KEY` — Anon key do Supabase

4. Instale e rode:
   ```
   npm install
   npm run dev
   ```

## Build para produção

```
npm run build
```
A pasta `dist/` gerada pode ser servida por qualquer servidor estático.

## Deploy no Coolify

1. Suba o projeto no GitHub
2. No Coolify, crie um novo serviço → **Static Site**
3. Aponte para o repositório
4. Build command: `npm run build`
5. Output directory: `dist`
6. Adicione as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Funcionalidades

- **Dashboard** — métricas em tempo real, gráficos de leads por dia/UF/segmento/status
- **Lista de leads** — busca, filtro por status, atualização rápida de status inline
- **Detalhe do lead** — todos os dados da empresa, CRM com status/canal/observações, histórico de notas, botões de WhatsApp e e-mail diretos
- **Realtime** — atualiza automaticamente quando novos leads chegam via n8n

## Banco de dados

O projeto usa a tabela `empresas` criada no Supabase conforme o SQL fornecido.

Para habilitar realtime no Supabase:
- Vá em **Database → Replication**
- Habilite a tabela `empresas`

## Adicionar nota de notas no banco

Execute no SQL Editor do Supabase para adicionar suporte a notas:

```sql
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS observacoes_json TEXT;
```

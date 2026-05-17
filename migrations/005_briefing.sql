-- =============================================
-- Migration 005: Sistema de Briefing
-- =============================================

-- Template global (uma única linha, editável pelo superadmin)
CREATE TABLE IF NOT EXISTS briefing_template (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT NOT NULL DEFAULT 'Briefing - Landing Page + Tráfego Pago',
  secoes      JSONB NOT NULL DEFAULT '[]',
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Respostas por lead (uma linha por empresa_id)
CREATE TABLE IF NOT EXISTS briefing_respostas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  respostas     JSONB NOT NULL DEFAULT '{}',
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  usuario_id    UUID REFERENCES auth.users(id),
  usuario_nome  TEXT,
  UNIQUE(empresa_id)
);

-- RLS
ALTER TABLE briefing_template   ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_respostas  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read template"    ON briefing_template FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth update template"  ON briefing_template FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth insert template"  ON briefing_template FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth all briefing_respostas" ON briefing_respostas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Template padrão para Landing Page + Tráfego Pago
INSERT INTO briefing_template (titulo, secoes) VALUES (
  'Briefing - Landing Page + Tráfego Pago',
  $json$[
    {
      "id": "sec-1",
      "titulo": "Informações do Negócio",
      "perguntas": [
        {"id": "q1",  "tipo": "text",     "label": "Nome do negócio / marca",                                        "obrigatorio": true,  "opcoes": []},
        {"id": "q2",  "tipo": "text",     "label": "Segmento / nicho de atuação",                                    "obrigatorio": true,  "opcoes": []},
        {"id": "q3",  "tipo": "textarea", "label": "Quem é o cliente ideal? Descreva o público-alvo",                "obrigatorio": true,  "opcoes": []},
        {"id": "q4",  "tipo": "textarea", "label": "Quais são os principais diferenciais do negócio?",               "obrigatorio": false, "opcoes": []}
      ]
    },
    {
      "id": "sec-2",
      "titulo": "Objetivos e Resultados",
      "perguntas": [
        {"id": "q5",  "tipo": "select",   "label": "Objetivo principal do projeto",                                  "obrigatorio": true,  "opcoes": ["Gerar leads/contatos", "Vender online", "Apresentar a empresa", "Agendar consultas/reuniões", "Outro"]},
        {"id": "q6",  "tipo": "text",     "label": "Meta de resultados esperados (ex: 50 leads/mês)",                "obrigatorio": false, "opcoes": []},
        {"id": "q7",  "tipo": "text",     "label": "Prazo esperado para o lançamento",                               "obrigatorio": false, "opcoes": []}
      ]
    },
    {
      "id": "sec-3",
      "titulo": "Site / Landing Page",
      "perguntas": [
        {"id": "q8",  "tipo": "text",     "label": "Já tem site? Se sim, qual a URL?",                               "obrigatorio": false, "opcoes": []},
        {"id": "q9",  "tipo": "radio",    "label": "Tem logo e identidade visual?",                                  "obrigatorio": true,  "opcoes": ["Sim, completa", "Sim, parcial", "Não tenho"]},
        {"id": "q10", "tipo": "textarea", "label": "Cores preferidas e/ou referências visuais (URLs, exemplos)",     "obrigatorio": false, "opcoes": []},
        {"id": "q11", "tipo": "textarea", "label": "Quais seções quer na página? (ex: sobre, serviços, depoimentos)", "obrigatorio": false, "opcoes": []},
        {"id": "q12", "tipo": "radio",    "label": "Tem fotos e vídeos próprios do negócio?",                        "obrigatorio": true,  "opcoes": ["Sim", "Não", "Parcialmente"]}
      ]
    },
    {
      "id": "sec-4",
      "titulo": "Tráfego Pago",
      "perguntas": [
        {"id": "q13", "tipo": "radio",    "label": "Já investe em tráfego pago atualmente?",                         "obrigatorio": true,  "opcoes": ["Sim", "Não"]},
        {"id": "q14", "tipo": "checkbox", "label": "Plataformas de interesse para anunciar",                         "obrigatorio": true,  "opcoes": ["Meta Ads (Facebook/Instagram)", "Google Ads", "TikTok Ads", "YouTube Ads"]},
        {"id": "q15", "tipo": "text",     "label": "Orçamento mensal disponível para anúncios (em R$)",              "obrigatorio": false, "opcoes": []},
        {"id": "q16", "tipo": "textarea", "label": "Quais produtos ou serviços quer anunciar? Descreva brevemente",  "obrigatorio": true,  "opcoes": []},
        {"id": "q17", "tipo": "radio",    "label": "Tem pixel / tag de rastreamento instalado?",                     "obrigatorio": false, "opcoes": ["Sim", "Não", "Não sei"]}
      ]
    },
    {
      "id": "sec-5",
      "titulo": "Acesso e Infraestrutura",
      "perguntas": [
        {"id": "q18", "tipo": "radio",    "label": "Tem domínio registrado? (ex: minhaempresa.com.br)",              "obrigatorio": false, "opcoes": ["Sim", "Não"]},
        {"id": "q19", "tipo": "text",     "label": "Qual o domínio?",                                                "obrigatorio": false, "opcoes": []},
        {"id": "q20", "tipo": "radio",    "label": "Tem hospedagem contratada?",                                     "obrigatorio": false, "opcoes": ["Sim", "Não"]},
        {"id": "q21", "tipo": "radio",    "label": "Tem e-mail profissional? (ex: contato@empresa.com)",             "obrigatorio": false, "opcoes": ["Sim", "Não"]}
      ]
    }
  ]$json$
);

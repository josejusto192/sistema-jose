-- =============================================
-- Migration 012: Formulário público "Briefing - Criação de Landing Page"
-- Insere um novo registro em `formularios` (tipo = 'briefing'), completo,
-- para coletar todas as informações necessárias antes de criar uma landing page.
-- =============================================

INSERT INTO formularios (titulo, descricao, tipo, campos, ativo) VALUES (
  'Briefing - Criação de Landing Page',
  'Preencha com atenção: essas informações serão usadas para criar sua landing page. Quanto mais completo, melhor o resultado final.',
  'briefing',
  $json$[
    {"id": "f1",  "tipo": "texto",     "label": "Nome do negócio / marca",                                                     "placeholder": "Ex: Justo Mídias",                          "obrigatorio": true,  "opcoes": []},
    {"id": "f2",  "tipo": "texto",     "label": "Nome do responsável pelo preenchimento",                                      "placeholder": "Seu nome completo",                          "obrigatorio": true,  "opcoes": []},
    {"id": "f3",  "tipo": "telefone",  "label": "WhatsApp para contato",                                                       "placeholder": "(00) 00000-0000",                            "obrigatorio": true,  "opcoes": []},
    {"id": "f4",  "tipo": "email",     "label": "E-mail para contato",                                                        "placeholder": "seuemail@empresa.com",                       "obrigatorio": true,  "opcoes": []},
    {"id": "f5",  "tipo": "texto",     "label": "Segmento / ramo de atuação",                                                  "placeholder": "Ex: Clínica odontológica",                   "obrigatorio": true,  "opcoes": []},
    {"id": "f6",  "tipo": "textarea",  "label": "Descreva o negócio em poucas frases (o que faz, há quanto tempo existe)",      "placeholder": "",                                           "obrigatorio": true,  "opcoes": []},
    {"id": "f7",  "tipo": "textarea",  "label": "Quem é o cliente ideal? (idade, gênero, localização, comportamento, dores)",   "placeholder": "",                                           "obrigatorio": true,  "opcoes": []},
    {"id": "f8",  "tipo": "textarea",  "label": "Quais são os principais diferenciais do negócio frente aos concorrentes?",     "placeholder": "",                                           "obrigatorio": false, "opcoes": []},
    {"id": "f9",  "tipo": "select",    "label": "Objetivo principal da landing page",                                          "placeholder": "",                                           "obrigatorio": true,  "opcoes": ["Gerar leads/contatos", "Vender um produto/serviço", "Agendar consultas ou reuniões", "Captar inscrições para evento", "Apresentar a empresa/portfólio", "Outro"]},
    {"id": "f10", "tipo": "texto",     "label": "Meta de resultado esperado (ex: 50 leads/mês, 20 vendas/mês)",                 "placeholder": "",                                           "obrigatorio": false, "opcoes": []},
    {"id": "f11", "tipo": "texto",     "label": "Qual ação você quer que o visitante realize? (CTA principal)",                "placeholder": "Ex: Clicar no botão e falar no WhatsApp",    "obrigatorio": true,  "opcoes": []},
    {"id": "f12", "tipo": "textarea",  "label": "Descreva o produto ou serviço principal que será oferecido na página",        "placeholder": "",                                           "obrigatorio": true,  "opcoes": []},
    {"id": "f13", "tipo": "textarea",  "label": "Quais os principais benefícios que o cliente terá ao comprar/contratar?",      "placeholder": "Liste em tópicos, se possível",              "obrigatorio": true,  "opcoes": []},
    {"id": "f14", "tipo": "textarea",  "label": "Liste objeções comuns dos clientes (motivos para não comprar) e como responder a elas", "placeholder": "",                                     "obrigatorio": false, "opcoes": []},
    {"id": "f15", "tipo": "textarea",  "label": "Tem depoimentos, prints de clientes satisfeitos ou cases de sucesso? Cole aqui ou descreva", "placeholder": "",                                "obrigatorio": false, "opcoes": []},
    {"id": "f16", "tipo": "textarea",  "label": "Possui números/provas que gerem autoridade? (ex: +500 clientes, 10 anos de mercado, nota 4.9 no Google)", "placeholder": "",                  "obrigatorio": false, "opcoes": []},
    {"id": "f17", "tipo": "select",    "label": "Forma de oferta/preço",                                                       "placeholder": "",                                           "obrigatorio": false, "opcoes": ["Preço fixo exibido na página", "Sob consulta / orçamento personalizado", "Faixa de preço", "Não exibir preço"]},
    {"id": "f18", "tipo": "texto",     "label": "Se houver, informe o valor, faixa de preço ou condições de pagamento",         "placeholder": "",                                           "obrigatorio": false, "opcoes": []},
    {"id": "f19", "tipo": "select",    "label": "Tem urgência/escassez para usar na página? (gera conversão)",                  "placeholder": "",                                           "obrigatorio": false, "opcoes": ["Vagas limitadas", "Promoção por tempo limitado", "Bônus para os primeiros", "Nenhuma"]},
    {"id": "f20", "tipo": "radio",     "label": "Já tem identidade visual definida (logo, cores, fontes)?",                     "placeholder": "",                                           "obrigatorio": true,  "opcoes": ["Sim, completa", "Sim, parcial", "Não tenho"]},
    {"id": "f21", "tipo": "texto",     "label": "Cores da marca (se já tiver definidas)",                                      "placeholder": "Ex: Azul escuro e branco",                   "obrigatorio": false, "opcoes": []},
    {"id": "f22", "tipo": "textarea",  "label": "Referências visuais de páginas que você gosta (links de outras landing pages/sites)", "placeholder": "Cole os links aqui",                    "obrigatorio": false, "opcoes": []},
    {"id": "f23", "tipo": "radio",     "label": "Tem fotos e vídeos próprios do negócio/produto em boa qualidade?",             "placeholder": "",                                           "obrigatorio": true,  "opcoes": ["Sim", "Não", "Parcialmente"]},
    {"id": "f24", "tipo": "checkbox",  "label": "Quais seções você gostaria que a página tivesse?",                            "placeholder": "",                                           "obrigatorio": true,  "opcoes": ["Banner/Hero principal", "Sobre a empresa", "Benefícios/diferenciais", "Serviços/produtos", "Depoimentos de clientes", "Galeria de fotos/portfólio", "Perguntas frequentes (FAQ)", "Formulário de contato", "Localização/mapa", "Selos de garantia/segurança"]},
    {"id": "f25", "tipo": "select",    "label": "Como o visitante deve converter na página?",                                  "placeholder": "",                                           "obrigatorio": true,  "opcoes": ["Botão para WhatsApp", "Formulário de contato na própria página", "Botão para ligação telefônica", "Link para checkout/pagamento", "Mais de uma opção"]},
    {"id": "f26", "tipo": "radio",     "label": "Já investe ou pretende investir em tráfego pago para divulgar a página?",      "placeholder": "",                                           "obrigatorio": true,  "opcoes": ["Sim, já investe", "Sim, pretende começar", "Não"]},
    {"id": "f27", "tipo": "checkbox",  "label": "Plataformas de interesse para anunciar",                                      "placeholder": "",                                           "obrigatorio": false, "opcoes": ["Meta Ads (Facebook/Instagram)", "Google Ads", "TikTok Ads", "YouTube Ads"]},
    {"id": "f28", "tipo": "texto",     "label": "Orçamento mensal disponível para anúncios (em R$)",                           "placeholder": "",                                           "obrigatorio": false, "opcoes": []},
    {"id": "f29", "tipo": "radio",     "label": "Tem domínio próprio registrado? (ex: minhaempresa.com.br)",                    "placeholder": "",                                           "obrigatorio": true,  "opcoes": ["Sim", "Não, preciso registrar"]},
    {"id": "f30", "tipo": "texto",     "label": "Qual o domínio? (se já tiver)",                                               "placeholder": "Ex: minhaempresa.com.br",                    "obrigatorio": false, "opcoes": []},
    {"id": "f31", "tipo": "radio",     "label": "Tem pixel do Meta ou tag do Google instalado em algum site?",                  "placeholder": "",                                           "obrigatorio": false, "opcoes": ["Sim", "Não", "Não sei"]},
    {"id": "f32", "tipo": "texto",     "label": "Redes sociais do negócio (Instagram, Facebook, etc.)",                        "placeholder": "Cole os links",                              "obrigatorio": false, "opcoes": []},
    {"id": "f33", "tipo": "data",      "label": "Prazo desejado para a página estar no ar",                                    "placeholder": "",                                           "obrigatorio": false, "opcoes": []},
    {"id": "f34", "tipo": "textarea",  "label": "Outras observações ou materiais importantes que devemos considerar",         "placeholder": "",                                           "obrigatorio": false, "opcoes": []}
  ]$json$,
  true
);

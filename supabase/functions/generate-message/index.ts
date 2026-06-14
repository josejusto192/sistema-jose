import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const GEMINI_MODEL   = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  try {
    // Exige usuário autenticado (mesmo token usado pelo sistema/extensão)
    const authHeader = req.headers.get('Authorization') || ''
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { nomeContato, nomeEmpresa, contexto } = await req.json()

    const prompt = `Você é um especialista em prospecção comercial via WhatsApp para uma agência de marketing chamada Justo Mídias.
Escreva UMA mensagem curta (máx. 4 linhas), em português do Brasil, casual e direta, para o primeiro contato com um lead.

Nome do contato: ${nomeContato || 'não informado'}
Empresa: ${nomeEmpresa || 'não informado'}
Contexto adicional: ${contexto || 'nenhum'}

Regras:
- Não use saudações genéricas como "Espero que esteja bem".
- Vá direto ao ponto, gere curiosidade, sem parecer spam.
- Não use emojis em excesso (no máximo 1).
- Retorne APENAS o texto da mensagem, sem aspas, sem explicações.`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
      }),
    })
    const data = await geminiRes.json()
    if (!geminiRes.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'Erro ao gerar mensagem' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) {
      return new Response(JSON.stringify({ error: 'Resposta vazia da IA' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ message: text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

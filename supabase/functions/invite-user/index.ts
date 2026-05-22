import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { email, nome, sobrenome, cargo, role, comissao_percentual } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'E-mail é obrigatório' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const origin = req.headers.get('origin') || 'https://tilim.app'

    const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome, sobrenome },
      redirectTo: origin + '/',
    })

    if (inviteErr) {
      return new Response(JSON.stringify({ error: inviteErr.message }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const userId = invite.user.id

    const { error: profileErr } = await admin.from('profiles').upsert({
      id: userId,
      email,
      nome: nome || '',
      sobrenome: sobrenome || '',
      cargo: cargo || 'Vendedor',
      role: role || 'vendedor',
      comissao_percentual: Number(comissao_percentual) || 10,
      ativo: true,
    }, { onConflict: 'id' })

    if (profileErr) console.error('profile upsert:', profileErr.message)

    return new Response(JSON.stringify({ ok: true, userId }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('invite-user error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

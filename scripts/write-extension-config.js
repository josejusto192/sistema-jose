// Gera public/justo-crm-config.json a partir das envs de build (Vite).
// Esse arquivo é público (mesmas chaves já embutidas no bundle do app) e é
// consumido pela extensão de WhatsApp para se autoconfigurar — o usuário só
// precisa informar a URL do sistema, nada de copiar/colar chaves.
import { writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = `${__dirname}/../public/justo-crm-config.json`

const config = {
  SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
  GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash',
}

mkdirSync(`${__dirname}/../public`, { recursive: true })
writeFileSync(outPath, JSON.stringify(config, null, 2))
console.log(`[extension-config] escrito em ${outPath}`)

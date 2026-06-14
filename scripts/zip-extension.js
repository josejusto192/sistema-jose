// Empacota a pasta extension/ em public/justo-crm-extension.zip, servida pelo
// botão "Baixar extensão" em Configurações → Extensão.
import { execFileSync } from 'child_process'
import { mkdirSync, existsSync, rmSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = `${__dirname}/../extension`
const outPath = `${__dirname}/../public/justo-crm-extension.zip`

mkdirSync(`${__dirname}/../public`, { recursive: true })
if (existsSync(outPath)) rmSync(outPath)

execFileSync('zip', ['-r', outPath, '.', '-x', '*.md'], { cwd: srcDir, stdio: 'inherit' })
console.log(`[extension-zip] escrito em ${outPath}`)

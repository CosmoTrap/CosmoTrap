// npm run local: PHP + Vite. Also used by Playwright with --api-only.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
process.chdir(root)
const portable = join(root, '.tools', 'php', 'php.exe')
const php = process.env.PHP_BINARY || (existsSync(portable) ? portable : 'php')
const check = spawnSync(php, ['-m'], { encoding: 'utf8', windowsHide: true })
if (check.error || check.status !== 0 || !['pdo_sqlite', 'mbstring'].every((ext) => check.stdout?.includes(ext))) {
  console.error('PHP 8 avec pdo_sqlite et mbstring est requis. Sous Windows : powershell -ExecutionPolicy Bypass -File scripts/setup-php.ps1')
  if (check.stderr) console.error(check.stderr)
  process.exit(1)
}
const apiOnly = process.argv.includes('--api-only')
const ports = apiOnly ? [8787] : [8787, 5180]
function listening(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    const done = (open) => { socket.destroy(); resolve(open) }
    socket.once('connect', () => done(true)); socket.once('error', () => done(false))
    socket.setTimeout(700, () => done(false))
  })
}
const procs = []
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const p of procs) p.kill()
  process.exit(code)
}
for (const port of ports) {
  if (await listening(port)) {
    console.error(`Le port ${port} est deja utilise. Fermez le precedent serveur CosmoTrap avant de relancer.`)
    process.exit(1)
  }
}
function start(command, args) {
  const p = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true })
  procs.push(p)
  p.on('error', (error) => { console.error(error.message); stop(1) })
  p.on('exit', (code) => { if (!stopping) stop(code || 1) })
}
start(php, ['-S', '127.0.0.1:8787', '-t', 'public'])
if (!apiOnly) start(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0', '--port', '5180', '--strictPort'])
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
let ready = false
for (let i = 0; i < 60; i++) {
  if ((await Promise.all(ports.map(listening))).every(Boolean)) { ready = true; break }
  await new Promise((resolve) => setTimeout(resolve, 250))
}
if (!ready) { console.error('Le serveur ne repond pas. Verifiez les erreurs ci-dessus.'); stop(1) }
if (!apiOnly) {
  console.log('\nCosmoTrap est pret : http://localhost:5180')
  for (const info of Object.values(networkInterfaces()).flat()) {
    if (info?.family === 'IPv4' && !info.internal) console.log(`Reseau local : http://${info.address}:5180`)
  }
  console.log('Ctrl+C pour arreter le jeu et son API.\n')
}

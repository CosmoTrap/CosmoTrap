// Lance le jeu en local en une commande : API PHP (port 8787) + jeu Vite (port 5180, ouvert au réseau local).
// Usage : npm run local
import { spawn } from 'node:child_process'
import { networkInterfaces } from 'node:os'

const procs = [
  spawn('php', ['-S', '127.0.0.1:8787', '-t', 'public'], { stdio: ['ignore', 'ignore', 'inherit'] }),
  spawn('npx', ['vite', '--host'], { stdio: 'inherit', shell: process.platform === 'win32' }),
]
procs[0].on('error', () => console.error('\n⚠ PHP introuvable : installe PHP 8 (brew install php) pour les comptes et le classement.\n'))

const ips = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address)
setTimeout(() => {
  console.log('\n🚀 Cosmotrap est lancé')
  console.log('   Sur cet ordinateur : http://localhost:5180')
  for (const ip of ips) console.log(`   Sur le même Wi-Fi  : http://${ip}:5180`)
  console.log('   Ctrl+C pour arrêter\n')
}, 2500)

const stop = () => {
  for (const p of procs) p.kill()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

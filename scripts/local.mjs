// Lance le jeu en local en une commande : API PHP (port 8787) + jeu Vite (port 5180, ouvert au réseau local).
// Usage : npm run local
import { spawn } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// dirname deux fois : scripts/local.mjs → racine du projet.
// new URL('..') remonte trop haut dès que le chemin contient un « & ».
const root = dirname(dirname(fileURLToPath(import.meta.url)))
// Pas de shell : un « & » dans le chemin du projet (ex. « Cours & Formation »)
// coupe la commande Windows et Vite ne démarre jamais.
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const publicDir = join(root, 'public')

const procs = [
  spawn('php', ['-S', '127.0.0.1:8787', '-t', publicDir], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] }),
  spawn(process.execPath, [viteBin, '--host'], { cwd: root, stdio: 'inherit' }),
]
procs[0].on('error', () => console.error('\n⚠ PHP introuvable : installe PHP 8 pour les comptes et le classement.\n'))
procs[1].on('error', () => console.error('\n⚠ Vite introuvable : lance npm install dans le dossier du projet.\n'))

const ips = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address)
setTimeout(() => {
  if (procs[1].exitCode != null) {
    console.error('\n⚠ Le jeu ne s’est pas lancé. Le port 8787 est seulement l’API : ouvre http://localhost:5180 une fois Vite démarré.\n')
    return
  }
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

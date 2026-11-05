// Mise en ligne en une commande : `npm run deploy`
//  1. build du jeu (types + Vite) ;
//  2. envoi de dist/ sur la branche « hostinger » du dépôt GitHub (le site compilé, rien d'autre) ;
//  3. le serveur installe cette version : tout de suite si le jeton de déploiement est connu
//     (.deploy-token, non versionné, ou DEPLOY_TOKEN), sinon dans les 5 minutes (tâche Cron Hostinger).
import { execSync } from 'node:child_process'
import dns from 'node:dns'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// certaines box ont un IPv6 qui ne répond pas : sans ça, fetch attend indéfiniment
dns.setDefaultResultOrder('ipv4first')

const SITE = process.env.SITE_URL ?? 'https://royalblue-wolverine-280146.hostingersite.com'
// REPO_URL : URL avec jeton d'accès dans GitHub Actions ; en local, les identifiants git habituels
const REPO = process.env.REPO_URL ?? 'https://github.com/CosmoTrap/CosmoTrap.git'
const BRANCH = 'hostinger'
const root = process.cwd()
const sh = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' })
const out = (cmd, cwd = root) => execSync(cmd, { cwd }).toString().trim()

const token = process.env.DEPLOY_TOKEN ?? (existsSync(join(root, '.deploy-token')) ? readFileSync(join(root, '.deploy-token'), 'utf8').trim() : '')

const skipBuild = process.argv.includes('--no-build')
if (!skipBuild) sh('npm run build')
const rev = out('git rev-parse --short HEAD')
const dirty = out('git status --porcelain') ? ' (+ modifications locales)' : ''

// branche hostinger : on repart de son dernier état pour garder un historique sans force push
const tmp = mkdtempSync(join(tmpdir(), 'cosmotrap-deploy-'))
try {
  sh(`git clone --quiet --depth 1 --branch ${BRANCH} ${REPO} site`, tmp)
} catch {
  sh(`git init --quiet -b ${BRANCH} site`, tmp)
  sh(`git remote add origin ${REPO}`, join(tmp, 'site'))
}
const site = join(tmp, 'site')
for (const f of readdirSync(site)) if (f !== '.git') rmSync(join(site, f), { recursive: true, force: true })
cpSync(join(root, 'dist'), site, { recursive: true, filter: (src) => !src.endsWith('.DS_Store') })
sh('git add -A', site)
if (out('git status --porcelain', site)) {
  sh(`git -c user.name="Cosmotrap deploy" -c user.email="deploy@cosmotrap.local" commit --quiet -m "Build ${rev}${dirty}"`, site)
  sh(`git push --quiet origin ${BRANCH}`, site)
  console.log(`Branche ${BRANCH} mise à jour (build ${rev}${dirty}).`)
} else console.log(`Branche ${BRANCH} déjà à jour.`)
rmSync(tmp, { recursive: true, force: true })

if (!token) {
  console.log('Le serveur installera cette version dans les 5 minutes (tâche Cron Hostinger).')
  process.exit(0)
}
// le serveur télécharge la branche et remplace les fichiers
console.log('Installation sur Hostinger…')
const res = await fetch(`${SITE}/api/deploy.php`, { method: 'POST', headers: { 'X-Deploy-Token': token }, signal: AbortSignal.timeout(300000) })
const body = await res.json().catch(() => ({}))
if (!res.ok || !body.ok) {
  console.error('Échec de la mise en ligne :', res.status, body)
  process.exit(1)
}
console.log(body.upToDate ? `Déjà en ligne (version ${body.version}).` : `En ligne : version ${body.version}, ${body.files} fichiers installés.`)
const health = await fetch(`${SITE}/api/health.php`, { signal: AbortSignal.timeout(30000) }).then((r) => r.json()).catch(() => ({}))
console.log(health.ok ? `API et base de données OK (${health.driver}).` : 'Attention : l’API ne répond pas correctement.')
console.log(SITE)

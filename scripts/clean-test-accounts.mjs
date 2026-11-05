// Retire de la base locale les comptes créés par les tests (e-mail en @cosmotrap.test) et leurs scores.
// Les vrais comptes ne sont pas touchés. Lancé après chaque `npx playwright test`, ou à la main :
// node scripts/clean-test-accounts.mjs
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export default async function cleanTestAccounts() {
  const file = join(process.cwd(), 'cosmotrap-data', 'cosmotrap.sqlite')
  if (!existsSync(file)) return
  let DatabaseSync
  try {
    ({ DatabaseSync } = await import('node:sqlite'))
  } catch {
    console.warn('node:sqlite indisponible : comptes de test conservés (Node 22.5 ou plus requis).')
    return
  }
  const db = new DatabaseSync(file)
  try {
    const ids = "SELECT id FROM users WHERE email LIKE '%@cosmotrap.test'"
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name <> 'users' AND name NOT LIKE 'sqlite_%'").all()
    for (const { name } of tables) {
      const columns = db.prepare(`PRAGMA table_info(${name})`).all().map((c) => c.name)
      if (columns.includes('user_id')) db.exec(`DELETE FROM ${name} WHERE user_id IN (${ids})`)
    }
    const { changes } = db.prepare("DELETE FROM users WHERE email LIKE '%@cosmotrap.test'").run()
    console.log(`${changes} compte(s) de test retiré(s).`)
  } finally {
    db.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await cleanTestAccounts()

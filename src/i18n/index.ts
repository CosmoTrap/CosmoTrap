import { en } from './en'
import { fr } from './fr'

// Changement de langue : on réécrit le dictionnaire `fr` en place (tout le jeu le lit à l'affichage).
// Les clés absentes de la traduction restent en français.

type AnyObj = Record<string, unknown>
const clone = (o: unknown): unknown => (Array.isArray(o) ? o.map(clone) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o as AnyObj).map(([k, v]) => [k, clone(v)])) : o)
const ORIGINAL = clone(fr) as AnyObj

function assign(target: AnyObj, src: AnyObj) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) assign(target[k] as AnyObj, v as AnyObj)
    else target[k] = clone(v)
  }
}

export function setLanguage(lang: 'fr' | 'en') {
  assign(fr as unknown as AnyObj, ORIGINAL)
  if (lang === 'en') assign(fr as unknown as AnyObj, en as unknown as AnyObj)
  document.documentElement.lang = lang
}

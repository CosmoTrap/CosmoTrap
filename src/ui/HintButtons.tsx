import { hintButtonLabel, hintFor, hintKey, requestHint, type HintTarget } from '../game/logic'
import { useGame } from '../game/state'

/** Les deux niveaux d'aide. La tablette et les énigmes lisent le même historique. */
export function HintButtons({ target, lightId = 'hint', strongId = 'hint2' }: { target?: HintTarget | null; lightId?: string; strongId?: string }) {
  const shown = useGame((s) => s.hintsShown)
  useGame((s) => s.settings.help)
  useGame((s) => s.difficulty)
  useGame((s) => s.valves)
  useGame((s) => s.zone)
  useGame((s) => s.flags)
  useGame((s) => s.lunar.solved)
  const lightKey = hintKey(1, target)
  const strongKey = hintKey(2, target)
  const lightUsed = !!lightKey && shown.includes(lightKey)
  const strongUsed = !!strongKey && shown.includes(strongKey)
  return <div className="hint-block">
    <div className="hint-actions">
      <button type="button" data-testid={lightId} className={lightUsed ? 'used' : ''} aria-pressed={lightUsed} disabled={lightUsed || !lightKey} onClick={() => requestHint(1, target)}>
        {hintButtonLabel(1, lightUsed)}
      </button>
      <button type="button" data-testid={strongId} className={strongUsed ? 'used' : ''} aria-pressed={strongUsed} disabled={!lightUsed || strongUsed || !strongKey} onClick={() => requestHint(2, target)}>
        {hintButtonLabel(2, strongUsed)}
      </button>
    </div>
    {lightUsed && <blockquote data-testid={`${lightId}-text`}>{hintFor(1, target)}</blockquote>}
    {strongUsed && <blockquote data-testid={`${strongId}-text`}>{hintFor(2, target)}</blockquote>}
  </div>
}

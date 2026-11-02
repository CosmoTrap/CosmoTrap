import type { ItemId } from '../game/types'

// Icônes vectorielles (trait fin) pour l'inventaire et le HUD.
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const PATHS: Record<string, JSX.Element> = {
  o2: (
    <g {...S}>
      <rect x="9" y="7" width="6" height="15" rx="3" />
      <path d="M11 7V4h2v3M10 3h4" />
      <text x="12" y="17" fontSize="4.5" textAnchor="middle" stroke="none" fill="currentColor">
        O₂
      </text>
    </g>
  ),
  battery: (
    <g {...S}>
      <rect x="4" y="8" width="14" height="8" rx="1.5" />
      <path d="M18 11h2v2h-2M7 12h5M9.5 9.5v5" />
    </g>
  ),
  water: (
    <g {...S}>
      <path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11z" />
      <path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5" />
    </g>
  ),
  lamp: (
    <g {...S}>
      <path d="M4 12a8 4 0 0 0 16 0" />
      <rect x="9" y="8" width="6" height="5" rx="1" />
      <path d="M12 5V3M8 6 6.5 4.5M16 6l1.5-1.5" />
    </g>
  ),
  badge: (
    <g {...S}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8 17c1-2 7-2 8 0M10 4V2h4v2" />
    </g>
  ),
  fuse: (
    <g {...S}>
      <rect x="6" y="9" width="12" height="6" rx="1" />
      <path d="M3 12h3M18 12h3M9 9v6M15 9v6" />
    </g>
  ),
  wrench: (
    <g {...S}>
      <path d="M14.5 4.5a4 4 0 0 0 4.9 4.9l-9.5 9.5a2 2 0 0 1-2.8-2.8l9.5-9.5z" />
    </g>
  ),
  cell: (
    <g {...S}>
      <rect x="8" y="3" width="8" height="18" rx="2" />
      <path d="M12.5 7 10 12.5h3.5L11 17" />
    </g>
  ),
  rope: (
    <g {...S}>
      <ellipse cx="12" cy="12" rx="7" ry="5" />
      <ellipse cx="12" cy="12" rx="4" ry="2.5" />
      <path d="M19 12c1 3 2 5 3 6" />
    </g>
  ),
  carBattery: (
    <g {...S}>
      <rect x="3" y="8" width="18" height="11" rx="1.5" />
      <path d="M6 8V6h3v2M15 8V6h3v2M7 13h3M15.5 11.5v3M14 13h3" />
    </g>
  ),
  antenna: (
    <g {...S}>
      <path d="M12 21V8M8 21h8M12 8l-5-5M12 8l5-5M9 12a4 4 0 0 1 6 0" />
    </g>
  ),
  manual: (
    <g {...S}>
      <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h10M9 7h6M9 10h4" />
    </g>
  ),
  flareGun: (
    <g {...S}>
      <path d="M4 8h13a2 2 0 0 1 2 2v1H9l-1 7H5l1-7H4z" />
      <path d="M19 9.5h2" />
    </g>
  ),
  survival: (
    <g {...S}>
      <path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7z" />
      <path d="M12 9v6M9 12h6" />
    </g>
  ),
}

export function ItemIcon({ item }: { item: ItemId | 'survival' }) {
  const p = PATHS[item] ?? PATHS.survival
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      {p}
    </svg>
  )
}

export function GaugeIcon({ kind }: { kind: 'o2' | 'lamp' | 'water' }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden>
      {PATHS[kind === 'lamp' ? 'lamp' : kind]}
    </svg>
  )
}

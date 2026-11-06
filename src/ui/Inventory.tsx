import { useState } from 'react'
import { ITEM_KIND } from '../game/items'
import { canUseItem, cycleItem, hotbarItems, selectedInventoryItem, selectItem, useSelectedItem } from '../game/logic'
import { useGame } from '../game/state'
import type { ItemId, ItemKind } from '../game/types'
import { fr } from '../i18n/fr'
import { openInventory } from '../player/Player'
import { labelFor, padButtonName } from '../player/input'
import { ItemIcon } from './Icons'
import './inventory.css'

function actionLabel(item: ItemId, held: ItemId | null, lampOn: boolean) {
  const t = fr.inventory
  if (item === 'lamp') return lampOn ? t.lampOff : t.lampOn
  if (item === 'manual' || item === 'map') return t.read
  return fr.items[item].action ?? (held === item ? t.unequip : t.equip)
}

/** Objects shown at once in the bar; the others are reached with the arrows or the wheel. */
const HOTBAR_SLOTS = 12

/** The same selection is shared by the wheel, keyboard, controller and full inventory. */
export function Hotbar() {
  const inv = useGame((s) => s.inv)
  useGame((s) => s.selectedItem)
  const held = useGame((s) => s.held)
  const lampOn = useGame((s) => s.lampOn)
  const keys = useGame((s) => s.settings.keys)
  const pad = useGame((s) => s.padActive)
  const padType = useGame((s) => s.settings.padType)
  const padKeys = useGame((s) => s.settings.pad)
  const t = fr.inventory
  const items = hotbarItems()
  const selected = selectedInventoryItem()
  const index = selected ? items.indexOf(selected) : 0
  const start = Math.max(0, Math.min(index - 5, items.length - HOTBAR_SLOTS))
  const shown = items.slice(start, start + HOTBAR_SLOTS)
  const wheelHint = pad ? `${padButtonName(padType, padKeys.previousItem)} / ${padButtonName(padType, padKeys.nextItem)}` : t.wheel
  return (
    <section className="quick-inventory" data-testid="hotbar" data-hotbar aria-label={t.title}>
      <div className="quick-title">
        <span className="quick-name" data-testid="selected-item-name">{selected ? fr.items[selected].name : t.empty}</span>
        {items.length > 1 && <small>{index + 1} / {items.length}</small>}
        {selected && canUseItem(selected) && <button type="button" className="quick-use" data-testid="hotbar-use" onClick={useSelectedItem}>
          <kbd>{pad ? padButtonName(padType, padKeys.useSelected) : labelFor(keys, 'useSelected')}</kbd> {actionLabel(selected, held, lampOn)}
        </button>}
      </div>
      <div className="quick-tray">
        {items.length > HOTBAR_SLOTS && <button type="button" className="quick-arrow" aria-label={t.previous} title={wheelHint} onClick={() => cycleItem(-1)}>‹</button>}
        <div className="quick-slots">
          {shown.map((item, i) => <button type="button" key={item}
            className={`slot kind-${ITEM_KIND[item]} ${selected === item ? 'selected' : ''}`} data-testid={`hotbar-${item}`}
            aria-label={`${fr.items[item].name} ×${inv[item]}`} aria-pressed={selected === item}
            title={fr.items[item].name} onClick={() => selectItem(item)}>
            {start + i < 9 && <span className="num">{start + i + 1}</span>}
            <ItemIcon item={item} />
            {(inv[item] ?? 0) > 1 && <span className="cnt">{inv[item]}</span>}
            {(held === item || (item === 'lamp' && lampOn)) && <i className="quick-equipped" />}
          </button>)}
          {/* Free places keep the bar's width steady as items are picked up. */}
          {Array.from({ length: Math.max(0, 5 - shown.length) }, (_, i) => <span key={i} className="quick-free" aria-hidden />)}
        </div>
        {items.length > HOTBAR_SLOTS && <button type="button" className="quick-arrow" aria-label={t.next} title={wheelHint} onClick={() => cycleItem(1)}>›</button>}
        <button type="button" className="quick-bag" data-testid="open-inventory" onClick={openInventory} title={t.title} aria-label={t.title}>
          <svg viewBox="0 0 24 24" aria-hidden><path d="M9 7V5.2a3 3 0 0 1 6 0V7M6 10.5A3.5 3.5 0 0 1 9.5 7h5a3.5 3.5 0 0 1 3.5 3.5V21H6zM9 14.5h6V18H9zM9 11h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
          <kbd>{pad ? padButtonName(padType, padKeys.inventory) : labelFor(keys, 'inventory')}</kbd>
        </button>
      </div>
    </section>
  )
}

export function InventoryContent() {
  const inv = useGame((s) => s.inv)
  useGame((s) => s.selectedItem)
  const held = useGame((s) => s.held)
  const lampOn = useGame((s) => s.lampOn)
  const keys = useGame((s) => s.settings.keys)
  const [category, setCategory] = useState<ItemKind | 'all'>('all')
  const t = fr.inventory
  const items = hotbarItems()
  const selected = selectedInventoryItem()
  const visible = items.filter((it) => category === 'all' || ITEM_KIND[it] === category)
  const filter = (kind: ItemKind | 'all') => {
    setCategory(kind)
    const next = items.filter((it) => kind === 'all' || ITEM_KIND[it] === kind)
    if (next.length && (!selected || !next.includes(selected))) selectItem(next[0])
  }
  return (
    <section className="tablet-inventory" data-testid="inventory">
        <div className="inventory-body">
          <section className="inventory-storage">
            <nav className="inventory-filters" aria-label={t.title}>
              {(['all', 'resource', 'key', 'survival'] as const).map((kind) => <button key={kind} type="button"
                aria-pressed={category === kind} className={category === kind ? 'active' : ''} onClick={() => filter(kind)}>{t[kind]}<small>{kind === 'all' ? items.length : items.filter((it) => ITEM_KIND[it] === kind).length}</small></button>)}
            </nav>
            {!visible.length && <p className="inventory-empty">{items.length ? t.noCategory : t.empty}<small>{!items.length && t.emptyHint}</small></p>}
            <div className="inventory-grid">
              {visible.map((item) => <button type="button" key={item} className={`inventory-cell ${selected === item ? 'selected' : ''}`}
                data-testid={`inventory-${item}`} aria-pressed={selected === item} onClick={() => selectItem(item)}>
                <span className={`inventory-category kind-${ITEM_KIND[item]}`}>{t[ITEM_KIND[item]]}</span>
                <ItemIcon item={item} /><b>{fr.items[item].name}</b><span className="inventory-count">×{inv[item]}</span>
              </button>)}
              {Array.from({ length: visible.length < 15 ? 15 - visible.length : (5 - visible.length % 5) % 5 }, (_, i) => <div key={`empty-${i}`} className="inventory-cell empty" aria-hidden="true" />)}
            </div>
          </section>
          <aside className="inventory-detail" data-testid="inventory-detail">
            {selected ? <>
              <span className={`inventory-category kind-${ITEM_KIND[selected]}`}>{t[ITEM_KIND[selected]]}</span>
              <div className="inventory-preview"><ItemIcon item={selected} /></div>
              <h2>{fr.items[selected].name}</h2>
              <p>{fr.items[selected].desc}</p>
              <div className="inventory-quantity"><span>{t.quantity}</span><b>×{inv[selected]}</b></div>
              <div className="inventory-detail-action">
                {canUseItem(selected) ? <button type="button" className="btn primary" data-testid="inventory-use" onClick={useSelectedItem}>
                  {actionLabel(selected, held, lampOn)} <kbd>{labelFor(keys, 'useSelected')}</kbd>
                </button> : <p className="inventory-passive">{t.passive}</p>}
                {ITEM_KIND[selected] === 'key' && !['lamp', 'manual'].includes(selected) && <small>{t.context}</small>}
              </div>
            </> : <><div className="inventory-preview"><ItemIcon item="survival" /></div><h2>{t.select}</h2><p>{t.emptyHint}</p></>}
          </aside>
        </div>
    </section>
  )
}

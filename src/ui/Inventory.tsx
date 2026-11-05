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
  const start = Math.max(0, Math.min(index - 3, items.length - 7))
  return (
    <section className="quick-inventory" data-testid="hotbar" data-hotbar aria-label={t.title}>
      <div className="quick-title">
        <span data-testid="selected-item-name">{selected ? fr.items[selected].name : t.empty}</span>
        {items.length > 0 && <small>{index + 1} / {items.length}</small>}
      </div>
      {items.length > 0 && <div className="quick-slots">
        <button type="button" className="quick-arrow" aria-label={t.previous} onClick={() => cycleItem(-1)}>‹</button>
        {items.slice(start, start + 7).map((item, i) => <button type="button" key={item}
          className={`slot ${selected === item ? 'selected' : ''}`} data-testid={`hotbar-${item}`}
          aria-label={`${fr.items[item].name} ×${inv[item]}`} aria-pressed={selected === item}
          title={fr.items[item].name} onClick={() => selectItem(item)}>
          <span className="num">{start + i < 9 ? start + i + 1 : ''}</span>
          <ItemIcon item={item} />
          <span className="cnt">×{inv[item]}</span>
          {(held === item || (item === 'lamp' && lampOn)) && <i className="quick-equipped" />}
        </button>)}
        <button type="button" className="quick-arrow" aria-label={t.next} onClick={() => cycleItem(1)}>›</button>
      </div>}
      <div className="quick-actions">
        <button type="button" onClick={openInventory} data-testid="open-inventory"><kbd>{pad ? padButtonName(padType, padKeys.inventory) : labelFor(keys, 'inventory')}</kbd> {t.title}</button>
        {selected && canUseItem(selected) && <button type="button" data-testid="hotbar-use" onClick={useSelectedItem}>
          <kbd>{pad ? padButtonName(padType, padKeys.useSelected) : labelFor(keys, 'useSelected')}</kbd> {actionLabel(selected, held, lampOn)}
        </button>}
        <span className="quick-wheel">{pad ? `${padButtonName(padType, padKeys.previousItem)} / ${padButtonName(padType, padKeys.nextItem)}` : t.wheel}</span>
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

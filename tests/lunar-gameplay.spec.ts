import { expect, test, type Page } from '@playwright/test'
import { MODULES, localPoint, lunarMap } from '../src/game/lunar/map'
import { ORDER_LABELS, TASKS, initialDraft, pipePorts, values } from '../src/game/lunar/puzzles'

test.setTimeout(240000)
async function boot(page: Page, menu = false) {
  page.setDefaultTimeout(30000)
  // menu : API injoignable pour jouer en invité
  if (menu) await page.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'high', resolution: 720, music: 0, voice: 0, sfx: 0, ambience: 0, browserVoice: false, map: 'base' })))
  await page.goto('/')
  await expect(page.getByTestId('launch')).toBeVisible()
  if (menu) { await page.getByTestId('map-base').click(); await page.getByTestId('start').click(); await page.getByTestId('guest').click(); await page.getByTestId('launch-mission').click(); await page.getByTestId('confirm-character').click() }
  else await page.evaluate(() => window.__game.start('nova', true, 'astronaut', false, 'base'))
  await ready(page)
  await page.evaluate(() => window.__game.set({ lunar: { ...window.__game.state().lunar, seed: 42 } }))
}
async function ready(page: Page) {
  await page.waitForFunction(() => window.__game.state().loading === 1 && window.__game.state().playerZone === 1, undefined, {timeout:60000})
  await expect(page.getByTestId('scene-loading')).toBeHidden()
}
async function scene(page: Page) {
  await page.evaluate(async (path) => { const { _roots } = await import(path); (window as any).lunarRoot = _roots.get(document.querySelector('canvas')).store.getState() }, '/node_modules/.vite/deps/@react-three_fiber.js')
}
async function interact(page: Page, id: string) {
  // Take the same action as E. Separate traversal/aim tests cover reachability.
  expect(await page.evaluate(id => window.__game.interact(id), id), id).toBe(true)
}
async function solve(page: Page, id: string, enter = false) {
  await interact(page, `l_${id}`)
  await expect(page.getByTestId(`lunar-puzzle-${id}`)).toBeVisible()
  const v = values(42), task = TASKS.find(t => t.id === id)!
  if (task.kind === 'code') await page.getByTestId('lunar-code').fill((id === 'manifest' ? v.digits : [v.digits[2],v.thermal[2],v.signal[1],4]).join(''))
  else if (task.kind === 'circuit') {
    const a = initialDraft(id,42)
    for(let i=0;i<16;i++) if (pipePorts(i, 0).length) for(let j=a[i];j<4;j++) await page.getByTestId(`lunar-pipe-${i}`).click()
    await expect(page.getByTestId('lunar-circuit-status')).toContainText('Liaison complète')
  } else if(task.kind==='loads') {
    for(const [i,n] of [0,2,1,2,1,0].entries()) await page.getByTestId(`lunar-load-${i}`).selectOption(String(n))
  } else if(['thermal','signal','fuel'].includes(task.kind)) {
    const answer = v[id as 'thermal'|'signal'|'fuel']
    for(const [i,n] of answer.entries()) await page.getByTestId(`lunar-value-${i}`).fill(String(n))
  } else if(task.kind==='order') {
    const a=initialDraft(id,42)
    for(let i=0;i<a.length;i++) { let j=a.indexOf(i); while(j>i) { await page.getByTestId(`lunar-up-${j}`).click(); [a[j-1],a[j]]=[a[j],a[j-1]]; j-- } }
    await expect(page.locator('.lunar-order li span')).toHaveText(ORDER_LABELS[id].map((n,i)=>`${i+1}. ${n}`))
  } else if(task.kind==='pressure') {
    for(const [from,to] of [[0,1],[1,2],[2,0],[1,2],[0,1],[1,2],[2,0]]) await page.getByTestId(`lunar-transfer-${from}-${to}`).click()
  } else if(task.kind==='route') for(const d of [1,0,0,1,0,0,1,1]) await page.getByTestId(`lunar-command-${d}`).click()
  if (enter) await page.getByTestId('lunar-code').press('Enter')
  else await page.getByTestId('lunar-submit').click()
  await expect(page.getByTestId('puzzle')).toBeHidden()
  expect(await page.evaluate(() => window.__game.state().lunar.solved)).toContain(id)
}

test('menu lunaire, tablette réelle, douze systèmes, sauvegarde et décollage', async ({page}) => {
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error' && /Shader|WebGL/.test(m.text()))errors.push(m.text())})
  await boot(page,true)
  expect(await page.evaluate(()=>window.__game.state().map)).toBe('base')
  await scene(page)
  await page.screenshot({path:'test-results/lunar-habitat.png'})
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('lunar-plan')).toBeVisible()
  await page.getByTestId('lunar-map-room-security').click()
  await page.screenshot({path:'test-results/lunar-tablet.png'})
  await page.keyboard.press('Tab')
  expect(await page.evaluate(()=>window.__game.interact('l_launch'))).toBe(false)
  expect(await page.evaluate(()=>window.__game.doorOpen('lunar_exterior'))).toBe(false)
  for(const id of ['lamp','fuse','wrench']) await interact(page,`li_${id}`)
  await page.evaluate(()=>window.__game.set({lampOn:true}))
  for(const e of lunarMap.ents.filter(e=>e.id.startsWith('ln_'))) { await interact(page,e.id); await expect(page.getByTestId('note')).toBeVisible(); await page.keyboard.press('KeyE') }
  await interact(page,'l_manifest')
  await page.getByTestId('lunar-code').fill('0000'); await page.getByTestId('lunar-submit').click()
  expect(await page.evaluate(()=>window.__game.state().errors)).toBe(1)
  await page.getByTestId('puzzle-close').click()
  await solve(page,'manifest'); await solve(page,'circuit'); await solve(page,'loads')
  expect(await page.evaluate(()=>window.__game.doorOpen('lunar_security'))).toBe(true)
  await page.evaluate(async path=>{const s=await import(path); s.saveGame(false)},'/src/game/state.ts')
  const before=await page.evaluate(()=>window.__game.state().lunar)
  await page.reload(); await page.waitForFunction(()=>!!window.__game)
  await page.evaluate(async ([state,menu])=>{const s=await import(state),m=await import(menu); await m.resumeGame(s.loadSave())},['/src/game/state.ts','/src/ui/Screens/Menu.tsx'])
  await ready(page)
  expect((await page.evaluate(()=>window.__game.state().lunar)).solved).toEqual(before.solved)
  expect((await page.evaluate(()=>window.__game.state().lunar)).seed).toBe(42)
  await interact(page,'li_cell'); await interact(page,'li_antenna')
  for(const id of ['thermal','identity','signal','filters','pressure','checklist','route','fuel']) await solve(page,id)
  expect(await page.evaluate(()=>window.__game.doorOpen('lunar_exterior'))).toBe(true)
  await page.evaluate(()=>window.__game.teleportXZ(35,80.5,Math.PI/2))
  await page.waitForFunction(()=>Math.abs(window.__game.live.pos[0]-35)<.1)
  await page.screenshot({path:'test-results/lunar-rocket.png'})
  await solve(page,'launch')
  // Interrupt at ignition, then restore the final save: no solved-terminal softlock.
  await page.reload(); await page.waitForFunction(()=>!!window.__game)
  await page.evaluate(async ([state,menu])=>{const s=await import(state),m=await import(menu); await m.resumeGame(s.loadSave())},['/src/game/state.ts','/src/ui/Screens/Menu.tsx'])
  await ready(page)
  await expect(page.getByTestId('skip')).toBeVisible(); await page.getByTestId('skip').click()
  await page.waitForFunction(()=>window.__game.state().screen==='end')
  expect(await page.evaluate(()=>({ended:window.__game.state().ended,ending:window.__game.state().ending}))).toEqual({ended:true,ending:'rescue'})
  await page.screenshot({path:'test-results/lunar-victory.png'})
  expect(errors).toEqual([])
})

test('liaison solaire résolue à partir des câbles visibles, depuis un brouillon sauvegardé', async ({page}) => {
  await boot(page)
  const draft = initialDraft('circuit', 127)
  await page.evaluate(draft => {
    window.__game.set({ lunar: { ...window.__game.state().lunar, solved: ['manifest'], drafts: { circuit: draft } } })
    window.__game.give('fuse')
  }, draft)
  await page.evaluate(async path => { const s = await import(path); s.saveGame(false) }, '/src/game/state.ts')
  await page.reload(); await page.waitForFunction(() => !!window.__game)
  await page.evaluate(async ([state, menu]) => { const s = await import(state), m = await import(menu); await m.resumeGame(s.loadSave()) }, ['/src/game/state.ts', '/src/ui/Screens/Menu.tsx'])
  await ready(page)
  expect(await page.evaluate(() => window.__game.state().lunar.drafts.circuit)).toEqual(draft)
  await interact(page, 'l_circuit')
  await expect(page.locator('.solar-circuit button:disabled')).toHaveCount(5)
  await expect(page.getByTestId('lunar-circuit-status')).not.toContainText('Liaison complète')

  // Solve only from the displayed segments, without importing the expected path.
  const ports = await page.locator('.solar-circuit button').evaluateAll(buttons => buttons.map(button =>
    button.hasAttribute('disabled') ? [] : Array.from(button.querySelectorAll('svg path')).map(path => {
      const end = path.getAttribute('d')!.split('L')[1]
      return ['30 0', '60 30', '30 60', '0 30'].indexOf(end)
    })))
  const count = ports.filter(p => p.length).length
  const search = (cell: number, incoming: number, seen: number[], turns: number[]): number[] | null => {
    if (seen.includes(cell) || !ports[cell]?.length) return null
    for (let turn = 0; turn < 4; turn++) {
      const rotated = ports[cell].map(d => (d + turn) % 4)
      if (!rotated.includes(incoming)) continue
      const outgoing = rotated.find(d => d !== incoming)!, nextTurns = [...turns]
      nextTurns[cell] = turn
      if (cell === 15 && outgoing === 1) {
        if (seen.length + 1 === count) return nextTurns
        continue
      }
      const x = cell % 4 + [0, 1, 0, -1][outgoing], y = Math.floor(cell / 4) + [-1, 0, 1, 0][outgoing]
      if (x < 0 || x > 3 || y < 0 || y > 3) continue
      const result = search(y * 4 + x, (outgoing + 2) % 4, [...seen, cell], nextTurns)
      if (result) return result
    }
    return null
  }
  const turns = search(0, 3, [], Array(16).fill(0))
  expect(turns, 'La grille affichée doit admettre un chemin complet').not.toBeNull()
  for (let i = 0; i < 16; i++) for (let n = 0; n < turns![i]; n++) await page.getByTestId(`lunar-pipe-${i}`).click()
  await expect(page.locator('.solar-circuit .powered')).toHaveCount(count)
  await expect(page.getByTestId('lunar-circuit-status')).toContainText('Liaison complète')
  await page.getByTestId('lunar-circuit-status').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/lunar-circuit-fixed.png' })
  await page.getByTestId('lunar-submit').click()
  await expect(page.getByTestId('puzzle')).toBeHidden()
  expect(await page.evaluate(() => window.__game.state().lunar.solved)).toContain('circuit')
  await interact(page, 'l_loads')
  await expect(page.getByTestId('lunar-puzzle-loads')).toBeVisible()
})

test('chaque document, terminal et objet est visible, atteignable et utilisable avec E', async({page})=>{
  await boot(page); await scene(page)
  await page.evaluate(all=>{window.__game.set({lunar:{...window.__game.state().lunar,solved:all}}); for(const id of ['fuse','wrench','antenna','cell'])window.__game.give(id)},TASKS.map(t=>t.id))
  for(const e of lunarMap.ents){
    const p=e.pos!, m=MODULES.find(m=>Math.hypot(p[0]-m.center[0],p[2]-m.center[1])<10)
    let dx=Math.sin(e.rot??0),dz=Math.cos(e.rot??0)
    if(e.item && m){const d=Math.hypot(m.center[0]-p[0],m.center[1]-p[2]); dx=(m.center[0]-p[0])/d; dz=(m.center[1]-p[2])/d}
    const start=[p[0]+dx*1.7,p[2]+dz*1.7]
    await page.evaluate(([x,z])=>window.__game.teleportXZ(x,z),start)
    await page.waitForFunction(([x,z])=>Math.hypot(window.__game.live.pos[0]-x,window.__game.live.pos[2]-z)<.2,start)
    await page.evaluate(p=>{
      const c=(window as any).lunarRoot.camera.position,dx=p[0]-c.x,dz=p[2]-c.z
      window.__game.live.yaw=Math.atan2(-dx,-dz);window.__game.live.pitch=Math.atan2(p[1]-c.y,Math.hypot(dx,dz))
    },[p[0],e.item?p[1]+.25:e.id.startsWith('ln_')?p[1]:1.3,p[2]])
    await expect.poll(()=>page.evaluate(()=>window.__game.live.aimed),{message:`Cible masquée : ${e.id}`,timeout:5000}).toBe(e.id)
    await page.keyboard.press('KeyE')
    if(e.item) expect(await page.evaluate(item=>window.__game.state().inv[item],e.item)).toBeGreaterThan(0)
    else if(e.id.startsWith('ln_')){await expect(page.getByTestId('note')).toBeVisible();await page.keyboard.press('KeyE')}
    else{await expect(page.getByTestId('puzzle')).toBeVisible();await page.getByTestId('puzzle-close').click()}
  }
})

test('les jonctions du hub et la passerelle vers la fusée se parcourent à pied', async({page})=>{
  await boot(page)
  await page.evaluate(all=>window.__game.set({lunar:{...window.__game.state().lunar,solved:all}}),TASKS.map(t=>t.id))
  for(const m of MODULES){
    const start=[41+Math.sin(m.angle)*3.5,41+Math.cos(m.angle)*3.5], end=[41+Math.sin(m.angle)*10,41+Math.cos(m.angle)*10]
    await page.evaluate(({start,yaw})=>window.__game.teleportXZ(start[0],start[1],yaw),{start,yaw:m.angle+Math.PI})
    await page.waitForFunction(([x,z])=>Math.hypot(window.__game.live.pos[0]-x,window.__game.live.pos[2]-z)<.2,start)
    await page.keyboard.down('ArrowUp')
    try{await page.waitForFunction(([x,z])=>Math.hypot(window.__game.live.pos[0]-x,window.__game.live.pos[2]-z)<.5,end,{timeout:10000})}finally{await page.keyboard.up('ArrowUp')}
  }
  await page.evaluate(()=>window.__game.teleportXZ(41,70,Math.PI))
  await page.waitForFunction(()=>Math.abs(window.__game.live.pos[2]-70)<.2)
  await page.keyboard.down('ArrowUp')
  try{await page.waitForFunction(()=>window.__game.live.pos[2]>80,{timeout:12000})}finally{await page.keyboard.up('ArrowUp')}
  await page.evaluate(()=>{window.__game.live.yaw=Math.PI/2})
  await page.keyboard.down('ArrowUp')
  try{await page.waitForFunction(()=>window.__game.live.pos[0]<29,{timeout:12000})}finally{await page.keyboard.up('ArrowUp')}
  expect(await page.evaluate(()=>window.__game.live.pos[1])).toBeGreaterThan(-.2)
  await page.screenshot({path:'test-results/lunar-surface.png'})
})

test('les cinq portes respectent les verrouillages et sont franchissables en diagonale', async({page})=>{
  await boot(page)
  const all=TASKS.map(t=>t.id)
  for(const m of MODULES){
    const start=localPoint(m.id,0,0,-m.depth/2-2.4), finish=localPoint(m.id,0,0,-m.depth/2+1.1)
    await page.evaluate(({start,yaw})=>{window.__game.set({lunar:{...window.__game.state().lunar,solved:[]}}); window.__game.teleportXZ(start[0],start[2],yaw)}, {start,yaw:m.angle+Math.PI})
    await page.waitForFunction(([x,z])=>Math.hypot(window.__game.live.pos[0]-x,window.__game.live.pos[2]-z)<.2,[start[0],start[2]])
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1200); await page.keyboard.up('ArrowUp')
    const closed=await page.evaluate(()=>window.__game.live.pos)
    const dist=Math.hypot(closed[0]-m.center[0],closed[2]-m.center[1])
    expect(dist,`${m.id} fermée`).toBeGreaterThan(m.depth/2)
    await page.evaluate(all=>window.__game.set({lunar:{...window.__game.state().lunar,solved:all}}),all)
    await page.keyboard.down('ArrowUp')
    try { await page.waitForFunction(([x,z])=>Math.hypot(window.__game.live.pos[0]-x,window.__game.live.pos[2]-z)<.7,[finish[0],finish[2]],{timeout:12000}) } finally {await page.keyboard.up('ArrowUp')}
    await page.screenshot({path:`test-results/lunar-entry-${m.id}.png`})
  }
  await scene(page)
  await page.evaluate(()=>window.__game.teleportXZ(41,41,Math.PI))
  await page.waitForFunction(()=>Math.abs(window.__game.live.pos[0]-41)<.1)
  await page.screenshot({path:'test-results/lunar-hub.png'})
  await page.evaluate(()=>window.__game.startEvent('blackout'))
  await page.waitForFunction(()=>(window as any).lunarRoot.scene.getObjectByName('lunar-light:hub').intensity<.01)
  await page.screenshot({path:'test-results/lunar-blackout.png'})
  await page.evaluate(()=>window.__game.drain(31))
  await page.waitForFunction(()=>(window as any).lunarRoot.scene.getObjectByName('lunar-light:hub').intensity>17)
})

test('les parois extérieures sont opaques et seuls les vrais hublots sont ouverts',async({page})=>{
  await boot(page);await scene(page)
  const checks=await page.evaluate(async modules=>{
    const T=await import('/node_modules/.vite/deps/three.js' as string), scene=(window as any).lunarRoot.scene
    scene.updateMatrixWorld(true)
    const out:{room:string;panels:boolean;windows:boolean;pbr:boolean}[]=[]
    for(const m of modules){
      const group=scene.getObjectByName(`lunar-module:${m.id}`),wall=group.getObjectByName('lunar-inner-wall'),hull=group.getObjectByName('lunar-outer-wall')
      const shoot=(x:number,y:number,z:number,dx:number,dz:number)=>{
        const origin=new T.Vector3(x,y,z).applyMatrix4(group.matrixWorld),dir=new T.Vector3(dx,0,dz).transformDirection(group.matrixWorld)
        return new T.Raycaster(origin,dir,0,.9).intersectObjects([wall,hull],false).length
      }
      out.push({room:m.id,panels:shoot(-m.width/2-.6,1.5,0,1,0)>0 && shoot(m.width/2+.6,1.5,0,-1,0)>0 && shoot(2,1.5,-m.depth/2-.6,0,1)>0,
        windows:shoot(-m.width/2-.6,1.5,m.depth/4,1,0)===0 && shoot(m.width/2+.6,1.5,-m.depth/4,-1,0)===0,
        pbr:!hull.material.transparent && hull.material.depthWrite && !!hull.material.map && !!hull.material.normalMap && !!hull.material.roughnessMap})
    }
    return out
  },MODULES)
  for(const result of checks){expect(result.panels,result.room).toBe(true);expect(result.windows,result.room).toBe(true);expect(result.pbr,result.room).toBe(true)}
})

test('décollage complet avec moteur animé et bilan des douze épreuves lisible',async({page})=>{
  await boot(page);await scene(page)
  await page.evaluate(all=>{window.__game.set({lunar:{...window.__game.state().lunar,solved:all},splits:Object.fromEntries(all.map(id=>['l_'+id,0]))});window.__game.teleportXZ(35,80.5,Math.PI/2)},TASKS.filter(t=>t.id!=='launch').map(t=>t.id))
  await solve(page,'launch',true)
  await page.waitForFunction(()=>(window as any).lunarRoot.scene.getObjectByName('lunar-rocket-body').position.y>1)
  expect(await page.evaluate(()=>(window as any).lunarRoot.scene.getObjectByName('lunar-engine-plume').visible)).toBe(true)
  await page.screenshot({path:'test-results/lunar-liftoff.png'})
  await expect(page.getByTestId('end')).toBeVisible({timeout:20000})
  const last=await page.locator('.rp-step').last().boundingBox(),panel=await page.locator('.rp-progress').boundingBox()
  expect(last!.y+last!.height).toBeLessThan(panel!.y+panel!.height-20)
  await page.screenshot({path:'test-results/lunar-victory.png'})
})

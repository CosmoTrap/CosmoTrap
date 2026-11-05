import { expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'

test('migration des anciennes parties, indices, ressources et reprise restent cohérents', async({page})=>{
  await page.goto('/'); await page.waitForFunction(()=>!!window.__game)
  const result=await page.evaluate(async()=>{
    const s=await import('/src/game/state.ts' as string),logic=await import('/src/game/logic.ts' as string), lunar=await import('/src/game/lunar/logic.ts' as string)
    const old=s.newGameData('nova','astronaut','base'); delete old.campaignVersion; delete old.lunar
    old.flags.lockerOpen=true; old.zone=2
    const migrated=s.normalizeSave(old)
    const data=s.newGameData('nova','astronaut','base'); data.lunar.seed=42;data.lunar.solved=['manifest','circuit'];data.lunar.drafts.pressure=[3,2,3]
    const restored=s.normalizeSave({...data,pos:[41,0,15],yaw:1.2})
    window.__game.start('kenji',true,'survival',false,'base')
    lunar.lunarAct('l_manifest');lunar.setLunarDraft('manifest',[0,0,0,0]);lunar.submitLunar('manifest')
    const penalty=s.G().penalty
    const first=logic.hintFor(1),second=logic.hintFor(2)
    window.__game.set({screen:'playing',loading:1,cine:null,puzzle:null,difficulty:'astronaut',character:'nova',lunar:{...data.lunar,solved:['manifest','circuit','loads','filters']}})
    s.live.roomId='eva'; window.__game.give('water',2); window.__game.give('o2',2)
    // 20 minutes, with the same survival actions available to a real player.
    window.__game.drain(600); logic.drinkPouch();window.__game.drain(600);logic.drinkPouch()
    return {old:{map:migrated.map,zone:migrated.zone,locker:migrated.flags.lockerOpen},restored:{map:restored.map,lunar:restored.lunar,pos:restored.pos},penalty,first,second,res:s.G().res,ended:s.G().ended,cine:s.G().cine}
  })
  expect(result.old).toEqual({map:'station',zone:2,locker:true})
  expect(result.restored.map).toBe('base'); expect(result.restored.lunar.seed).toBe(42)
  expect(result.restored.lunar.solved).toEqual(['manifest','circuit']);expect(result.restored.lunar.drafts.pressure).toEqual([3,2,3]);expect(result.restored.pos).toEqual([41,0,15])
  expect(result.penalty).toBe(15);expect(result.first).not.toBe(result.second)
  expect(result.res.o2).toBeGreaterThan(70);expect(result.res.water).toBeGreaterThan(40);expect(result.ended).toBe(false);expect(result.cine).toBeNull()
})

test('qualité haute conservée, décors regroupés et mesure du coût des vues lunaires',async({page})=>{
  test.setTimeout(180000)
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>localStorage.setItem('cosmotrap.settings.v1',JSON.stringify({quality:'high',resolution:720,music:0,voice:0,sfx:0,ambience:0,ghost:false})))
  await page.goto('/'); await page.waitForFunction(()=>!!window.__game)
  const start=Date.now()
  await page.evaluate(()=>window.__game.start('nova',true,'astronaut',false,'base'))
  await page.waitForFunction(()=>window.__game.state().loading===1)
  const loadingMs=Date.now()-start
  await page.evaluate(async()=>{
    const {_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string),store=_roots.get(document.querySelector('canvas')).store,w=window as any
    w.sample={rows:[],active:false,start:0};w.renderStore=store;store.getState().gl.info.autoReset=false
    store.getState().internal.subscribers.push({priority:-1000,store,ref:{current:({gl}:any)=>{gl.info.reset();w.sample.start=performance.now()}}})
    store.getState().internal.subscribers.push({priority:2,store,ref:{current:({gl}:any,dt:number)=>{if(w.sample.active)w.sample.rows.push({ms:dt*1000,cpu:performance.now()-w.sample.start,calls:gl.info.render.calls,triangles:gl.info.render.triangles,textures:gl.info.memory.textures})}}})
    store.getState().internal.subscribers.sort((a:any,b:any)=>a.priority-b.priority)
  })
  const report:any={loadingMs,views:[]}
  for(const [name,x,z,yaw] of [['habitat',17,41,Math.PI/2],['hub',41,41,0],['surface',35,80.5,Math.PI/2]] as const){
    await page.evaluate(({x,z,yaw})=>window.__game.teleportXZ(x,z,yaw),{x,z,yaw})
    await page.waitForTimeout(800)
    await page.evaluate(()=>{const s=(window as any).sample;s.rows=[];s.active=true})
    await page.waitForFunction(()=>(window as any).sample.rows.length>=120)
    const rows=await page.evaluate(()=>{const s=(window as any).sample;s.active=false;return s.rows})
    const avg=(key:string)=>rows.reduce((n:number,r:any)=>n+r[key],0)/rows.length,ms=rows.map((r:any)=>r.ms).sort((a:number,b:number)=>a-b)
    report.views.push({name,frameMs:avg('ms'),p95:ms[Math.floor(ms.length*.95)],cpuMs:avg('cpu'),drawCalls:avg('calls'),triangles:avg('triangles'),textures:avg('textures')})
  }
  const info=await page.evaluate(()=>{
    const {gl,scene}=(window as any).renderStore.getState(),context=gl.getContext(),ext=context.getExtension('WEBGL_debug_renderer_info')
    let batches=0,sources=0;scene.traverse((o:any)=>{if(o.userData.staticBatch)batches++;if(o.userData.staticBatchSource)sources++})
    return{gpu:ext?context.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',size:[gl.domElement.width,gl.domElement.height],batches,sources}
  })
  Object.assign(report,info);console.log(JSON.stringify(report));writeFileSync('test-results/lunar-performance.json',JSON.stringify(report,null,2))
  expect(info.size).toEqual([1280,720]);expect(info.batches).toBeGreaterThan(10);expect(info.sources).toBeGreaterThan(info.batches)
  expect(errors).toEqual([])
})

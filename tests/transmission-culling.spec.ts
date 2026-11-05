import { expect, test } from '@playwright/test'
import { coveredByTriangle } from '../src/world/TransmissionCulling'

test('occlusion conservative : couverture entière et profondeur strictement devant', () => {
  const t: [number,number,number,number,number,number,number] = [-1,-1,1,-1,0,1,.2]
  expect(coveredByTriangle([-.1,-.2,.1,0,.5],t)).toBe(true)
  expect(coveredByTriangle([-.1,-.2,.1,0,.1],t)).toBe(false)
  expect(coveredByTriangle([-.1,-.2,.8,.8,.5],t)).toBe(false)
  expect(coveredByTriangle([-.1,-.2,.1,0,.200001],t)).toBe(false)
})

test('la réfraction cachée ne redessine plus la scène ; fenêtres et ombres conservées', async ({page})=>{
 await page.goto('/')
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js' as string)
  const {installTransmissionCulling}=await import('/src/world/TransmissionCulling.tsx' as string)
  const renderer=new T.WebGLRenderer(),scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,.1,50),target=new T.WebGLRenderTarget(128,128)
  renderer.shadowMap.enabled=true;renderer.info.autoReset=false;camera.position.set(0,0,6);camera.lookAt(0,0,0)
  scene.add(new T.HemisphereLight(0xffffff,0x444444,2))
  const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(4,5,4);sun.castShadow=true;scene.add(sun)
  const root=new T.Group();scene.add(root)
  const wallMat=new T.MeshStandardMaterial({color:0x778899,side:T.DoubleSide})
  const wall=new T.Mesh(new T.PlaneGeometry(8,8),wallMat);wall.renderOrder=-1;wall.receiveShadow=true;root.add(wall)
  const solidGeometry=wall.geometry, gapGeometry=new T.BufferGeometry()
  gapGeometry.setAttribute('position',new T.Float32BufferAttribute([-4,-4,0, 4,-4,0, -4,4,0, -4,-4,0, 4,-4,0, 4,4,0],3));gapGeometry.computeVertexNormals()
  const glass=new T.Mesh(new T.SphereGeometry(.4,24,16),new T.MeshPhysicalMaterial({transmission:1,roughness:.1,thickness:.2}))
  glass.position.set(0,0,-2);glass.castShadow=true;root.add(glass)
  const box=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0xffaa22}));box.position.set(2,1,-3);root.add(box)
  let enabled=false;const dispose=installTransmissionCulling(renderer,scene,camera,root,()=>enabled)
  const cases: {situation:string;calls:number[];shadowDraws:number[];mean:number;different:number;bright:number}[]=[]
  try {
   for(const situation of ['behind-wall','visible-side','window','near-camera','moved-wall','offscreen','overlapping-triangles']){
    wall.geometry=situation==='overlapping-triangles'?gapGeometry:solidGeometry
    glass.position.set(situation==='offscreen'?15:situation==='visible-side'?6:0,situation==='overlapping-triangles'?3:0,situation==='near-camera'?5.85:-2)
    wall.position.x=situation==='window'?8:0
    root.position.x=situation==='moved-wall'?.3:0
    const pixels:Uint8Array[]=[],calls:number[]=[],shadowDraws:number[]=[]
    for(const optimize of [false,true]){
     enabled=optimize;let n=0;glass.onBeforeShadow=()=>n++
     renderer.info.reset();renderer.setRenderTarget(target);renderer.render(scene,camera)
     calls.push(renderer.info.render.calls);shadowDraws.push(n)
     const p=new Uint8Array(128*128*4);renderer.readRenderTargetPixels(target,0,0,128,128,p);pixels.push(p)
     if(!glass.visible)throw new Error('Visibilité non restaurée')
    }
    let sum=0,different=0,bright=0
    pixels[0].forEach((v,i)=>{const d=Math.abs(v-pixels[1][i]);sum+=d;if(d>2)different++;if(i%4!==3)bright+=v})
    cases.push({situation,calls,shadowDraws,mean:sum/pixels[0].length,different:different/pixels[0].length,bright})
   }
   return cases
  }finally{dispose();scene.traverse((o:any)=>{o.geometry?.dispose();o.material?.dispose();o.shadow?.map?.dispose()});solidGeometry.dispose();gapGeometry.dispose();target.dispose();renderer.dispose();renderer.forceContextLoss()}
 })
 for(const r of result){expect(r.mean,r.situation).toBeLessThan(.02);expect(r.different,r.situation).toBeLessThan(.0005);expect(r.shadowDraws[1]).toBe(r.shadowDraws[0]);expect(r.bright).toBeGreaterThan(1000)}
 expect(result[0].calls[1]).toBeLessThan(result[0].calls[0])
 expect(result.find(r=>r.situation==='window')!.calls[1]).toBe(result.find(r=>r.situation==='window')!.calls[0])
})

test('le vrai décor conserve ses pixels depuis le hub, le sas et près d’un vitrage',async({page})=>{
 test.setTimeout(180000)
 await page.addInitScript(()=>localStorage.setItem('cosmotrap.settings.v1',JSON.stringify({quality:'high',resolution:720,music:0,voice:0,sfx:0,ambience:0})))
 await page.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
 await page.goto('/');await expect(page.getByTestId('launch')).toBeVisible();await page.getByTestId('start').click();await page.getByTestId('guest').click()
 await page.evaluate(()=>{window.__game.start();window.__game.set({toured:[1,2,3,4],cine:null})})
 await page.waitForFunction(()=>window.__game.state().loading===1)
 await page.waitForTimeout(100)
 const results=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js' as string),{_roots}=await import('/node_modules/.vite/deps/@react-three_fiber.js' as string)
  const {gl,scene,camera}=_roots.get(document.querySelector('canvas')).store.getState(),target=new T.WebGLRenderTarget(320,180)
  const oldTarget=gl.getRenderTarget(),oldClear=gl.autoClear,oldPosition=camera.position.clone(),oldRotation=camera.quaternion.clone()
  const views=[{name:'hub',position:new T.Vector3(44,1.6,41),look:new T.Vector3(65,1.6,41)},
    {name:'sas',position:new T.Vector3(56,1.6,41),look:new T.Vector3(65,1.6,41)}]
  const glass:any[]=[];scene.updateMatrixWorld(true);scene.traverseVisible((o:any)=>{if(o.isMesh&&o.material?.transmission>0)glass.push(o)})
  if(!glass.length)throw new Error('Aucun vitrage à tester')
  const p=glass[0].getWorldPosition(new T.Vector3());views.push({name:'vitrage proche',position:p.clone().add(new T.Vector3(0,0,1)),look:p})
  const results: {name:string;mean:number;different:number;bright:number;glassVisible:boolean}[]=[]
  try{
   gl.autoClear=true
   for(const view of views){
    camera.position.copy(view.position);camera.lookAt(view.look);camera.updateMatrixWorld(true)
    const pixels:Uint8Array[]=[]
    for(const loading of [0,1]){
     window.__game.set({loading});gl.setRenderTarget(target);gl.render(scene,camera)
     const data=new Uint8Array(320*180*4);gl.readRenderTargetPixels(target,0,0,320,180,data);pixels.push(data)
    }
    let sum=0,different=0,bright=0;pixels[0].forEach((v,i)=>{const d=Math.abs(v-pixels[1][i]);sum+=d;if(d>2)different++;if(i%4!==3)bright+=v})
    results.push({name:view.name,mean:sum/pixels[0].length,different:different/pixels[0].length,bright,glassVisible:glass.every(o=>o.visible)})
   }
   return results
  }finally{window.__game.set({loading:1});camera.position.copy(oldPosition);camera.quaternion.copy(oldRotation);camera.updateMatrixWorld(true);gl.autoClear=oldClear;gl.setRenderTarget(oldTarget);target.dispose()}
 })
 for(const r of results){expect(r.mean,r.name).toBeLessThan(.02);expect(r.different,r.name).toBeLessThan(.0005);expect(r.bright).toBeGreaterThan(1000);expect(r.glassVisible).toBe(true)}
})

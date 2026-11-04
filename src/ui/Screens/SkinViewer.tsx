import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Skin } from './Stage'

// Aperçu 3D d'un skin, fixe et de face : maillage TripoSR, avec l'image nette projetée sur l'avant.
// Le canal alpha des couleurs de sommets donne le poids de cette projection.

/** skins dont le modèle 3D est disponible dans public/skins/3d */
const READY = new Set(['maya'])

interface Loaded {
  scene: THREE.Group
  dispose: () => void
}

async function loadSkin(id: string): Promise<Loaded> {
  const [gltf, front] = await Promise.all([new GLTFLoader().loadAsync(`/skins/3d/${id}.glb`), new THREE.TextureLoader().loadAsync(`/skins/3d/${id}-front.jpg`)])
  front.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7 })
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tFront = { value: front }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 color;varying vec4 vC;varying vec2 vU;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvC=color;vU=uv;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tFront;varying vec4 vC;varying vec2 vU;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb=mix(vC.rgb,texture2D(tFront,vU).rgb,vC.a);')
  }
  mat.customProgramCacheKey = () => 'skin-front-projection'
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat
  })
  return {
    scene: gltf.scene,
    dispose: () => {
      gltf.scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
      mat.dispose()
      front.dispose()
    },
  }
}

export function SkinViewer({ id }: { id: string }) {
  const [model, setModel] = useState<Loaded | null>(null)
  useEffect(() => {
    setModel(null)
    if (!READY.has(id)) return
    let live = true
    let loaded: Loaded | null = null
    loadSkin(id)
      .then((m) => {
        loaded = m
        if (live) setModel(m)
        else m.dispose()
      })
      .catch(() => {
        /* modèle indisponible : on garde l'image */
      })
    return () => {
      live = false
      loaded?.dispose()
    }
  }, [id])
  if (!model) return <Skin id={id} />
  return (
    <div className="sp-viewer" data-testid="skin-3d">
      {/* offsetSize : la scène des menus est mise à l'échelle par CSS */}
      <Canvas frameloop="demand" resize={{ offsetSize: true }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]} camera={{ fov: 30, position: [0, 0, 3.5] }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[1.5, 3, 5]} intensity={2} />
        <directionalLight position={[-2, 1, -4]} intensity={0.7} color="#ffb48f" />
        <primitive object={model.scene} position={[0, -0.8, 0]} />
      </Canvas>
    </div>
  )
}

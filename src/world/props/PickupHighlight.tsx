import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

/** The rhythm shared by every pickup, so they all breathe together. */
const pulse = { value: 1 }

/**
 * A thin golden line round the object's silhouette, and nothing on its surface: the object keeps its own
 * materials and textures. Each vertex is pushed out from the mesh's centre by a constant on-screen width,
 * and only the back faces are drawn, so the line shows just beyond the visible outline (an "inverted hull").
 * Pushing from the centre rather than along the normals keeps the hull closed at hard corners.
 */
const COLOR = { value: new THREE.Color('#ffc35a') }, WIDTH = { value: 0.0058 }
const VERTEX = `
  uniform float uWidth;
  uniform vec3 uCentre;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 away = (modelViewMatrix * vec4(position - uCentre, 0.0)).xyz;
    float len = length(away);
    if (len > 1e-5) mv.xyz += away / len * uWidth * max(-mv.z, 0.3);
    gl_Position = projectionMatrix * mv;
  }`
const FRAGMENT = `
  uniform vec3 uColor;
  uniform float uPulse;
  void main() { gl_FragColor = vec4(uColor * (0.75 + 0.6 * uPulse), 1.0); }`
/** One material per outlined mesh (its own centre); all share one compiled program and the pulse. */
function outlineMaterial(centre: THREE.Vector3) {
  const m = new THREE.ShaderMaterial({ uniforms: { uPulse: pulse, uColor: COLOR, uWidth: WIDTH, uCentre: { value: centre } }, vertexShader: VERTEX, fragmentShader: FRAGMENT, side: THREE.BackSide })
  m.userData.pickupHighlight = true
  return m
}

/** Outlines every mesh of a pickup with the shared line. Its own materials are never touched. */
export function highlightPickups(root: THREE.Group) {
  const outlines = new Map<THREE.Mesh, THREE.Mesh>()
  return {
    refresh() {
      root.traverseVisible(object => {
        const mesh = object as THREE.Mesh
        if (!mesh.isMesh || outlines.has(mesh) || mesh.userData.pickupOutline || (mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        if (materials.every(m => m.transparent)) return
        const geometry = mesh.geometry
        geometry.computeBoundingBox()
        const line = new THREE.Mesh(geometry, outlineMaterial(geometry.boundingBox!.getCenter(new THREE.Vector3())))
        line.name = 'pickup-outline'
        line.userData.pickupOutline = true
        line.raycast = () => {}
        line.renderOrder = mesh.renderOrder
        mesh.add(line)
        outlines.set(mesh, line)
      })
    },
    dispose() {
      outlines.forEach(line => { line.removeFromParent(); (line.material as THREE.Material).dispose() })
      outlines.clear()
    },
  }
}

export function PickupHighlight({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null)
  const effect = useRef<ReturnType<typeof highlightPickups> | null>(null)
  const nextCheck = useRef(0)
  useLayoutEffect(() => {
    if (!root.current) return
    const highlight = highlightPickups(root.current)
    effect.current = highlight
    highlight.refresh()
    return () => { effect.current = null; highlight.dispose() }
    // Once per pickup: re-rendering the parent (any game flag change) used to dispose and rebuild every
    // outline, recompiling shaders mid-game. Models arriving later are caught by the periodic refresh.
  }, [])
  useFrame(({ clock }) => {
    pulse.value = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4), 2)
    // A GLTF may appear later inside its own Suspense boundary. Check twice per
    // second, reusing all existing materials instead of traversing every frame.
    if (clock.elapsedTime < nextCheck.current) return
    nextCheck.current = clock.elapsedTime + 0.5
    effect.current?.refresh()
  })
  return <group ref={root} name="pickup-highlight">{children}</group>
}

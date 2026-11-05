import { ShaderChunk } from 'three'

/** Three r170 evaluates the BRDF even when a local light's contribution is exactly
 * zero (outside its range/cone, or switched off). Skip that work, with no distance
 * approximation or change to the lights, reflections, shadows or material model. */
export function skipUnlitBRDF(source: string) {
  return source.replaceAll(
    'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
    'if ( directLight.visible ) { RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight ); }',
  )
}

// Install before any material is compiled, including materials loaded from GLTF.
ShaderChunk.lights_fragment_begin = skipUnlitBRDF(ShaderChunk.lights_fragment_begin)

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

/** Reject strictly zero contributions before normalisation, attenuation and
 * shadow sampling. In the station most lamps are off or in another room. The
 * original Three equations are retained verbatim for every contributing light. */
export function skipInactiveLights(source: string) {
  for (const light of ['pointLight', 'spotLight']) {
    const vector = `vec3 lVector = ${light}.position - geometryPosition;`
    source = source.replace(vector, `${vector}
      if (${light}.color == vec3(0.0) || (${light}.distance > 0.0 && dot(lVector, lVector) >= ${light}.distance * ${light}.distance)) {
        light.color = vec3(0.0);
        light.direction = vec3(0.0, 0.0, 1.0);
        light.visible = false;
        return;
      }`)
  }
  return source.replace('light.visible = true;', 'light.visible = (directionalLight.color != vec3(0.0));')
}

// Install before any material is compiled, including materials loaded from GLTF.
ShaderChunk.lights_fragment_begin = skipUnlitBRDF(ShaderChunk.lights_fragment_begin)
ShaderChunk.lights_pars_begin = skipInactiveLights(ShaderChunk.lights_pars_begin)

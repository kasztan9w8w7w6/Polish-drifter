import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Clean 3D pixel art ("diorama" look), built on the official three.js example webgl_postprocessing_pixel (MIT):
// - RenderPixelatedPass: low-res render with nearest upscaling + outlines from depth and normals,
// - the camera is snapped to the pixel grid (pixelAlignFrustum, in camera.ts) so pixels don't shimmer,
// - MeshToonMaterial with an N-step gradient map (webgl_materials_toon example) = shading in a few bands,
// - a small final pass that posterizes brightness into the same number of bands (light pools get stepped
//   edges too) with an optional ordered dither between bands,
// - radial night fog around the car (see installRadialFog) – the darkness comes from the fog, not from
//   dim lights, so the lit car and road stay readable.
// PS1 vertex snapping stays available as an option (off by default).

export const pixelArt = {
  pixelSize: 4, // screen pixels per game pixel
  edges: 0.45, // outline strength (normal edges)
  depthEdges: 0.35, // outline strength (depth edges / silhouettes)
  steps: 4, // brightness bands (toon gradient + posterize)
  posterize: 0.6, // 0..1 how hard the final brightness is snapped to the bands (0 = off)
  dither: 0.15, // 0..1 ordered dither between the bands
  snap: 0, // PS1 vertex snapping grid (0 = off)
};

// ---------- Radial fog ----------
// Built-in linear THREE.Fog is repurposed (only its uniforms are used, so every built-in material –
// toon, sprites, skid marks – gets it without patching):
//   fog.near = distance from the camera to the fog centre along the view axis (set by the camera rig),
//   fog.far  = visibility radius around that centre (exp² falloff, ~5 % left at `far`).
// The centre is the point the camera looks at, i.e. the car, so an orthographic diorama camera gets a
// pool of visibility around the car instead of uniform fog.
export function installRadialFog() {
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;
  C.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWorld = transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[ 3 ].xyz );
#endif`;
  C.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  C.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    vec3 fogFwd = - vec3( viewMatrix[ 0 ][ 2 ], viewMatrix[ 1 ][ 2 ], viewMatrix[ 2 ][ 2 ] );
    vec3 fogCentre = cameraPosition + fogFwd * fogNear;
    float fogD = distance( vFogWorld.xz, fogCentre.xz ) * 1.73 / fogFar;
    float fogFactor = 1.0 - exp( - fogD * fogD );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
}

// ---------- Toon materials ----------
let gradientMap = makeGradient(pixelArt.steps);
const toonMaterials = new Set();
const snapUniform = { value: pixelArt.snap };

function makeGradient(steps) {
  const n = Math.max(2, Math.round(steps));
  const data = new Uint8Array(n);
  // Darkest band isn't black: shadowed sides stay readable
  for (let i = 0; i < n; i++) data[i] = Math.round((0.25 + (0.75 * i) / (n - 1)) * 255);
  const tex = new THREE.DataTexture(data, n, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// Swap lit materials for MeshToonMaterial (keeping colour, textures, emissive, transparency) and make every
// texture nearest-filtered. Call after adding objects; already converted materials are reused.
const converted = new Map();
export function pixelizeScene(root) {
  root.traverse((obj) => {
    if (!obj.material) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    const out = list.map((m) => {
      if (m.userData.pixel) return m;
      if (converted.has(m)) return converted.get(m);
      let r = m;
      if (m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial) {
        r = new THREE.MeshToonMaterial({
          name: m.name,
          color: m.color,
          map: m.map,
          emissive: m.emissive,
          emissiveMap: m.emissiveMap,
          emissiveIntensity: m.emissiveIntensity,
          transparent: m.transparent,
          opacity: m.opacity,
          alphaTest: m.alphaTest,
          side: m.side,
          vertexColors: m.vertexColors,
          depthWrite: m.depthWrite,
          polygonOffset: m.polygonOffset,
          polygonOffsetFactor: m.polygonOffsetFactor,
          gradientMap,
        });
        toonMaterials.add(r);
      }
      for (const key of ['map', 'emissiveMap']) {
        const tex = r[key];
        if (tex) {
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestMipmapNearestFilter;
          tex.anisotropy = 1;
          tex.needsUpdate = true;
        }
      }
      if (r.isMeshToonMaterial || r.isMeshBasicMaterial) addVertexSnap(r);
      r.userData.pixel = true;
      converted.set(m, r);
      return r;
    });
    obj.material = Array.isArray(obj.material) ? out : out[0];
  });
}

// Optional PS1 wobble: snap clip-space vertices to a coarse grid (onBeforeCompile patch, off when snap = 0)
function addVertexSnap(m) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = snapUniform;
    shader.vertexShader = shader.vertexShader.replace('void main() {', 'uniform float uSnap;\nvoid main() {').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      if (uSnap > 0.0) {
        vec2 grid = vec2(uSnap * (projectionMatrix[1][1] / projectionMatrix[0][0]), uSnap) * 0.5;
        gl_Position.xy = floor(gl_Position.xy / gl_Position.w * grid + 0.5) / grid * gl_Position.w;
      }`,
    );
  };
  m.needsUpdate = true;
}

// ---------- Final pass: brightness bands + ordered dither ----------
const BandShader = {
  uniforms: { tDiffuse: { value: null }, steps: { value: 4 }, amount: { value: 0.6 }, dither: { value: 0.25 }, pixelSize: { value: 4 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float steps, amount, dither, pixelSize;
    varying vec2 vUv;
    float bayer4(vec2 p) {
      int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
      int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
      return float(m[x + y * 4]) / 16.0 - 0.5;
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = max(max(c.r, c.g), c.b);
      if (l > 0.002 && amount > 0.0) {
        // Snap brightness (not hue) to bands; the dither decides pixel by pixel near a band edge
        float d = bayer4(floor(gl_FragCoord.xy / pixelSize)) * dither;
        float lq = clamp(floor(l * steps + 0.5 + d) / steps, 0.0, 1.0);
        lq = max(lq, 0.5 / steps * step(0.02, l)); // don't crush dim-but-lit pixels to black
        c.rgb = mix(c.rgb, c.rgb * (lq / l), amount);
      }
      gl_FragColor = c;
    }`,
};

export function createPixelComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const pixel = new RenderPixelatedPass(pixelArt.pixelSize, scene, camera, { normalEdgeStrength: pixelArt.edges, depthEdgeStrength: pixelArt.depthEdges });
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.25, 0.3, 0.9);
  const bands = new ShaderPass(BandShader);
  composer.addPass(pixel);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(bands);

  let steps = pixelArt.steps;
  function apply() {
    const px = Math.max(1, Math.round(pixelArt.pixelSize));
    pixel.setPixelSize(px);
    pixel.normalEdgeStrength = pixelArt.edges;
    pixel.depthEdgeStrength = pixelArt.depthEdges;
    bands.uniforms.steps.value = Math.max(2, Math.round(pixelArt.steps)) + 1;
    bands.uniforms.amount.value = pixelArt.posterize;
    bands.uniforms.dither.value = pixelArt.dither;
    bands.uniforms.pixelSize.value = px;
    snapUniform.value = pixelArt.snap;
    if (Math.round(pixelArt.steps) !== steps) {
      steps = Math.round(pixelArt.steps);
      gradientMap.dispose();
      gradientMap = makeGradient(steps);
      for (const m of toonMaterials) m.gradientMap = gradientMap;
    }
  }
  apply();
  return {
    composer,
    bloom,
    pixel,
    apply,
    setCamera(cam) {
      pixel.camera = cam;
    },
  };
}

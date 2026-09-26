import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// PS1 look assembled from three/addons:
// - RenderPixelatedPass renders at 1/pixelSize resolution with nearest upscaling (+ soft edge lines so the
//   car and road edges stay readable),
// - UnrealBloomPass for the lamps and the shop sign,
// - OutputPass (tone mapping + sRGB),
// - a tiny ShaderPass: 15-bit colour (5 bits per channel, like the PS1) with 4×4 ordered dithering.
// Vertex snapping ("wobbly" polygons) is a short onBeforeCompile patch on the standard materials.

export const ps1 = {
  pixelSize: 3, // screen pixels per game pixel (3 ≈ 320×180 at 960×540)
  snap: 160, // vertex grid (vertical resolution the vertices snap to); 0 = off
  dither: 1, // 0..1 strength of the ordered dither
  colorBits: 5, // bits per channel after dithering
  edges: 0.35, // edge lines of RenderPixelatedPass (normal and depth)
};

const snapUniform = { value: ps1.snap };

const DitherShader = {
  uniforms: { tDiffuse: { value: null }, strength: { value: ps1.dither }, levels: { value: 31 }, pixelSize: { value: ps1.pixelSize } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength, levels, pixelSize;
    varying vec2 vUv;
    float bayer4(vec2 p) {
      int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
      int i = x + y * 4;
      int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
      return float(m[i]) / 16.0 - 0.5;
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = bayer4(floor(gl_FragCoord.xy / pixelSize)) * strength;
      c.rgb = floor(c.rgb * levels + 0.5 + d) / levels;
      gl_FragColor = c;
    }`,
};

export function createPS1Composer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const pixel = new RenderPixelatedPass(ps1.pixelSize, scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.3, 0.85);
  const dither = new ShaderPass(DitherShader);
  composer.addPass(pixel);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(dither);

  function apply() {
    pixel.setPixelSize(Math.max(1, Math.round(ps1.pixelSize)));
    pixel.normalEdgeStrength = ps1.edges;
    pixel.depthEdgeStrength = ps1.edges;
    dither.uniforms.strength.value = ps1.dither;
    dither.uniforms.levels.value = 2 ** Math.round(ps1.colorBits) - 1;
    dither.uniforms.pixelSize.value = Math.max(1, Math.round(ps1.pixelSize));
    snapUniform.value = ps1.snap;
  }
  apply();
  return { composer, bloom, pixel, apply };
}

// PS1 vertex snapping + nearest-neighbour textures for everything already in the scene.
// Call again after adding new objects (e.g. loaded GLBs); patched materials are skipped.
export function ps1ifyScene(root) {
  root.traverse((obj) => {
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) {
      if (m.userData.ps1) continue;
      m.userData.ps1 = true;
      for (const key of ['map', 'emissiveMap']) {
        const tex = m[key];
        if (tex) {
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestMipmapNearestFilter;
          tex.anisotropy = 1;
          tex.needsUpdate = true;
        }
      }
      if (!(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshBasicMaterial || m.isMeshPhongMaterial)) continue;
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uSnap = snapUniform;
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', 'uniform float uSnap;\nvoid main() {')
          .replace(
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
  });
}

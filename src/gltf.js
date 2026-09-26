import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Loads our .gltf files (JSON with the geometry buffer embedded as a base64 data: URI).
// The artifact page's security policy blocks fetch() of data: URIs, which is how GLTFLoader reads
// embedded buffers, so we fetch the JSON ourselves (a normal same-origin request), decode the buffer
// and hand GLTFLoader a GLB built in memory. Textures stay separate .png files next to the model.
const loader = new GLTFLoader();

export async function loadGltf(url) {
  const abs = new URL(url, location.href);
  const res = await fetch(abs);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const json = await res.json();
  let bin = null;
  const b = json.buffers?.[0];
  if (b?.uri?.startsWith('data:')) {
    const raw = atob(b.uri.slice(b.uri.indexOf(',') + 1));
    bin = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
    delete b.uri;
  }
  const base = abs.href.slice(0, abs.href.lastIndexOf('/') + 1);
  return loader.parseAsync(bin ? toGlb(json, bin) : JSON.stringify(json), base);
}

// GLB container: 12-byte header, JSON chunk (space-padded), BIN chunk (zero-padded)
function toGlb(json, bin) {
  const pad4 = (n) => (n + 3) & ~3;
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = pad4(jsonBytes.length), binLen = pad4(bin.length);
  const out = new Uint8Array(12 + 8 + jsonLen + 8 + binLen);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, out.length, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  out.set(jsonBytes, 20);
  out.fill(0x20, 20 + jsonBytes.length, 20 + jsonLen);
  dv.setUint32(20 + jsonLen, binLen, true);
  dv.setUint32(24 + jsonLen, 0x004e4942, true); // 'BIN'
  out.set(bin, 28 + jsonLen);
  return out.buffer;
}

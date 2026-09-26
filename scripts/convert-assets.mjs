// Converts the source assets in assets-src/ into what the game loads from public/:
//   node scripts/convert-assets.mjs
//
// - Polonez (assets-src/polonez-mr93-lp.glb, Sketchfab, see CREDITS.md) → public/models/polonez/polonez.gltf
//   with glTF-Transform: the FSO logo node is removed, the registration plate texture is replaced by a
//   fictional one (assets-src/plate-agro.png), unused data pruned.
// - Kenney kits (the .zip files as downloaded from kenney.nl, CC0) → public/assets/kenney/<kit>/<model>.gltf
//   + Textures/colormap.png. Only the models listed below are extracted.
// Output is .gltf with the geometry buffer embedded as base64 (the artifact host doesn't serve .glb/.bin) and
// textures as .png files; src/gltf.js turns the buffer back into a GLB in memory.
// Needs the `unzip` command.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';

const SRC = 'assets-src';
const OUT = 'public';

const KITS = {
  roads: {
    zip: 'kenney_city-kit-roads.zip',
    models: ['road-straight', 'road-bend', 'road-crossroad', 'road-intersection', 'road-end', 'road-crossing', 'light-curved-double', 'traffic-light', 'road-sign-street', 'construction-fence', 'light-square', 'light-square-double', 'light-curved', 'dumpster', 'construction-barrier', 'construction-cone', 'electricity-pole', 'road-sign-stop', 'road-sign-warning'],
  },
  commercial: {
    zip: 'kenney_city-kit-commercial_2.1.zip',
    models: ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h', 'building-i', 'building-m', 'building-j', 'building-k', 'building-l', 'building-n', 'building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-d', 'building-skyscraper-e', 'detail-awning', 'detail-awning-wide', 'low-detail-building-a', 'low-detail-building-c', 'low-detail-building-wide-a'],
  },
  suburban: {
    zip: 'kenney_city-kit-suburban_20.zip',
    models: ['tree-large', 'tree-small', 'fence-1x3', 'fence-1x4', 'fence-low', 'planter', 'path-long', 'path-short', 'building-type-c', 'building-type-m'],
  },
  cars: {
    zip: 'kenney_car-kit.zip',
    models: ['sedan', 'hatchback-sports', 'van', 'suv', 'taxi', 'delivery', 'cone', 'box', 'garbage-truck', 'truck', 'sedan-sports'],
  },
};

const unzip = (zip, path) => execFileSync('unzip', ['-p', `${SRC}/${zip}`, path], { maxBuffer: 64 << 20 });
const b64 = (bytes, mime) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;

// GLB → .gltf JSON with the binary chunk embedded (external image URIs are kept)
function glbToGltf(glb) {
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
  const binLen = glb.readUInt32LE(20 + jsonLen);
  const bin = glb.subarray(28 + jsonLen, 28 + jsonLen + binLen);
  json.buffers[0].uri = b64(bin, 'application/octet-stream');
  return json;
}

for (const [kit, { zip, models }] of Object.entries(KITS)) {
  const dir = `${OUT}/assets/kenney/${kit}`;
  mkdirSync(`${dir}/Textures`, { recursive: true });
  writeFileSync(`${dir}/Textures/colormap.png`, unzip(zip, 'Models/GLB format/Textures/colormap.png'));
  writeFileSync(`${dir}/License.txt`, unzip(zip, 'License.txt'));
  for (const m of models) writeFileSync(`${dir}/${m}.gltf`, JSON.stringify(glbToGltf(unzip(zip, `Models/GLB format/${m}.glb`))));
  console.log(`${kit}: ${models.length} modeli`);
}

// --- Polonez ---
const io = new NodeIO();
const doc = await io.read(`${SRC}/polonez-mr93-lp.glb`);
const root = doc.getRoot();
for (const node of root.listNodes()) {
  if (/FSO logo/i.test(node.getName())) {
    for (const child of node.listChildren()) child.dispose();
    node.dispose();
  }
}
for (const mat of root.listMaterials()) {
  if (mat.getName() === 'Plate') mat.getBaseColorTexture()?.setImage(readFileSync(`${SRC}/plate-agro.png`)).setMimeType('image/png');
}
await doc.transform(prune());
const { json, resources } = await io.writeJSON(doc, { format: 0 });
for (const b of json.buffers ?? []) b.uri = b64(resources[b.uri], 'application/octet-stream');
mkdirSync(`${OUT}/models/polonez/textures`, { recursive: true });
// Textures as separate files (the game can't fetch data: URIs inside the artifact page)
(json.images ?? []).forEach((img, i) => {
  if (!img.uri) return;
  const name = `textures/image-${i}.png`;
  writeFileSync(`${OUT}/models/polonez/${name}`, resources[img.uri]);
  img.uri = name;
});
json.asset.extras = { ...json.asset.extras, modified: 'FSO logo removed, registration plate replaced with a fictional one (Agro Drifter)' };
mkdirSync(`${OUT}/models/polonez`, { recursive: true });
writeFileSync(`${OUT}/models/polonez/polonez.gltf`, JSON.stringify(json));
console.log('polonez: materiały', root.listMaterials().map((m) => m.getName()).join(', '));

import * as THREE from 'three';
import { loadGltf } from './gltf.js';
import { clean } from './typewriter.js';

// People on the estate (NPC). Where they stand: the map file (npcs: id, x, z, yaw). Who they are: src/story/postacie.json
// (name, look, idle animation, everyday dialogue, shouts). No CC0 people could be downloaded from here (kenney.nl is
// blocked, docs/teksty.md → "Postacie"), so each one is a low-poly figure built from boxes in their colours –
// tracksuit with stripes, cap / beanie / hood, belly, a cigarette or a plastic bag – that reads well in pixel art.
// A character with `model` (a .gltf in public/, e.g. Kenney Mini Characters) uses that model instead; if the model
// has an animation, the first one plays in a loop.
//
// Idle animations: stoi (weight shifts), kiwa (nods), pali (hand to mouth, the ember glows), rece (hands behind the
// back). All of them breathe and turn their head towards the car when it is close. cheer() = arms up (the lads by
// the lot when a drift is good). Speech bubbles are DOM elements over their heads (bubble()).
const DEG = Math.PI / 180;
const HEAD_LOOK = 14; // m: closer than this, they watch the car

export function createPeople(scene, physics, placements, people, { base = import.meta.env?.BASE_URL ?? '/' } = {}) {
  const layer = document.createElement('div');
  layer.id = 'bubbles';
  document.body.appendChild(layer);
  const list = [];
  const jobs = [];
  for (const [i, p] of placements.entries()) {
    const who = people[p.id];
    if (!who) continue;
    const root = new THREE.Group();
    root.position.set(p.x, 0, p.z);
    root.rotation.y = (p.yaw ?? 0) * DEG;
    const fig = figure(who.wyglad ?? {});
    root.add(fig.group);
    scene.add(root);
    const collider = physics.addMovableBox({ x: 0.3, y: 0.9, z: 0.3 }, { surface: 'tree' });
    collider.set(p.x, p.z, root.rotation.y);
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    layer.appendChild(bubble);
    const npc = { id: p.id, who, root, fig, collider, bubble, bubbleTime: 0, cheer: 0, phase: i * 1.7, baseYaw: root.rotation.y, mixer: null, visible: true };
    if (who.model) {
      jobs.push(
        loadGltf(`${base}${who.model}`)
          .then((g) => {
            fig.group.visible = false;
            const m = g.scene;
            const box = new THREE.Box3().setFromObject(m);
            m.scale.setScalar(1.75 / Math.max(0.01, box.max.y - box.min.y));
            root.add(m);
            if (g.animations?.length) {
              npc.mixer = new THREE.AnimationMixer(m);
              npc.mixer.clipAction(g.animations[0]).play();
            }
          })
          .catch((e) => console.warn('model postaci', who.model, e)),
      );
    }
    list.push(npc);
  }
  const byId = Object.fromEntries(list.map((n) => [n.id, n]));
  const v = new THREE.Vector3();

  return {
    list,
    ready: Promise.all(jobs),
    get: (id) => byId[id],
    // Closest person the stopped car is next to (for the talk prompt)
    near(pos, reach = 4.5) {
      let best = null, bd = reach;
      for (const n of list) {
        if (!n.visible) continue;
        const d = Math.hypot(n.root.position.x - pos.x, n.root.position.z - pos.z);
        if (d < bd) (bd = d), (best = n);
      }
      return best;
    },
    // A short line in a bubble over their head for `time` s
    say(id, text, time = 2.2) {
      const n = byId[id];
      if (!n) return;
      n.bubble.textContent = clean(text);
      n.bubbleTime = time;
    },
    cheer(id) {
      if (byId[id]) byId[id].cheer = 1.4;
    },
    // Move someone (Zbyszek to the finish line) or hide them (sitting in the car)
    place(id, x, z, yawDeg) {
      const n = byId[id];
      if (!n) return;
      n.root.position.set(x, 0, z);
      n.root.rotation.y = n.baseYaw = yawDeg * DEG;
      n.collider.set(x, z, n.baseYaw);
    },
    show(id, on) {
      const n = byId[id];
      if (!n) return;
      n.visible = on;
      n.root.visible = on;
      n.collider.enabled(on);
      if (!on) n.bubbleTime = 0;
    },
    // time (s), dt, car position, camera (for the bubbles), talking: id of the person in a conversation
    update(time, dt, carPos, camera, talking = null) {
      for (const n of list) {
        n.mixer?.update(dt);
        if (!n.visible) {
          n.bubble.classList.remove('on');
          continue;
        }
        animate(n, time + n.phase, dt, carPos, talking === n.id);
        // Bubble over the head, on screen
        n.bubbleTime -= dt;
        const on = n.bubbleTime > 0;
        n.bubble.classList.toggle('on', on);
        if (on) {
          v.set(n.root.position.x, 2.35 * (n.who.wyglad?.wzrost ?? 1), n.root.position.z).project(camera);
          const hidden = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1;
          n.bubble.style.visibility = hidden ? 'hidden' : 'visible';
          n.bubble.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
        }
      }
    },
  };
}

// ---------- The figure ----------
function figure(look) {
  const L = {
    skora: '#e0b08a', gora: '#2a3a7a', paski: null, dol: '#2a3a7a', buty: '#e8e8e8', wlosy: '#2a1c10',
    czapka: null, czapkaKolor: '#111111', brzuch: 0, wzrost: 1, dodatek: null, ...look,
  };
  const mat = (c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.9 });
  const skin = mat(L.skora), top = mat(L.gora), bottom = mat(L.dol), shoe = mat(L.buty), hair = mat(L.wlosy);
  const stripe = L.paski ? mat(L.paski) : null;
  const box = (w, h, d, m, x = 0, y = 0, z = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    return b;
  };
  const group = new THREE.Group();
  const body = new THREE.Group(); // everything above the hips (breathes, sways)
  group.scale.setScalar(L.wzrost);

  // Legs and shoes (+ side stripes of the tracksuit)
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.11, 0.86, 0);
    leg.add(box(0.17, 0.8, 0.19, bottom, 0, -0.4, 0));
    leg.add(box(0.19, 0.1, 0.3, shoe, 0, -0.81, 0.05));
    if (stripe) leg.add(box(0.02, 0.78, 0.05, stripe, side * 0.095, -0.4, 0));
    group.add(leg);
    legs.push(leg);
  }
  // Torso (with a belly), arms on shoulder pivots, head
  body.position.y = 0.86;
  group.add(body);
  const belly = L.brzuch;
  body.add(box(0.46, 0.62, 0.26 + belly * 0.08, top, 0, 0.31, 0));
  if (belly > 0.05) body.add(box(0.4, 0.34, 0.12 * belly, top, 0, 0.2, 0.13 + 0.04 * belly + 0.06 * belly));
  if (stripe) body.add(box(0.04, 0.5, 0.02, stripe, 0.12, 0.34, 0.14 + belly * 0.04), box(0.04, 0.5, 0.02, stripe, -0.12, 0.34, 0.14 + belly * 0.04)); // zip-side stripes
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.3, 0.58, 0);
    arm.add(box(0.13, 0.58, 0.15, top, 0, -0.29, 0));
    arm.add(box(0.11, 0.1, 0.12, skin, 0, -0.62, 0)); // hand
    if (stripe) arm.add(box(0.02, 0.56, 0.05, stripe, side * 0.07, -0.29, 0));
    body.add(arm);
    arms.push(arm);
  }
  const head = new THREE.Group();
  head.position.y = 0.66;
  body.add(head);
  head.add(box(0.28, 0.3, 0.28, skin, 0, 0.15, 0));
  head.add(box(0.3, 0.08, 0.3, hair, 0, 0.31, -0.01));
  head.add(box(0.3, 0.16, 0.06, hair, 0, 0.22, -0.13));
  const eye = mat('#1a1410');
  head.add(box(0.05, 0.04, 0.02, eye, -0.06, 0.18, 0.145), box(0.05, 0.04, 0.02, eye, 0.06, 0.18, 0.145));
  if (L.czapka) {
    const cap = mat(L.czapkaKolor ?? '#111111');
    if (L.czapka === 'daszek') head.add(box(0.31, 0.1, 0.31, cap, 0, 0.34, 0), box(0.26, 0.03, 0.14, cap, 0, 0.3, 0.2));
    else if (L.czapka === 'zimowa') head.add(box(0.31, 0.16, 0.31, cap, 0, 0.36, 0), box(0.1, 0.08, 0.1, cap, 0, 0.47, 0));
    else if (L.czapka === 'kaptur') head.add(box(0.36, 0.38, 0.34, cap, 0, 0.18, -0.03).translateZ(-0.01), box(0.36, 0.08, 0.06, cap, 0, 0.33, 0.14));
  }
  // What they hold: a cigarette (right hand, the ember glows at the mouth) or a plastic bag (left hand)
  let ember = null;
  if (L.dodatek === 'papieros') {
    const cig = box(0.02, 0.02, 0.09, mat('#f0f0e8'), 0, -0.66, 0.08);
    ember = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
    ember.position.set(0, -0.66, 0.135);
    arms[1].add(cig, ember);
  } else if (L.dodatek === 'reklamowka') {
    arms[0].add(box(0.24, 0.28, 0.1, mat('#e8e8e0'), 0, -0.85, 0), box(0.02, 0.1, 0.02, mat('#d8d8d0'), 0, -0.68, 0));
  }
  group.traverse((o) => o.isMesh && (o.castShadow = false));
  return { group, body, head, arms, legs, ember, idle: null };
}

// ---------- Idle animation ----------
function animate(n, t, dt, carPos, talking) {
  const f = n.fig;
  const style = n.who.idle ?? 'stoi';
  // breathing and a slow sway (weight from foot to foot)
  f.body.scale.y = 1 + 0.018 * Math.sin(t * 2.1);
  const sway = style === 'stoi' || style === 'rece' ? Math.sin(t * 0.55) : 0.3 * Math.sin(t * 0.8);
  f.body.rotation.z = sway * 0.03;
  f.body.position.x = sway * 0.02;
  // arms
  let rUp = 0, lUp = 0, rIn = 0;
  if (style === 'pali') {
    const c = (t % 7) / 7; // every 7 s: hand to the mouth for ~1.5 s
    const k = c < 0.22 ? Math.sin((c / 0.22) * Math.PI) : 0;
    rUp = 0.25 + k * 1.9;
    rIn = k * 0.35;
    if (f.ember) f.ember.material.color.setRGB(1, 0.35 + 0.45 * k + 0.1 * Math.sin(t * 13), 0.1);
  } else if (style === 'rece') {
    rUp = lUp = -0.35; // hands behind the back
  } else {
    rUp = lUp = 0.05 + 0.03 * Math.sin(t * 1.3);
  }
  // cheering: both arms up, a bounce
  if (n.cheer > 0) {
    n.cheer -= dt;
    const k = Math.min(1, n.cheer / 0.3, (1.4 - n.cheer) / 0.2);
    const pump = 0.25 * Math.abs(Math.sin(t * 9));
    rUp = rUp * (1 - k) + k * (2.7 + pump);
    lUp = lUp * (1 - k) + k * (2.7 + pump);
    rIn *= 1 - k;
    f.body.position.y = 0.86 + k * 0.05 * Math.abs(Math.sin(t * 9));
  } else f.body.position.y = 0.86;
  f.arms[1].rotation.x = -rUp;
  f.arms[1].rotation.z = rIn;
  f.arms[0].rotation.x = -lUp;
  f.arms[0].rotation.z = 0;
  if (talking) f.arms[1].rotation.x -= 0.4 + 0.25 * Math.sin(t * 5); // gestures while talking
  // head: nods, and watches the car when it is close
  const dx = carPos.x - n.root.position.x, dz = carPos.z - n.root.position.z;
  let look = 0;
  if (Math.hypot(dx, dz) < HEAD_LOOK) {
    look = Math.atan2(dx, dz) - n.root.rotation.y;
    look -= 2 * Math.PI * Math.round(look / (2 * Math.PI));
    look = Math.max(-1.1, Math.min(1.1, look));
  }
  f.head.rotation.y += (look - f.head.rotation.y) * Math.min(1, dt * 4);
  f.head.rotation.x = style === 'kiwa' || talking ? 0.12 * Math.max(0, Math.sin(t * (talking ? 6 : 2.4))) : 0;
}

// ---------- Pixel portrait for the dialogue window (drawn from the same colours) ----------
export function portrait(look = {}, size = 24) {
  const L = { skora: '#e0b08a', gora: '#2a3a7a', wlosy: '#2a1c10', czapka: null, czapkaKolor: '#111', brzuch: 0, paski: null, dodatek: null, ...look };
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = (x, y, w, h, col) => ((g.fillStyle = col), g.fillRect(x, y, w, h));
  const shade = (hex, k) => {
    const col = new THREE.Color(hex).multiplyScalar(k);
    return `#${col.getHexString()}`;
  };
  const lift = (hex, k) => `#${new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k).getHexString()}`;
  r(0, 0, size, size, '#3a3448'); // background (a stairwell wall under a bulb): black caps still read against it
  r(0, 0, size, 3, '#4a4258');
  r(0, 16, size, 8, '#2e2a3a');
  // shoulders (tracksuit)
  r(3, 19, 18, 5, L.gora);
  r(3, 19, 18, 1, shade(L.gora, 1.3));
  if (L.paski) r(11, 19, 2, 5, L.paski);
  // neck, face
  r(10, 16, 4, 3, shade(L.skora, 0.8));
  r(7, 6, 10, 11, L.skora);
  r(7, 15, 10, 2, shade(L.skora, 0.85)); // jaw shadow
  r(6, 10, 1, 3, L.skora); // ears
  r(17, 10, 1, 3, L.skora);
  // eyes, brows, nose, mouth
  r(9, 10, 2, 2, '#f4f0e8');
  r(13, 10, 2, 2, '#f4f0e8');
  r(10, 11, 1, 1, '#1a1410');
  r(14, 11, 1, 1, '#1a1410');
  r(9, 9, 2, 1, L.wlosy);
  r(13, 9, 2, 1, L.wlosy);
  r(11, 12, 2, 2, shade(L.skora, 0.8));
  r(10, 15, 4, 1, '#7a3a30');
  // hair
  r(7, 5, 10, 2, L.wlosy);
  r(7, 7, 1, 3, L.wlosy);
  r(16, 7, 1, 3, L.wlosy);
  // headwear
  const cap = L.czapkaKolor ?? '#111';
  if (L.czapka === 'daszek') {
    r(6, 3, 12, 4, cap);
    r(6, 3, 12, 1, lift(cap, 0.3));
    r(12, 6, 8, 1, lift(cap, 0.15));
  } else if (L.czapka === 'zimowa') {
    r(6, 2, 12, 6, cap);
    r(10, 0, 4, 2, lift(cap, 0.2));
    r(6, 6, 12, 1, lift(cap, 0.3));
  } else if (L.czapka === 'kaptur') {
    r(5, 3, 14, 3, cap);
    r(5, 3, 14, 1, lift(cap, 0.25));
    r(5, 5, 2, 13, cap);
    r(17, 5, 2, 13, cap);
  }
  if (L.dodatek === 'papieros') {
    r(14, 15, 4, 1, '#f0f0e8');
    r(18, 15, 1, 1, '#ff6a1a');
  }
  if (L.brzuch > 0.6) r(8, 16, 8, 1, shade(L.skora, 0.9)); // double chin
  return c;
}

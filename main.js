import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

const Q = new URLSearchParams(location.search);
const MOBILE = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || Q.has('mobile');
const HQ = !MOBILE && !Q.has('lq');
const plan = await (await fetch('plan.json')).json();
const S = plan.scale_m_per_px, [X0, Y0] = plan.origin_px, H = plan.ceiling;
const px2m = (x, y) => [(x - X0) * S, (y - Y0) * S];
const m2px = (x, z) => [x / S + X0, z / S + Y0];

// ---------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: !HQ, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 600);
camera.rotation.order = 'YXZ';

const tl = new THREE.TextureLoader();
const pending = [];
function tex(name, rep, srgb) {
  const t = tl.load(`tex/${name}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function pbr(base, extra = {}) {
  return new THREE.MeshStandardMaterial({ map: tex(base + '_diff', 1, true), normalMap: tex(base + '_nor'), roughnessMap: tex(base + '_rough'), ...extra });
}
const M = {
  marble: pbr('marble_01', { roughness: 0.35, color: 0xd8d8d8 }),
  wood: pbr('dark_wooden_planks', { color: 0xb08a6a }),
  tile: pbr('large_grey_tiles', { roughness: 0.6 }),
  balcony: pbr('patio_tiles', { color: 0xcfcfcf }),
  wall: new THREE.MeshStandardMaterial({ color: 0xe9e5de, roughness: 0.92 }),
  ceil: new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.95 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2f0eb, roughness: 0.35 }),
  lacquer: new THREE.MeshPhysicalMaterial({ color: 0xece8e0, roughness: 0.25, clearcoat: 0.5 }),
  walnut: new THREE.MeshStandardMaterial({ color: 0x4a2e1d, roughness: 0.45 }),
  oak: new THREE.MeshStandardMaterial({ color: 0x9a7350, roughness: 0.6 }),
  quartz: new THREE.MeshPhysicalMaterial({ color: 0xf5f5f2, roughness: 0.15, clearcoat: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xd0d3d5, metalness: 0.75, roughness: 0.35 }),
  black: new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03 }),
  darkmetal: new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.35 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.02, thickness: 0.01, ior: 1.5, transparent: true, opacity: 0.25, depthWrite: false }),
  frame: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, metalness: 0.6, roughness: 0.4 }),
  fabricGrey: new THREE.MeshStandardMaterial({ color: 0xbdb8b0, roughness: 0.95 }),
  fabricLight: new THREE.MeshStandardMaterial({ color: 0xe8e3da, roughness: 0.95 }),
  duvet: new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.9 }),
  throwBeige: new THREE.MeshStandardMaterial({ color: 0xb59b7c, roughness: 0.95 }),
  headboard: new THREE.MeshStandardMaterial({ color: 0x8c8378, roughness: 0.95 }),
  ceramic: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, clearcoat: 1 }),
  ivory: new THREE.MeshStandardMaterial({ color: 0xfaf8f0, roughness: 0.3 }),
  emissive: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d8, emissiveIntensity: 3 }),
  shade: new THREE.MeshStandardMaterial({ color: 0xf6efe2, emissive: 0xffd9a0, emissiveIntensity: 0.6, roughness: 0.9, side: THREE.DoubleSide }),
};
const solids = []; // collision rects in metres [x0,z0,x1,z1]
const hideInTop = [];

function box(w, h, d, mat, x, y, z, parent = scene, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
function rbox(w, h, d, r, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)), mat);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function worldUV(geo, size) { // planar xz uv
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / size, p.getZ(i) / size);
  uv.needsUpdate = true;
}

// ---------- floors
const fsize = { marble: 1.6, wood: 1.4, tile: 1.2, balcony: 1.0 };
plan.floors.forEach(([mat, [x0, z0, x1, z1]], i) => {
  const g = new THREE.BoxGeometry(x1 - x0, 0.02, z1 - z0);
  g.translate((x0 + x1) / 2, -0.01 + (mat === 'marble' ? 0 : 0.002 + i * 0.0003), (z0 + z1) / 2);
  worldUV(g, fsize[mat]);
  const m = new THREE.Mesh(g, M[mat]); m.receiveShadow = true; scene.add(m);
});
// ceiling + slabs
{
  for (const [p0, p1, p2, p3] of [[171, 547, 969, 1049], [960, 732, 1170, 1049]]) {
    const [ax, az] = px2m(p0, p1), [bx, bz] = px2m(p2, p3);
    const c = box(bx - ax, 0.12, bz - az, M.ceil, (ax + bx) / 2, H + 0.06, (az + bz) / 2, scene, true); hideInTop.push(c);
    box(bx - ax, 0.25, bz - az, M.wall, (ax + bx) / 2, -0.14, (az + bz) / 2, scene, false);
  }
}

// ---------- walls
for (const w of plan.walls) {
  const x0 = Math.min(w.x0, w.x1), x1 = Math.max(w.x0, w.x1), z0 = Math.min(w.z0, w.z1), z1 = Math.max(w.z0, w.z1);
  const W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const seg = (y0, y1, mat = M.wall) => box(W, y1 - y0, D, mat, cx, (y0 + y1) / 2, cz);
  const along = W > D ? 'x' : 'z';
  if (w.kind === 'w' || w.kind === 'c') { seg(0, H); solids.push([x0, z0, x1, z1]); }
  else if (w.kind === 'd') { seg(2.1, H); }
  else if (w.kind === 's' || w.kind === 'g') {
    const sill = w.kind === 's' ? 0.9 : 0.0, head = w.kind === 's' ? 2.3 : 2.45;
    if (sill > 0) seg(0, sill); seg(head, H);
    const gl = box(along === 'x' ? W : 0.012, head - sill, along === 'x' ? 0.012 : D, M.glass, cx, (sill + head) / 2, cz, scene, false);
    // frame: bottom/top/mullions
    const L = along === 'x' ? W : D, n = Math.max(1, Math.round(L / (w.kind === 'g' ? 1.2 : 0.9)));
    for (let i = 0; i <= n; i++) {
      const t = -L / 2 + (L * i) / n;
      box(along === 'x' ? 0.05 : 0.07, head - sill, along === 'x' ? 0.07 : 0.05, M.frame, cx + (along === 'x' ? t : 0), (sill + head) / 2, cz + (along === 'z' ? t : 0));
    }
    box(along === 'x' ? W : 0.07, 0.05, along === 'x' ? 0.07 : D, M.frame, cx, sill + 0.025, cz);
    box(along === 'x' ? W : 0.07, 0.05, along === 'x' ? 0.07 : D, M.frame, cx, head - 0.025, cz);
    solids.push([x0, z0, x1, z1]);
  }
}
// balcony glass railings + slab edges
function rail(xa, za, xb, zb) {
  const [x0, z0] = px2m(xa, za), [x1, z1] = px2m(xb, zb);
  const W = Math.max(Math.abs(x1 - x0), 0.04), D = Math.max(Math.abs(z1 - z0), 0.04), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  box(W, 1.05, D, M.glass, cx, 0.55, cz, scene, false);
  box(W + 0.02, 0.05, D + 0.02, M.frame, cx, 1.1, cz);
  box(W + 0.02, 0.12, D + 0.02, M.wall, cx, 0.06, cz);
  solids.push([Math.min(x0, x1) - 0.02, Math.min(z0, z1) - 0.02, Math.max(x0, x1) + 0.02, Math.max(z0, z1) + 0.02]);
}
rail(598, 480, 860, 480); rail(598, 480, 598, 546); rail(860, 500, 960, 500); rail(860, 480, 860, 500);
rail(455, 1170, 985, 1170); rail(455, 1049, 455, 1170); rail(985, 1049, 985, 1170);
{ // balcony slabs underneath
  for (const [a, b, c, d] of [[598, 480, 960, 546], [455, 1049, 985, 1170]]) {
    const [x0, z0] = px2m(a, b), [x1, z1] = px2m(c, d);
    box(x1 - x0 + 0.1, 0.25, z1 - z0 + 0.1, M.wall, (x0 + x1) / 2, -0.14, (z0 + z1) / 2, scene, false);
  }
}

// ---------- lighting
const center = new THREE.Vector3(...(() => { const [x, z] = px2m(670, 800); return [x, 0, z]; })());
const sun = new THREE.DirectionalLight(0xfff0dc, 3.2);
sun.position.copy(center).add(new THREE.Vector3(-9, 14, 16)); sun.target.position.copy(center);
sun.castShadow = true; sun.shadow.mapSize.set(HQ ? 4096 : 2048, HQ ? 4096 : 2048);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xeef2f8, 0x9a8a78, 0.6));
// downlights
function downlight(xp, zp, I = 2.2, dist = 5.5) {
  const [x, z] = px2m(xp, zp);
  const d = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 20), M.emissive); d.position.set(x, H - 0.005, z); scene.add(d); hideInTop.push(d);
  const l = new THREE.PointLight(0xffdcb0, I, dist, 1.6); l.position.set(x, H - 0.25, z); scene.add(l);
}
[[700, 640], [690, 780], [820, 830], [800, 960], [640, 990], [920, 990], [1080, 770], [470, 770], [900, 640],
 [290, 880], [290, 1000], [510, 900], [510, 1000], [1070, 900], [1070, 1000], [250, 640], [420, 640], [550, 640]].forEach(([x, z]) => downlight(x, z, MOBILE ? 1.5 : 1.8));

// env + background
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader().load('tex/sky.hdr', (t) => {
  t.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = t; scene.backgroundIntensity = 0.9;
  scene.environment = pmrem.fromEquirectangular(t).texture; scene.environmentIntensity = 0.45;
});
// outside context: ground far below + towers
{
  const g = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshStandardMaterial({ color: 0x7d8a72, roughness: 1 }));
  g.rotation.x = -Math.PI / 2; g.position.set(center.x, -45, center.z); scene.add(g);
  const tm = new THREE.MeshStandardMaterial({ color: 0xc9c6c0, roughness: 0.8 });
  const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 140, h = 40 + rnd() * 70, w = 16 + rnd() * 14;
    box(w, h, w * 0.7, tm, center.x + Math.cos(a) * r, -45 + h / 2, center.z + Math.sin(a) * r, scene, false);
  }
}

// ---------- furniture
const gltf = new GLTFLoader();
const modelCache = {};
function loadModel(id) {
  return modelCache[id] ??= gltf.loadAsync(`models/${id}/${id}.gltf`).then((g) => g.scene);
}
function place(id, x, z, rot, fit, y = 0) {
  const p = loadModel(id).then((src) => {
    const o = src.clone(true);
    o.traverse((c) => { if (c.isMesh) { c.castShadow = c.receiveShadow = true; } });
    const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3());
    let s = 1;
    if (fit.h) s = fit.h / sz.y; else if (fit.w) s = fit.w / Math.max(sz.x, sz.z);
    o.scale.setScalar(s);
    const g = new THREE.Group(); g.add(o);
    o.position.set(-(bb.min.x + sz.x / 2) * s, -bb.min.y * s, -(bb.min.z + sz.z / 2) * s);
    g.position.set(x, y, z); g.rotation.y = THREE.MathUtils.degToRad(rot); scene.add(g);
    return g;
  });
  pending.push(p); return p;
}
function group(x, z, rot) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = THREE.MathUtils.degToRad(rot); scene.add(g); return g; }
function solidRect(x, z, w, d, rot) { // axis aligned bounds of rotated rect
  const r = THREE.MathUtils.degToRad(rot), c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  const W = w * c + d * s, D = w * s + d * c; solids.push([x - W / 2, z - D / 2, x + W / 2, z + D / 2]);
}

const B = {
  dining_table(f) {
    const g = group(f.x, f.z, f.rot);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 64), M.walnut);
    top.scale.set(f.w / 1.0, 1, f.d / 1.0); top.position.y = 0.74; top.castShadow = top.receiveShadow = true; g.add(top);
    for (const dz of [-f.d * 0.28, f.d * 0.28]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.72, 32), M.walnut); leg.position.set(0, 0.36, dz); leg.castShadow = true; g.add(leg);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 32), M.walnut); base.position.set(0, 0.015, dz); g.add(base);
    }
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 24), M.ceramic); vase.position.y = 0.87; g.add(vase);
    place('modern_ceiling_lamp_01', f.x, f.z, 0, { h: 0.6 }, H - 0.6);
    solidRect(f.x, f.z, f.w * 0.9, f.d * 0.9, f.rot);
  },
  dining_chair(f) { place('dining_chair_02', f.x, f.z, f.rot, { h: 0.88 }); solidRect(f.x, f.z, 0.42, 0.42, 0); },
  counter(x0, z0, x1, z1, opt = {}) {
    const W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(W - 0.02, 0.1, D - 0.06, M.darkmetal, cx, 0.05, cz);
    box(W, 0.78, D, M.lacquer, cx, 0.49, cz);
    box(W + 0.02, 0.04, D + 0.02, M.quartz, cx, 0.9, cz);
    // door grooves
    const along = W > D, L = along ? W : D, n = Math.max(1, Math.round(L / 0.6));
    for (let i = 1; i < n; i++) { const t = -L / 2 + (L * i) / n; box(along ? 0.006 : D + 0.004, 0.74, along ? D + 0.004 : 0.006, M.frame, cx + (along ? t : 0), 0.49, cz + (along ? 0 : t), scene, false); }
    solids.push([x0, z0, x1, z1]);
  },
  kitchen_L(f) {
    const [a, b] = px2m(758, 560), [c, d] = px2m(838, 597), [e, h] = px2m(786, 680);
    B.counter(a, b, c, d); B.counter(a, d, e, h);
    // tall pantry at end + stools? keep
  },
  kitchen_top(f) {
    const [x0, z0] = px2m(847, 559), [x1] = px2m(960, 559), z1 = z0 + 0.62;
    B.counter(x0, z0, x1, z1);
    const [sx] = px2m(880, 0);
    box(0.7, 0.02, 0.42, M.steel, sx, 0.915, z0 + 0.3);
    const tap = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 24, Math.PI), M.steel); tap.position.set(sx, 1.0, z0 + 0.08); scene.add(tap);
  },
  kitchen_right(f) {
    const [x1, z0] = px2m(960, 597), [, z1] = px2m(0, 734), x0 = x1 - 0.62;
    B.counter(x0, z0, x1, z1);
    const [, hz] = px2m(0, 655);
    box(0.52, 0.01, 0.6, M.black, x0 + 0.31, 0.925, hz);
    for (const [dx, dz] of [[-0.12, -0.14], [0.12, -0.14], [-0.12, 0.14], [0.12, 0.14]]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.006, 6, 24), M.darkmetal); r.rotation.x = Math.PI / 2; r.position.set(x0 + 0.31 + dx, 0.935, hz + dz); scene.add(r);
    }
    box(0.5, 0.45, 0.7, M.steel, x1 - 0.25, 2.0, hz); // hood
    box(0.35, 0.75, 0.6, M.lacquer, x1 - 0.175, 1.85, (z0 + hz) / 2 - 0.3);
  },
  kitchen_bottom(f) {
    const [x0, z1] = px2m(847, 734), [x1] = px2m(920, 0), z0 = z1 - 0.7;
    // fridge (tall) + tall cabinets
    box(0.9, 1.85, 0.68, M.steel, x0 + 0.47, 0.93, z0 + 0.36);
    box(0.02, 1.7, 0.01, M.darkmetal, x0 + 0.47, 1.0, z0 + 0.0, scene, false);
    box(x1 - x0 - 0.95, 2.3, 0.62, M.lacquer, (x0 + 0.95 + x1) / 2, 1.15, z0 + 0.36);
    solids.push([x0, z0, x1, z1]);
  },
  round_sofa(f) {
    // curved section: arc around centre from -80 to +65 deg (0 = +x), outer radius R
    const R = 1.15, depth = 0.75, g = group(f.x, f.z, 0);
    const a0 = THREE.MathUtils.degToRad(-100), a1 = THREE.MathUtils.degToRad(42);
    const ring = (r0, r1, h0, h1, mat) => {
      const sh = new THREE.Shape(); sh.absarc(0, 0, r1, a0, a1, false); sh.absarc(0, 0, r0, a1, a0, true);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: h1 - h0, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 64 });
      const m = new THREE.Mesh(geo, mat); m.rotation.x = Math.PI / 2; m.position.y = h1; m.castShadow = m.receiveShadow = true;
      m.scale.z = 1; g.add(m); return m;
    };
    ring(R - depth, R, 0.05, 0.25, M.fabricLight); // base
    ring(R - depth + 0.04, R - 0.2, 0.25, 0.43, M.fabricLight); // seat
    ring(R - 0.2, R, 0.25, 0.78, M.fabricLight); // back
    // cushions
    for (let i = 0; i < 5; i++) {
      const a = a0 + (a1 - a0) * (i + 0.5) / 5;
      const c = rbox(0.45, 0.4, 0.14, 0.06, M.fabricGrey, Math.cos(a) * (R - 0.3), 0.62, Math.sin(a) * (R - 0.3), g);
      c.rotation.y = -a + Math.PI / 2; c.rotation.x = -0.25;
    }
    // straight sofa below (plan: x665-770, y955-1005)
    const [sx, sz] = px2m(727, 983);
    const s = group(sx, sz, 0);
    rbox(1.9, 0.22, 0.9, 0.05, M.fabricLight, 0, 0.16, 0, s);
    rbox(1.8, 0.18, 0.62, 0.07, M.fabricLight, 0, 0.35, -0.1, s);
    rbox(1.9, 0.5, 0.2, 0.08, M.fabricLight, 0, 0.5, 0.35, s);
    rbox(0.22, 0.32, 0.9, 0.08, M.fabricLight, -0.95, 0.4, 0, s); rbox(0.22, 0.32, 0.9, 0.08, M.fabricLight, 0.95, 0.4, 0, s);
    for (const dx of [-0.55, 0, 0.55]) { const c = rbox(0.45, 0.42, 0.14, 0.06, M.fabricGrey, dx, 0.62, 0.2, s); c.rotation.x = 0.2; }
    solids.push([sx - 1, sz - 0.45, sx + 1, sz + 0.45]);
    for (let i = 0; i < 8; i++) { const a = a0 + (a1 - a0) * (i + 0.5) / 8; solidRect(f.x + Math.cos(a) * (R - 0.42), f.z + Math.sin(a) * (R - 0.42), 0.6, 0.6, 0); }
  },
  rug_round(f) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    const gr = x.createRadialGradient(256, 256, 30, 256, 256, 256); gr.addColorStop(0, '#6b4a2e'); gr.addColorStop(0.55, '#4b3a2c'); gr.addColorStop(0.75, '#2c3a52'); gr.addColorStop(1, '#22304a');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${150 + Math.random() * 80},${110 + Math.random() * 50},70,${Math.random() * 0.12})`; x.fillRect(Math.random() * 512, Math.random() * 512, 2, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(f.w / 2, f.w / 2, 0.012, 96), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
    m.position.set(f.x, 0.006, f.z); m.receiveShadow = true; scene.add(m);
  },
  rug(f) {
    const m = box(f.w, 0.01, f.d, new THREE.MeshStandardMaterial({ color: 0x4f5d73, roughness: 1 }), f.x, 0.008, f.z, scene, false); m.castShadow = false;
  },
  coffee_oval(f) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 48), M.quartz); t.scale.set(f.w, 1, f.d); t.position.set(f.x, 0.4, f.z); t.castShadow = true; scene.add(t); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.38, 24), M.walnut); l.position.set(f.x, 0.19, f.z); scene.add(l); solidRect(f.x, f.z, f.w, f.d, 0); },
  armchair(f) { place('modern_arm_chair_01', f.x, f.z, f.rot, { h: 0.8 }); solidRect(f.x, f.z, 0.7, 0.7, 0); },
  side_table(f) { place('side_table_01', f.x, f.z, 0, { h: 0.5 }); },
  coffee_table(f) { place('modern_coffee_table_01', f.x, f.z, 0, { w: 0.75 }); },
  piano(f) {
    const g = group(f.x, f.z, f.rot);
    // outline of a grand piano (local: keyboard along -z edge, width 1.5 along x, length 1.7 along +z)
    const sh = new THREE.Shape();
    sh.moveTo(-0.75, -0.85); sh.lineTo(0.75, -0.85); sh.lineTo(0.75, 0.1);
    sh.bezierCurveTo(0.75, 0.75, 0.3, 0.85, 0.05, 0.85);
    sh.bezierCurveTo(-0.3, 0.85, -0.25, 0.25, -0.55, 0.05);
    sh.bezierCurveTo(-0.75, -0.08, -0.75, -0.3, -0.75, -0.4); sh.lineTo(-0.75, -0.85);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, curveSegments: 48 }), M.black);
    body.rotation.x = Math.PI / 2; body.position.y = 1.0; body.castShadow = body.receiveShadow = true; g.add(body);
    // lid propped open, hinged on the +x straight side
    const lid = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.015, bevelEnabled: false, curveSegments: 48 }), M.black);
    const pivot = new THREE.Group(); pivot.position.set(0.75, 1.01, 0); g.add(pivot);
    lid.rotation.x = Math.PI / 2; lid.position.set(-0.75, 0.015, 0); pivot.add(lid); pivot.rotation.z = -0.6; lid.castShadow = true;
    box(0.015, 0.66, 0.015, M.black, -0.45, 1.34, 0.2, g);
    // keyboard
    box(1.5, 0.06, 0.32, M.black, 0, 0.72, -1.0, g);
    box(1.3, 0.025, 0.16, M.ivory, 0, 0.765, -1.0, g, false);
    const bk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.011, 0.02, 0.09), M.black, 36); let k = 0;
    for (let o = 0; o < 7; o++) for (const n of [1, 2, 4, 5, 6]) { const xx = -0.65 + (o * 7 + n) * (1.3 / 52) - 0.004; if (k < 36) bk.setMatrixAt(k++, new THREE.Matrix4().makeTranslation(xx, 0.785, -0.965)); }
    bk.count = k; g.add(bk);
    box(1.5, 0.12, 0.05, M.black, 0, 0.83, -0.83, g); // fallboard back
    box(0.6, 0.25, 0.015, M.black, 0, 1.1, -0.72, g).rotation.x = -0.25; // music desk
    for (const [lx, lz] of [[-0.62, -0.75], [0.62, -0.75], [0.3, 0.6]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.68, 16), M.black); l.position.set(lx, 0.34, lz); l.castShadow = true; g.add(l); }
    box(0.18, 0.4, 0.04, M.black, 0, 0.35, -0.62, g); // lyre
    solidRect(f.x, f.z, 1.6, 1.8, f.rot);
  },
  piano_bench(f) { const g = group(f.x, f.z, f.rot); rbox(0.75, 0.08, 0.36, 0.02, M.black, 0, 0.47, 0, g); for (const [a, b] of [[-0.33, -0.14], [0.33, -0.14], [-0.33, 0.14], [0.33, 0.14]]) box(0.04, 0.45, 0.04, M.black, a, 0.22, b, g); },
  tv_console(f) {
    box(f.w * 1.6, 0.42, f.d, M.walnut, f.x, 0.25, f.z); box(f.w * 1.6, 0.04, f.d + 0.02, M.quartz, f.x, 0.48, f.z);
    const tvx = f.x - f.w / 2 + 0.03; box(0.04, 0.84, 1.46, M.black, tvx - 0.02 + 0.0, 1.35, f.z);
    const scr = box(0.005, 0.8, 1.42, new THREE.MeshPhysicalMaterial({ color: 0x0a0d12, roughness: 0.05, clearcoat: 1 }), tvx + 0.003, 1.35, f.z, scene, false);
    solids.push([f.x - f.w * 0.8, f.z - f.d / 2, f.x + f.w * 0.8, f.z + f.d / 2]);
  },
  bed(f) {
    const L = Math.max(f.w, f.d), Wd = Math.min(f.w, f.d), g = group(f.x, f.z, f.rot);
    rbox(Wd, 0.3, L, 0.03, M.headboard, 0, 0.18, 0, g);
    rbox(Wd - 0.06, 0.24, L - 0.08, 0.08, M.duvet, 0, 0.45, 0.02, g);
    rbox(Wd + 0.02, 0.06, L * 0.62, 0.05, M.duvet, 0, 0.58, L * 0.17, g);
    rbox(Wd + 0.04, 0.03, 0.55, 0.015, M.throwBeige, 0, 0.62, L * 0.32, g);
    for (const dx of [-Wd / 4, Wd / 4]) { const p = rbox(Wd / 2 - 0.1, 0.16, 0.42, 0.08, M.fabricLight, dx, 0.66, -L / 2 + 0.32, g); p.rotation.x = -0.35; }
    rbox(Wd + 0.3, 1.15, 0.1, 0.03, M.headboard, 0, 0.58, -L / 2 - 0.05, g);
    solidRect(f.x, f.z, f.w, f.d, 0);
  },
  wardrobe(f) {
    box(f.w, 2.4, f.d, M.lacquer, f.x, 1.2, f.z);
    const n = Math.max(2, Math.round(f.w / 0.5));
    for (let i = 1; i < n; i++) box(0.006, 2.36, f.d + 0.004, M.frame, f.x - f.w / 2 + f.w * i / n, 1.2, f.z, scene, false);
    solids.push([f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2]);
  },
  wardrobe_v(f) {
    box(f.w, 2.4, f.d, M.lacquer, f.x, 1.2, f.z);
    const n = Math.max(2, Math.round(f.d / 0.5));
    for (let i = 1; i < n; i++) box(f.w + 0.004, 2.36, 0.006, M.frame, f.x, 1.2, f.z - f.d / 2 + f.d * i / n, scene, false);
    solids.push([f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2]);
  },
  nightstand(f) {
    const g = group(f.x, f.z, 0); rbox(0.45, 0.5, 0.4, 0.02, M.walnut, 0, 0.25, 0, g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 20), M.ceramic); base.position.y = 0.65; g.add(base);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.22, 32, 1, true), M.shade); sh.position.y = 0.9; g.add(sh);
    const l = new THREE.PointLight(0xffc98a, 0.6, 2.5, 2); l.position.y = 0.88; g.add(l);
  },
  lounge(f) { place('mid_century_lounge_chair', f.x, f.z, -150, { h: 0.85 }); solidRect(f.x, f.z, 0.8, 0.8, 0); },
  plant(f) { const ids = ['potted_plant_01', 'potted_plant_02', 'potted_plant_04']; place(ids[(B._p = (B._p || 0) + 1) % 3], f.x, f.z, f.x * 40, { h: 1.1 }); solidRect(f.x, f.z, 0.4, 0.4, 0); },
  bathtub(f) {
    const g = group(f.x, f.z, 0); rbox(f.w, 0.55, f.d, 0.06, M.ceramic, 0, 0.275, 0, g);
    rbox(f.w - 0.14, 0.04, f.d - 0.14, 0.12, new THREE.MeshPhysicalMaterial({ color: 0xcfe3ec, roughness: 0.05, transmission: 0.5 }), 0, 0.5, 0, g);
    solidRect(f.x, f.z, f.w, f.d, 0);
  },
  toilet(f) {
    const g = group(f.x, f.z, f.rot);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16), M.ceramic); b.scale.set(0.9, 0.8, 1.2); b.position.set(0, 0.3, 0.06); b.castShadow = true; g.add(b);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.3, 24), M.ceramic); ped.position.set(0, 0.15, 0.02); g.add(ped);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 10, 32), M.ceramic); seat.rotation.x = Math.PI / 2; seat.scale.set(1, 1.25, 1); seat.position.set(0, 0.42, 0.06); g.add(seat);
    rbox(0.38, 0.38, 0.17, 0.03, M.ceramic, 0, 0.62, -0.2, g);
    solidRect(f.x, f.z, 0.45, 0.6, f.rot);
  },
  vanity(x, z, w, d, along) {
    box(w, 0.5, d, M.oak, x, 0.55, z); box(w + 0.02, 0.04, d + 0.02, M.quartz, x, 0.82, z);
    const n = Math.max(1, Math.round((along ? w : d) / 0.6));
    for (let i = 0; i < n; i++) { const t = -0.5 + (i + 0.5) / n; const bx = x + (along ? t * w : 0), bz = z + (along ? 0 : t * d);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.12, 32), M.ceramic); s.scale.set(along ? 1 : 0.8, 1, along ? 0.8 : 1); s.position.set(bx, 0.9, bz); scene.add(s); }
    solids.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
  },
  basin_v(f) { B.vanity(f.x, f.z, f.w, f.d, false); box(0.02, 0.9, f.d * 0.9, new THREE.MeshStandardMaterial({ color: 0xdde4e8, metalness: 1, roughness: 0.02 }), f.x + f.w / 2 + 0.02, 1.5, f.z); },
  basin_h(f) { B.vanity(f.x, f.z, f.w, f.d, true); },
  shower_glass(f) {
    box(f.w, 0.04, f.d, M.white, f.x, 0.02, f.z, scene, false);
    box(f.w, 2.0, 0.01, M.glass, f.x, 1.03, f.z + f.d / 2, scene, false); box(0.01, 2.0, f.d, M.glass, f.x + f.w / 2, 1.03, f.z, scene, false);
    box(0.03, 2.0, 0.03, M.steel, f.x + f.w / 2, 1.03, f.z + f.d / 2);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.01, 24), M.steel); h.position.set(f.x, 2.2, f.z); scene.add(h);
    solidRect(f.x, f.z, f.w, f.d, 0);
  },
  desk(f) { box(f.w, 0.03, f.d, M.walnut, f.x, 0.74, f.z); box(0.04, 0.72, f.d - 0.1, M.walnut, f.x - f.w / 2 + 0.04, 0.36, f.z); box(0.04, 0.72, f.d - 0.1, M.walnut, f.x + f.w / 2 - 0.04, 0.36, f.z); place('desk_lamp_arm_01', f.x, f.z - f.d * 0.35, 90, { h: 0.45 }, 0.755); solidRect(f.x, f.z, f.w, f.d, 0); },
  desk_chair(f) { place('modern_arm_chair_01', f.x, f.z, f.rot, { h: 0.8 }); },
  outdoor_set(f) { place('outdoor_table_chair_set_01', f.x, f.z, 0, { w: 1.6 }); solidRect(f.x, f.z, 1.4, 1.4, 0); },
  lounge_chair_out(f) { place('modern_arm_chair_01', f.x, f.z, 180, { h: 0.8 }); solidRect(f.x, f.z, 0.7, 0.7, 0); },
  shoe_cabinet(f) { box(f.w, 1.0, f.d, M.walnut, f.x, 0.5, f.z); solids.push([f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2]); },
};
for (const f of plan.furniture) { if (B[f.type]) B[f.type](f); else console.warn('no builder', f.type); }
{ // throw pillows on straight sofa? (decor) + plants by window
  const [x, z] = px2m(640, 1030);
}

// ---------- collision
function blocked(x, z, r = 0.22) {
  for (const [a, b, c, d] of solids) if (x > a - r && x < c + r && z > b - r && z < d + r) return true;
  return false;
}

// ---------- controls
const player = { x: 0, z: 0, yaw: 0, pitch: -0.05, eye: 1.6 };
{ const [x, z] = px2m(1030, 770); Object.assign(player, { x, z, yaw: Math.PI * 0.5 }); }
const keys = {};
addEventListener('keydown', (e) => (keys[e.code] = true));
addEventListener('keyup', (e) => (keys[e.code] = false));
let locked = false;
document.addEventListener('pointerlockchange', () => (locked = document.pointerLockElement === renderer.domElement));
addEventListener('mousemove', (e) => { if (!locked) return; player.yaw -= e.movementX * 0.0022; player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * 0.0022, -1.3, 1.3); });
const joy = { x: 0, y: 0, id: null, look: null };
const joyEl = document.getElementById('joy'), knob = document.getElementById('knob');
if (MOBILE) joyEl.style.display = 'block';
addEventListener('touchstart', (e) => {
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.45 && t.clientY > innerHeight * 0.45 && joy.id === null) { joy.id = t.identifier; joy.cx = t.clientX; joy.cy = t.clientY; }
    else if (joy.look === null) { joy.look = t.identifier; joy.lx = t.clientX; joy.ly = t.clientY; }
  }
}, { passive: true });
addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { joy.x = THREE.MathUtils.clamp((t.clientX - joy.cx) / 50, -1, 1); joy.y = THREE.MathUtils.clamp((t.clientY - joy.cy) / 50, -1, 1); knob.style.transform = `translate(${joy.x * 40}px,${joy.y * 40}px)`; }
    if (t.identifier === joy.look) { player.yaw -= (t.clientX - joy.lx) * 0.005; player.pitch = THREE.MathUtils.clamp(player.pitch - (t.clientY - joy.ly) * 0.004, -1.2, 1.2); joy.lx = t.clientX; joy.ly = t.clientY; }
  }
}, { passive: true });
addEventListener('touchend', (e) => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; } if (t.identifier === joy.look) joy.look = null; } });

// ---------- tour
const tourPx = [[1030, 772, 180], [900, 800, 200], [780, 820, 160], [640, 870, 120], [760, 790, 20], [700, 760, -60],
  [660, 690, -90], [800, 715, -40], [880, 700, -60], [760, 770, 60], [560, 770, 180], [500, 870, 110], [470, 1010, 140], [560, 770, 0], [380, 770, 180], [330, 790, 120], [300, 1000, 150], [330, 790, -30], [600, 770, 0], [1020, 790, 10], [1060, 880, 60], [1080, 1010, 120]];
const tourPts = tourPx.map(([x, y]) => { const [a, b] = px2m(x, y); return new THREE.Vector3(a, 0, b); });
const tourCurve = new THREE.CatmullRomCurve3(tourPts, false, 'centripetal', 0.5);
const tourLen = tourCurve.getLength();
const tour = { on: false, t: 0, speed: 0.75 };
function tourPose(u) { // u in [0,1]
  const p = tourCurve.getPointAt(u), q = tourCurve.getPointAt(Math.min(1, u + 0.012));
  const dir = Math.atan2(-(q.x - p.x), -(q.z - p.z));
  return { x: p.x, z: p.z, yaw: dir };
}
function setTour(on) { tour.on = on; document.getElementById('tourBtn').textContent = on ? '停止漫游' : '自动漫游'; }
document.getElementById('tourBtn').onclick = () => setTour(!tour.on);
const startEl = document.getElementById('start');
document.getElementById('go').onclick = () => { startEl.classList.add('hide'); if (!MOBILE) renderer.domElement.requestPointerLock(); };
document.getElementById('go2').onclick = () => { startEl.classList.add('hide'); setTour(true); };
renderer.domElement.addEventListener('click', () => { if (!MOBILE && startEl.classList.contains('hide') && !tour.on) renderer.domElement.requestPointerLock(); });
if (Q.has('tour')) { startEl.classList.add('hide'); setTour(true); }
if (Q.has('ui') && Q.get('ui') === '0') { startEl.classList.add('hide'); document.getElementById('hud').classList.add('hide'); joyEl.style.display = 'none'; }

// ---------- minimap
const dot = document.getElementById('dot'), cone = document.getElementById('cone');
function updateMini() {
  const [px, py] = m2px(player.x, player.z);
  const l = ((px - 160) / 1030) * 100, t = ((py - 470) / 710) * 100;
  dot.style.left = cone.style.left = l + '%'; dot.style.top = cone.style.top = t + '%';
  cone.style.transform = `rotate(${-player.yaw}rad)`;
}

// ---------- post
let composer = null;
function buildComposer() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 16 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  ao.blendIntensity = 1.0;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  composer.addPass(new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()));
}
if (HQ) buildComposer();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (composer) composer.setSize(innerWidth, innerHeight); });

// ---------- loop
const clock = new THREE.Clock();
let manual = false;
function step(dt) {
  if (tour.on) {
    tour.t += (tour.speed * dt) / tourLen; if (tour.t > 1) tour.t = 0;
    const p = tourPose(tour.t);
    let dy = p.yaw - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    player.x = p.x; player.z = p.z; player.yaw += dy * Math.min(1, dt * 2.5); player.pitch += (-0.06 - player.pitch) * Math.min(1, dt * 2);
  } else {
    let f = 0, s = 0;
    if (keys.KeyW || keys.ArrowUp) f += 1; if (keys.KeyS || keys.ArrowDown) f -= 1;
    if (keys.KeyD || keys.ArrowRight) s += 1; if (keys.KeyA || keys.ArrowLeft) s -= 1;
    f -= joy.y; s += joy.x;
    const sp = (keys.ShiftLeft ? 2.6 : 1.5) * dt;
    const dx = (-Math.sin(player.yaw) * f + Math.cos(player.yaw) * s) * sp, dz = (-Math.cos(player.yaw) * f - Math.sin(player.yaw) * s) * sp;
    if (!blocked(player.x + dx, player.z)) player.x += dx;
    if (!blocked(player.x, player.z + dz)) player.z += dz;
  }
}
function applyCam() { camera.position.set(player.x, player.eye, player.z); camera.rotation.set(player.pitch, player.yaw, 0); updateMini(); }
function render() { if (composer) composer.render(); else renderer.render(scene, camera); }
renderer.setAnimationLoop(() => { const dt = Math.min(clock.getDelta(), 0.05); if (!manual) step(dt); applyCam(); render(); });

await Promise.allSettled(pending);
document.getElementById('loading').remove();

// ---------- debug / capture API
let topCam = null;
window.__FP3D = {
  ready: true, scene, camera, renderer, player, plan,
  setView(x, y, z, lx, ly, lz) { manual = true; player.x = x; player.z = z; player.eye = y; const d = new THREE.Vector3(lx - x, ly - y, lz - z); player.yaw = Math.atan2(-d.x, -d.z); player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); applyCam(); render(); },
  setPx(px, py, yawDeg, pitch = -0.08) { manual = true; const [x, z] = px2m(px, py); Object.assign(player, { x, z, yaw: THREE.MathUtils.degToRad(yawDeg), pitch }); applyCam(); render(); },
  tourFrame(u) { manual = true; tour.on = false; const p = tourPose(u); player.x = p.x; player.z = p.z; return p; },
  tourAt(u, yaw) { manual = true; const p = tourPose(u); Object.assign(player, { x: p.x, z: p.z, yaw, pitch: -0.06 }); applyCam(); render(); },
  tourPoseAt: tourPose,
  topDown(scale = 2) { // ortho top view registered to floorplan crop px 160..1190 x 470..1180
    manual = true;
    const [l, t] = px2m(160, 470), [r, b] = px2m(1190, 1180);
    topCam = new THREE.OrthographicCamera(l, r, -t, -b, 0.1, 50);
    topCam.position.set(0, 20, 0); topCam.up.set(0, 0, -1); topCam.lookAt(0, 0, 0);
    hideInTop.forEach((o) => (o.visible = false)); scene.background = new THREE.Color(0xffffff);
    renderer.setPixelRatio(1); renderer.setSize(1030 * scale, 710 * scale);
    renderer.render(scene, topCam);
    renderer.setAnimationLoop(null);
  },
};

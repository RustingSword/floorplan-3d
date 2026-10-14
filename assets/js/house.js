import * as THREE from 'three';
import { createFurniture, clearFurnitureColliders, getFurnitureColliders } from './furniture.js';

const CEILING = 2.8;
const WALL_T = 0.12;
const DOOR_H = 2.1;

/** Wall segment colliders for player (AABB in XZ) */
const wallColliders = [];

export function getWallColliders() {
  return wallColliders;
}

export function getAllColliders() {
  return wallColliders.concat(getFurnitureColliders());
}

function wallBox(mat, x, y, z, w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Add horizontal wall along X at z, with optional door openings [{x,w}] */
function addWallX(group, mat, x0, x1, z, y0, h, openings = []) {
  const segs = subtractOpenings(x0, x1, openings);
  for (const [a, b] of segs) {
    const w = b - a;
    if (w < 0.05) continue;
    group.add(wallBox(mat, (a + b) / 2, y0 + h / 2, z, w, h, WALL_T));
    wallColliders.push({
      minX: a - WALL_T / 2, maxX: b + WALL_T / 2,
      minZ: z - WALL_T / 2 - 0.05, maxZ: z + WALL_T / 2 + 0.05
    });
  }
  // lintels above doors
  for (const op of openings) {
    const lh = CEILING - DOOR_H;
    if (lh > 0.05) {
      group.add(wallBox(mat, op.x, DOOR_H + lh / 2, z, op.w, lh, WALL_T));
    }
  }
}

/** Add vertical wall along Z at x, with optional openings [{z,w}] */
function addWallZ(group, mat, z0, z1, x, y0, h, openings = []) {
  const segs = subtractOpenings(z0, z1, openings.map(o => ({ x: o.z, w: o.w })));
  for (const [a, b] of segs) {
    const d = b - a;
    if (d < 0.05) continue;
    group.add(wallBox(mat, x, y0 + h / 2, (a + b) / 2, WALL_T, h, d));
    wallColliders.push({
      minX: x - WALL_T / 2 - 0.05, maxX: x + WALL_T / 2 + 0.05,
      minZ: a - WALL_T / 2, maxZ: b + WALL_T / 2
    });
  }
  for (const op of openings) {
    const lh = CEILING - DOOR_H;
    if (lh > 0.05) {
      group.add(wallBox(mat, x, DOOR_H + lh / 2, op.z, WALL_T, lh, op.w));
    }
  }
}

function subtractOpenings(a, b, openings) {
  let segs = [[a, b]];
  for (const op of openings) {
    const o0 = op.x - op.w / 2;
    const o1 = op.x + op.w / 2;
    const next = [];
    for (const [s0, s1] of segs) {
      if (o1 <= s0 || o0 >= s1) { next.push([s0, s1]); continue; }
      if (o0 > s0) next.push([s0, Math.max(s0, o0)]);
      if (o1 < s1) next.push([Math.min(s1, o1), s1]);
    }
    segs = next;
  }
  return segs;
}

function floorMesh(mat, x, z, w, d, y = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x + w / 2, y, z + d / 2);
  m.receiveShadow = true;
  if (mat.map) {
    m.material = mat.clone();
    m.material.map = mat.map.clone();
    m.material.map.wrapS = m.material.map.wrapT = THREE.RepeatWrapping;
    // 800×800 mm large-format tiles
    const tileM = 0.8;
    m.material.map.repeat.set(Math.max(1, w / tileM), Math.max(1, d / tileM));
    m.material.map.needsUpdate = true;
  }
  return m;
}

function ceilingMesh(mat, x, z, w, d) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x + w / 2, CEILING, z + d / 2);
  return m;
}

function glassPanel(mats, x, y, z, w, h, rotY = 0) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.glass);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return g;
}

function railing(group, mats, x0, x1, z, alongX = true) {
  const posts = alongX ? Math.max(2, Math.floor((x1 - x0) / 0.8)) : Math.max(2, Math.floor((x1 - x0) / 0.8));
  // for alongX: x0..x1 at fixed z; for alongZ: treat x0..x1 as z0..z1 at fixed x stored in z param somehow
  if (alongX) {
    for (let i = 0; i <= posts; i++) {
      const x = x0 + ((x1 - x0) * i) / posts;
      group.add(wallBox(mats.railing, x, 0.55, z, 0.04, 1.1, 0.04));
    }
    group.add(wallBox(mats.railing, (x0 + x1) / 2, 1.05, z, x1 - x0, 0.04, 0.04));
    group.add(wallBox(mats.railing, (x0 + x1) / 2, 0.55, z, x1 - x0, 0.03, 0.03));
  }
}

function railingZ(group, mats, z0, z1, x) {
  const posts = Math.max(2, Math.floor((z1 - z0) / 0.8));
  for (let i = 0; i <= posts; i++) {
    const zz = z0 + ((z1 - z0) * i) / posts;
    group.add(wallBox(mats.railing, x, 0.55, zz, 0.04, 1.1, 0.04));
  }
  group.add(wallBox(mats.railing, x, 1.05, (z0 + z1) / 2, 0.04, 0.04, z1 - z0));
}

/**
 * Build full house from rooms.json data
 */
export function buildHouse(data, mats) {
  wallColliders.length = 0;
  clearFurnitureColliders();

  const root = new THREE.Group();
  root.name = 'house';

  const byId = Object.fromEntries(data.rooms.map(r => [r.id, r]));

  // Floors + ceilings + furniture
  for (const room of data.rooms) {
    const { x, z, w, d } = room.rect;
    const floorMat = mats[room.floor] || mats.grey_marble;
    root.add(floorMesh(floorMat, x, z, w, d, 0.002));
    if (room.ceiling !== false) {
      root.add(ceilingMesh(mats.ceiling, x, z, w, d));
    }
    for (const f of room.furniture || []) {
      root.add(createFurniture(f.type, mats, f));
    }
  }

  // Extra wood floor pad for bedroom_3 (avoids marble bleed at entry)
  {
    const b3 = byId.bedroom_3;
    if (b3) {
      const { x, z, w, d } = b3.rect;
      root.add(floorMesh(mats.dark_wood, x - 0.05, z - 0.05, w + 0.1, d + 0.15, 0.004));
    }
  }

  // Continuous ceiling over open living + dining + kitchen (seals sky leaks)
  root.add(ceilingMesh(mats.ceiling, 7.3, 1.8, 6.9, 8.5));
  root.add(ceilingMesh(mats.ceiling, 11.2, 7.3, 2.6, 3.1));

  // ——— Structural walls (key partitions) ———
  const W = mats.wall;

  // Exterior south wall — wide living sliding glass (~full living width)
  addWallX(root, W, 0, 14.01, 1.8, 0, CEILING, [
    { x: 2.0, w: 1.8 }, { x: 5.5, w: 1.5 }, { x: 10.7, w: 5.2 }
  ]);
  root.add(glassPanel(mats, 2.0, 1.1, 1.8, 1.7, 2.1));
  root.add(glassPanel(mats, 5.5, 1.1, 1.8, 1.4, 2.1));
  // continuous living sliding panes with mullions
  for (const gx of [8.5, 9.8, 11.1, 12.4]) {
    root.add(glassPanel(mats, gx, 1.1, 1.8, 1.15, 2.1));
    root.add(wallBox(mats.railing, gx + 0.58, 1.1, 1.8, 0.04, 2.1, 0.04));
  }

  // West exterior
  addWallZ(root, W, 1.8, 10.3, 0, 0, CEILING, []);
  // North exterior of upper rooms (z=10.3) with openings
  addWallX(root, W, 0, 13.625, 10.3, 0, CEILING, [
    { x: 1.3, w: 1.2 }, { x: 4.1, w: 2.0 }, { x: 9.3, w: 2.8 }, { x: 12.5, w: 1.2 }
  ]);
  root.add(glassPanel(mats, 1.3, 1.8, 10.3, 1.1, 0.7));
  root.add(glassPanel(mats, 4.1, 1.6, 10.3, 1.9, 1.3));
  root.add(glassPanel(mats, 9.3, 1.1, 10.3, 2.7, 2.1));
  root.add(glassPanel(mats, 12.5, 1.6, 10.3, 1.1, 0.9));

  // Master | Bed2 wall at x=4.1
  addWallZ(root, W, 1.8, 5.9, 4.1, 0, CEILING, []);

  // Bed2 | Living at x=7.41
  addWallZ(root, W, 1.8, 5.9, 7.41, 0, CEILING, [
    { z: 5.4, w: 1.0 } // opening toward hall
  ]);

  // Living | Bed3 at x=14.01
  addWallZ(root, W, 1.8, 5.9, 14.01, 0, CEILING, []);

  // Bed3 east exterior
  addWallZ(root, W, 1.8, 5.9, 17.21, 0, CEILING, [
    { z: 3.8, w: 1.5 }
  ]);
  root.add(glassPanel(mats, 17.21, 1.6, 3.8, 1.4, 1.3, Math.PI / 2));

  // Bed3 south wall
  addWallX(root, W, 14.01, 17.21, 1.8, 0, CEILING, [
    { x: 15.6, w: 2.0 }
  ]);
  root.add(glassPanel(mats, 15.6, 1.6, 1.8, 1.9, 1.3));

  // Hall strip walls z=5.9
  addWallX(root, W, 0, 2.6, 5.9, 0, CEILING, [{ x: 1.3, w: 0.9 }]); // master to closet
  addWallX(root, W, 2.6, 7.41, 5.9, 0, CEILING, [
    { x: 5.7, w: 0.85 } // bed2 door
  ]);
  // Open living ↔ dining: only short wing walls at corners
  addWallX(root, W, 7.41, 7.9, 5.9, 0, CEILING, []);
  addWallX(root, W, 13.5, 14.01, 5.9, 0, CEILING, []);

  // Closet / upper boundary z=7.4
  addWallX(root, W, 0, 7.4, 7.4, 0, CEILING, [
    { x: 1.3, w: 0.8 }, // ensuite
    { x: 4.1, w: 0.85 }, // study
    { x: 6.5, w: 0.75 } // bath2
  ]);

  // Partition bath1 | study at x=2.6
  addWallZ(root, W, 5.9, 10.3, 2.6, 0, CEILING, [
    { z: 6.65, w: 0.85 }
  ]);

  // study | bath2 at x=5.6
  addWallZ(root, W, 7.4, 10.3, 5.6, 0, CEILING, []);

  // bath2 | dining at x=7.4
  addWallZ(root, W, 5.9, 10.3, 7.4, 0, CEILING, [
    { z: 6.65, w: 1.2 }
  ]);

  // dining | kitchen at x=11.325
  addWallZ(root, W, 7.4, 10.3, 11.325, 0, CEILING, [
    { z: 8.5, w: 1.6 }
  ]);

  // kitchen | service at x=13.625
  addWallZ(root, W, 8.5, 10.3, 13.625, 0, CEILING, [
    { z: 9.4, w: 0.8 }
  ]);

  // kitchen south toward entry
  addWallX(root, W, 11.325, 13.625, 7.4, 0, CEILING, [
    { x: 12.5, w: 0.9 }
  ]);

  // entry / bed3 north wall
  addWallX(root, W, 14.01, 17.21, 5.9, 0, CEILING, [
    { x: 14.9, w: 0.9 }
  ]);

  // entry east wall & exterior door north of entry
  addWallZ(root, W, 5.9, 8.4, 15.025, 0, CEILING, []);
  // entry north wall with main door
  addWallX(root, W, 13.625, 15.025, 8.4, 0, CEILING, [
    { x: 14.3, w: 1.0 }
  ]);

  // Service balcony railings / north wall open
  addWallX(root, W, 13.625, 15.875, 10.3, 0, 1.1, []);
  railing(root, mats, 13.625, 15.875, 10.3, true);
  railingZ(root, mats, 8.5, 10.3, 15.875);

  // South balcony railings
  railing(root, mats, 0, 14.01, 0.05, true);
  railingZ(root, mats, 0, 1.8, 0.05);
  railingZ(root, mats, 0, 1.8, 14.01);

  // North balcony railings
  railing(root, mats, 7.4, 11.325, 11.45, true);
  railingZ(root, mats, 10.3, 11.5, 7.4);
  railingZ(root, mats, 10.3, 11.5, 11.325);

  // Bed3 wardrobe wall already via furniture

  // Warm interior fill — kept modest so sun shadows read on the floor
  const roomLights = [
    [2.0, 3.8, 1.8], [5.7, 3.8, 1.5], [10.5, 3.8, 2.2], [15.6, 3.8, 1.4],
    [1.3, 8.5, 1.4], [4.1, 8.5, 1.4], [9.3, 8.0, 2.0], [12.5, 8.6, 1.8]
  ];
  for (const [lx, lz, intens] of roomLights) {
    const pl = new THREE.PointLight(0xffe4c4, intens, 5.5, 2);
    pl.position.set(lx, 2.45, lz);
    root.add(pl);
  }

  return root;
}

export { CEILING };

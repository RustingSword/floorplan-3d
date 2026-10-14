import * as THREE from 'three';

const colliders = [];

export function getFurnitureColliders() {
  return colliders;
}

export function clearFurnitureColliders() {
  colliders.length = 0;
}

function addCollider(x, z, w, d) {
  colliders.push({ x, z, w, d, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}

function box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function roundedBox(mat, w, h, d, r, x, y, z) {
  let geo;
  if (THREE.RoundedBoxGeometry) {
    geo = new THREE.RoundedBoxGeometry(w, h, d, 4, r);
  } else {
    geo = new THREE.BoxGeometry(w, h, d);
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Build furniture group at world x,z with rotation around Y */
export function createFurniture(type, mats, item) {
  const g = new THREE.Group();
  g.position.set(item.x, 0, item.z);
  g.rotation.y = item.rot || 0;
  const sx = item.sx || 1;
  const sz = item.sz || 1;

  switch (type) {
    case 'double_bed': {
      g.add(box(mats.wood_furniture, 1.8, 0.35, 2.1, 0, 0.2, 0));
      g.add(box(mats.mattress, 1.7, 0.25, 2.0, 0, 0.5, 0));
      g.add(box(mats.duvet, 1.7, 0.08, 1.35, 0, 0.66, 0.05));
      g.add(box(mats.fabric_beige, 1.7, 0.05, 0.9, 0, 0.72, 0.15));
      g.add(box(mats.wood_furniture, 1.85, 0.95, 0.1, 0, 0.72, -1.0));
      g.add(box(mats.pillow, 0.55, 0.18, 0.4, -0.4, 0.72, -0.75));
      g.add(box(mats.pillow, 0.55, 0.18, 0.4, 0.4, 0.72, -0.75));
      g.add(box(mats.fabric_cream, 0.45, 0.14, 0.32, -0.4, 0.85, -0.7));
      g.add(box(mats.fabric_cream, 0.45, 0.14, 0.32, 0.4, 0.85, -0.7));
      addCollider(item.x, item.z, 1.9, 2.2);
      break;
    }
    case 'nightstand': {
      g.add(box(mats.wood_furniture, 0.45, 0.5, 0.4, 0, 0.25, 0));
      g.add(box(mats.chrome, 0.04, 0.32, 0.04, 0, 0.66, 0));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.2, 16), mats.lampshade);
      shade.position.set(0, 0.95, 0);
      shade.castShadow = true;
      g.add(shade);
      const lampLight = new THREE.PointLight(0xffe8cc, 2.2, 3.5, 2);
      lampLight.position.set(0, 0.9, 0);
      g.add(lampLight);
      addCollider(item.x, item.z, 0.5, 0.45);
      break;
    }
    case 'loveseat': {
      const seat = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.28, 10, 24, Math.PI * 0.9), mats.fabric);
      seat.rotation.x = Math.PI / 2;
      seat.position.y = 0.32;
      seat.castShadow = true;
      g.add(seat);
      const back = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.14, 8, 20, Math.PI * 0.9), mats.fabric);
      back.rotation.x = Math.PI / 2;
      back.position.y = 0.58;
      g.add(back);
      addCollider(item.x, item.z, 1.4, 1.1);
      break;
    }
    case 'side_table': {
      g.add(box(mats.white_paint, 0.4, 0.45, 0.4, 0, 0.225, 0));
      addCollider(item.x, item.z, 0.45, 0.45);
      break;
    }
    case 'wardrobe': {
      const w = sx || 2.0;
      g.add(box(mats.wood_furniture, w, 2.4, 0.55, 0, 1.2, 0));
      const panels = Math.max(2, Math.round(w / 0.55));
      for (let i = 0; i < panels; i++) {
        const px = -w / 2 + 0.08 + (i + 0.5) * ((w - 0.16) / panels);
        g.add(box(mats.fabric_beige, (w - 0.16) / panels - 0.04, 2.15, 0.02, px, 1.2, 0.28));
        g.add(box(mats.chrome, 0.02, 0.28, 0.02, px + 0.12, 1.2, 0.3));
      }
      addCollider(item.x, item.z, w + 0.1, 0.65);
      break;
    }
    case 'desk': {
      g.add(box(mats.walnut, 1.4, 0.05, 0.7, 0, 0.75, 0));
      g.add(box(mats.wood_dark, 0.06, 0.75, 0.06, -0.6, 0.375, -0.28));
      g.add(box(mats.wood_dark, 0.06, 0.75, 0.06, 0.6, 0.375, -0.28));
      g.add(box(mats.wood_dark, 0.06, 0.75, 0.06, -0.6, 0.375, 0.28));
      g.add(box(mats.wood_dark, 0.06, 0.75, 0.06, 0.6, 0.375, 0.28));
      addCollider(item.x, item.z, 1.5, 0.8);
      break;
    }
    case 'office_chair': {
      g.add(box(mats.fabric, 0.45, 0.08, 0.45, 0, 0.45, 0));
      g.add(box(mats.fabric, 0.45, 0.5, 0.08, 0, 0.75, -0.2));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), mats.chrome)).position.set(0, 0.25, 0);
      addCollider(item.x, item.z, 0.55, 0.55);
      break;
    }
    case 'round_sofa': {
      // Two facing C-rings extruded from plan shapes (no torus end-cap holes)
      const sofaMat = mats.fabric;
      const ringSeg = (rOut, rIn, a0, a1, y0, h) => {
        const shape = new THREE.Shape();
        const steps = 56;
        for (let i = 0; i <= steps; i++) {
          const a = a0 + (a1 - a0) * (i / steps);
          const x = Math.cos(a) * rOut, z = Math.sin(a) * rOut;
          if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
        }
        for (let i = steps; i >= 0; i--) {
          const a = a0 + (a1 - a0) * (i / steps);
          shape.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
        }
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: h, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2
        });
        geo.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(geo, sofaMat);
        m.position.y = y0;
        m.castShadow = true;
        m.receiveShadow = true;
        return m;
      };
      // SW module
      g.add(ringSeg(1.55, 1.0, -0.45, Math.PI * 0.85, 0.02, 0.4));
      g.add(ringSeg(1.62, 1.42, -0.4, Math.PI * 0.82, 0.4, 0.38));
      // NE module
      g.add(ringSeg(1.35, 0.88, Math.PI * 0.9, Math.PI * 1.85, 0.02, 0.38));
      g.add(ringSeg(1.42, 1.22, Math.PI * 0.95, Math.PI * 1.8, 0.38, 0.36));
      // cream cushions as flattened spheres on seats
      [[-1.0, 0.52, 0.85], [0.3, 0.52, 1.15], [1.05, 0.52, 0.4],
       [-0.65, 0.5, -0.8], [0.5, 0.5, -0.95]].forEach(([cx, cy, cz]) => {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), mats.fabric_cream);
        c.scale.set(1.4, 0.65, 1.15);
        c.position.set(cx, cy, cz);
        c.castShadow = true;
        g.add(c);
      });
      addCollider(item.x, item.z, 3.2, 3.0);
      break;
    }
    case 'coffee_table': {
      const shape = new THREE.Shape();
      shape.moveTo(0.55, 0.05);
      shape.bezierCurveTo(0.6, 0.35, 0.25, 0.55, -0.05, 0.45);
      shape.bezierCurveTo(-0.45, 0.3, -0.55, -0.05, -0.35, -0.35);
      shape.bezierCurveTo(-0.1, -0.55, 0.35, -0.4, 0.55, 0.05);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 3, curveSegments: 20
      });
      geo.rotateX(-Math.PI / 2);
      const top = new THREE.Mesh(geo, mats.wood_dark);
      top.position.y = 0.38;
      top.castShadow = true;
      top.receiveShadow = true;
      g.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.36, 12), mats.wood_dark);
      leg.position.set(0, 0.18, 0);
      g.add(leg);
      addCollider(item.x, item.z, 1.2, 1.0);
      break;
    }
    case 'rug_round': {
      const r = item.r || 1.8;
      const rug = new THREE.Mesh(new THREE.CircleGeometry(r, 64), mats.rug);
      rug.rotation.x = -Math.PI / 2;
      rug.position.y = 0.012;
      rug.receiveShadow = true;
      g.add(rug);
      break;
    }
    case 'rug_rect': {
      const rug = box(mats.rug_warm, sx, 0.02, sz || 2, 0, 0.01, 0);
      g.add(rug);
      break;
    }
    case 'grand_piano': {
      const pb = mats.piano_black;
      // curved grand body (keyboard at -Z)
      const shape = new THREE.Shape();
      shape.moveTo(-0.7, -1.0);
      shape.lineTo(0.7, -1.0);
      shape.lineTo(0.7, 0.2);
      shape.quadraticCurveTo(0.7, 1.1, 0.0, 1.18);
      shape.quadraticCurveTo(-0.55, 1.02, -0.7, 0.28);
      shape.closePath();
      const body = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.28, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2
        }),
        pb
      );
      body.rotation.x = -Math.PI / 2;
      body.position.y = 0.58;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      // side rim walls
      g.add(box(pb, 0.04, 0.28, 1.9, -0.68, 0.78, 0.05));
      g.add(box(pb, 0.04, 0.28, 1.5, 0.68, 0.78, -0.1));
      // hinged lid — open ~35°, pivot near curved end
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 0.88, 0.35);
      lidPivot.rotation.x = -0.62;
      const lid = box(pb, 1.28, 0.02, 1.55, 0, 0, -0.55);
      lidPivot.add(lid);
      g.add(lidPivot);
      g.add(box(pb, 0.02, 0.48, 0.02, 0.5, 0.95, 0.15)); // prop
      // three legs
      [[-0.5, -0.7], [0.5, -0.7], [0.0, 0.75]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.05, 0.55, 10), pb);
        leg.position.set(lx, 0.28, lz);
        leg.castShadow = true;
        g.add(leg);
      });
      // keyboard + keys (recognisable)
      g.add(box(pb, 1.32, 0.12, 0.36, 0, 0.64, -1.12));
      for (let i = 0; i < 28; i++) {
        g.add(box(mats.piano_white, 0.044, 0.02, 0.28, -0.6 + i * 0.044, 0.71, -1.12));
      }
      [1, 2, 4, 5, 6, 8, 9, 11, 12, 13, 15, 16, 18, 19, 20, 22, 23, 25, 26].forEach((i) => {
        g.add(box(mats.black_keys, 0.026, 0.025, 0.17, -0.58 + i * 0.044, 0.725, -1.06));
      });
      // bench
      g.add(box(pb, 0.7, 0.06, 0.3, 0, 0.46, -1.62));
      [[-0.26, -1.52], [0.26, -1.52], [-0.26, -1.72], [0.26, -1.72]].forEach(([lx, lz]) => {
        g.add(box(pb, 0.035, 0.42, 0.035, lx, 0.21, lz));
      });
      g.add(box(mats.fabric, 0.68, 0.04, 0.28, 0, 0.51, -1.62));
      addCollider(item.x, item.z, 1.7, 2.8);
      break;
    }
    case 'dining_table_6': {
      const tableMat = mats.walnut;
      const oval = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 48), tableMat);
      oval.scale.set(1.3, 1, 0.72);
      oval.position.y = 0.75;
      oval.castShadow = true;
      oval.receiveShadow = true;
      g.add(oval);
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.72, 16), tableMat);
      pedestal.position.set(0, 0.36, 0);
      pedestal.castShadow = true;
      g.add(pedestal);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 24), tableMat);
      base.position.set(0, 0.02, 0);
      g.add(base);
      const positions = [
        [-1.1, -0.4], [-1.1, 0.4],
        [1.1, -0.4], [1.1, 0.4],
        [0, -0.95], [0, 0.95]
      ];
      positions.forEach(([cx, cz]) => {
        const ch = new THREE.Group();
        ch.add(box(mats.fabric_beige, 0.42, 0.06, 0.42, 0, 0.46, 0));
        ch.add(box(mats.fabric, 0.42, 0.48, 0.07, 0, 0.72, -0.18));
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
          ch.add(box(mats.wood_dark, 0.035, 0.46, 0.035, a * 0.15, 0.23, b * 0.15));
        });
        ch.position.set(cx, 0, cz);
        ch.rotation.y = Math.atan2(cx, cz) + Math.PI;
        g.add(ch);
      });
      // vase centerpiece
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 12), mats.ceramic);
      vase.position.set(0, 0.9, 0);
      g.add(vase);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), mats.plant);
      flower.position.set(0, 1.08, 0);
      g.add(flower);
      addCollider(item.x, item.z, 2.8, 2.2);
      break;
    }
    case 'kitchen_counter_l': {
      // U-run base cabinets 900 mm + countertop + uppers + appliances
      const cab = mats.cabinet_white;
      const addCabRun = (w, d, x, z) => {
        g.add(box(cab, w, 0.9, d, x, 0.45, z));
        // door seams
        const doors = Math.max(1, Math.round(Math.max(w, d) / 0.5));
        for (let i = 1; i < doors; i++) {
          if (w >= d) {
            const sx = x - w / 2 + (i / doors) * w;
            g.add(box(mats.wall_accent, 0.01, 0.75, 0.01, sx, 0.45, z + d / 2 - 0.02));
          } else {
            const sz = z - d / 2 + (i / doors) * d;
            g.add(box(mats.wall_accent, 0.01, 0.75, 0.01, x + d / 2 - 0.02, 0.45, sz));
          }
        }
        g.add(box(mats.chrome, 0.02, 0.02, 0.12, x, 0.55, z + (w >= d ? d / 2 - 0.02 : 0)));
      };
      addCabRun(2.1, 0.55, 0, 0.95);       // north
      addCabRun(0.55, 2.0, 0.8, 0.1);      // east (hob)
      addCabRun(0.55, 1.2, -0.75, 0.4);    // west stub
      // countertops
      g.add(box(mats.counter, 2.12, 0.04, 0.58, 0, 0.92, 0.95));
      g.add(box(mats.counter, 0.58, 0.04, 2.02, 0.8, 0.92, 0.1));
      g.add(box(mats.counter, 0.58, 0.04, 1.22, -0.75, 0.92, 0.4));
      // sink basin + faucet
      g.add(box(mats.chrome, 0.5, 0.08, 0.38, -0.2, 0.9, 0.95));
      g.add(box(mats.ceramic_blue, 0.42, 0.1, 0.3, -0.2, 0.86, 0.95));
      g.add(box(mats.chrome, 0.03, 0.28, 0.03, -0.2, 1.1, 0.78));
      g.add(box(mats.chrome, 0.12, 0.03, 0.03, -0.2, 1.22, 0.82));
      // 4-burner hob
      g.add(box(mats.hood, 0.55, 0.035, 0.52, 0.8, 0.96, 0.15));
      [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]].forEach(([bx, bz]) => {
        const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 16), mats.chrome);
        burner.position.set(0.8 + bx, 0.985, 0.15 + bz);
        g.add(burner);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16), mats.black_keys);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0.8 + bx, 0.995, 0.15 + bz);
        g.add(ring);
      });
      // range hood
      g.add(box(mats.hood, 0.6, 0.08, 0.45, 0.8, 1.85, 0.15));
      g.add(box(mats.hood, 0.18, 0.55, 0.18, 0.8, 2.2, 0.15));
      // upper cabinets (north + west)
      g.add(box(cab, 1.5, 0.7, 0.34, -0.15, 2.15, 1.12));
      g.add(box(cab, 0.34, 0.7, 1.0, -0.85, 2.15, 0.5));
      for (let i = 0; i < 3; i++) {
        g.add(box(mats.chrome, 0.08, 0.015, 0.015, -0.55 + i * 0.45, 2.0, 1.28));
      }
      addCollider(item.x, item.z, 2.4, 2.2);
      break;
    }
    case 'fridge': {
      g.add(box(mats.appliance, 0.7, 1.9, 0.7, 0, 0.95, 0));
      g.add(box(mats.chrome, 0.02, 0.4, 0.05, 0.36, 1.2, 0));
      addCollider(item.x, item.z, 0.8, 0.8);
      break;
    }
    case 'stove': {
      g.add(box(mats.appliance, 0.6, 0.9, 0.55, 0, 0.45, 0));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), mats.black_keys)).position.set(-0.15, 0.92, 0.05);
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), mats.black_keys)).position.set(0.15, 0.92, 0.05);
      addCollider(item.x, item.z, 0.7, 0.65);
      break;
    }
    case 'sink': {
      g.add(box(mats.ceramic_blue, 0.7, 0.15, 0.45, 0, 0.95, 0));
      g.add(box(mats.chrome, 0.04, 0.25, 0.04, 0, 1.15, -0.1));
      addCollider(item.x, item.z, 0.8, 0.55);
      break;
    }
    case 'bathtub': {
      g.add(box(mats.ceramic_blue, 1.6, 0.55, 0.75, 0, 0.3, 0));
      g.add(box(mats.ceramic, 1.45, 0.15, 0.6, 0, 0.5, 0));
      addCollider(item.x, item.z, 1.7, 0.85);
      break;
    }
    case 'toilet': {
      g.add(box(mats.ceramic, 0.4, 0.4, 0.55, 0, 0.25, 0));
      g.add(box(mats.ceramic, 0.4, 0.45, 0.2, 0, 0.55, -0.2));
      addCollider(item.x, item.z, 0.5, 0.65);
      break;
    }
    case 'shower': {
      g.add(box(mats.bath_tile, 0.9, 0.05, 0.9, 0, 0.025, 0));
      const glass = box(mats.glass, 0.02, 2.0, 0.9, 0.45, 1.0, 0);
      g.add(glass);
      g.add(box(mats.glass, 0.9, 2.0, 0.02, 0, 1.0, 0.45));
      g.add(box(mats.chrome, 0.04, 0.3, 0.04, -0.3, 1.6, -0.3));
      addCollider(item.x, item.z, 1.0, 1.0);
      break;
    }
    case 'vanity':
    case 'double_vanity': {
      const w = type === 'double_vanity' ? 1.4 : 0.8;
      g.add(box(mats.white_paint, w, 0.7, 0.5, 0, 0.4, 0));
      g.add(box(mats.ceramic_blue, w * 0.4, 0.1, 0.35, type === 'double_vanity' ? -0.3 : 0, 0.8, 0));
      if (type === 'double_vanity') {
        g.add(box(mats.ceramic_blue, w * 0.4, 0.1, 0.35, 0.3, 0.8, 0));
      }
      g.add(box(mats.chrome, 0.5, 0.7, 0.02, 0, 1.5, -0.22));
      addCollider(item.x, item.z, w + 0.1, 0.6);
      break;
    }
    case 'plant': {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.3, 12), mats.pot)).position.set(0, 0.15, 0);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), mats.plant);
        leaf.position.set((Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3);
        leaf.scale.set(1, 1.4, 0.6);
        g.add(leaf);
      }
      addCollider(item.x, item.z, 0.4, 0.4);
      break;
    }
    case 'floor_lamp': {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.05, 16), mats.chrome)).position.set(0, 0.025, 0);
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8), mats.chrome)).position.set(0, 0.8, 0);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.35, 16, 1, true), mats.fabric);
      shade.position.set(0, 1.7, 0);
      g.add(shade);
      const light = new THREE.PointLight(0xffe4c4, 2.5, 5, 2);
      light.position.set(0, 1.55, 0);
      g.add(light);
      addCollider(item.x, item.z, 0.4, 0.4);
      break;
    }
    case 'outdoor_table': {
      g.add(box(mats.wood_furniture, 0.7, 0.05, 0.7, 0, 0.7, 0));
      g.add(box(mats.wood_furniture, 0.06, 0.7, 0.06, 0, 0.35, 0));
      addCollider(item.x, item.z, 0.8, 0.8);
      break;
    }
    case 'outdoor_chair': {
      g.add(box(mats.wood_furniture, 0.5, 0.08, 0.5, 0, 0.4, 0));
      g.add(box(mats.wood_furniture, 0.5, 0.45, 0.06, 0, 0.65, -0.22));
      addCollider(item.x, item.z, 0.55, 0.55);
      break;
    }
    case 'lounge_chair': {
      g.add(box(mats.fabric_beige, 0.7, 0.35, 0.8, 0, 0.3, 0));
      g.add(box(mats.fabric, 0.7, 0.5, 0.15, 0, 0.55, -0.35));
      addCollider(item.x, item.z, 0.8, 0.9);
      break;
    }
    case 'washing_machine': {
      g.add(box(mats.appliance, 0.6, 0.85, 0.6, 0, 0.425, 0));
      const door = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), mats.chrome);
      door.rotation.x = Math.PI / 2;
      door.position.set(0, 0.45, 0.3);
      g.add(door);
      addCollider(item.x, item.z, 0.7, 0.7);
      break;
    }
    case 'cabinet': {
      g.add(box(mats.white_paint, 0.8, 1.2, 0.4, 0, 0.6, 0));
      addCollider(item.x, item.z, 0.9, 0.5);
      break;
    }
    case 'console': {
      g.add(box(mats.wood_furniture, 0.9, 0.8, 0.35, 0, 0.4, 0));
      addCollider(item.x, item.z, 1.0, 0.45);
      break;
    }
    default:
      g.add(box(mats.white_paint, 0.5, 0.5, 0.5, 0, 0.25, 0));
  }

  return g;
}

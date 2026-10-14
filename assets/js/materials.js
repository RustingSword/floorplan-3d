import * as THREE from 'three';

function canvasTex(draw, size = 512, repeat = 2) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  return tex;
}

/** Soft grey marble — one 800×800 mm tile with fine grout, gentle veining */
function marbleMap() {
  return canvasTex((ctx, s) => {
    // mid grey base
    ctx.fillStyle = '#7a7e84';
    ctx.fillRect(0, 0, s, s);

    // soft mottling (low contrast)
    for (let i = 0; i < 120; i++) {
      const g = 105 + Math.random() * 45;
      ctx.fillStyle = `rgba(${g},${g + 1},${g + 3},${0.04 + Math.random() * 0.07})`;
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * s, Math.random() * s,
        30 + Math.random() * 90, 18 + Math.random() * 50,
        Math.random() * Math.PI, 0, Math.PI * 2
      );
      ctx.fill();
    }

    // soft veins — muted, not bright white zigzags
    for (let i = 0; i < 18; i++) {
      const v = 130 + Math.random() * 40;
      ctx.strokeStyle = `rgba(${v},${v + 2},${v + 4},${0.12 + Math.random() * 0.18})`;
      ctx.lineWidth = 1.2 + Math.random() * 2.2;
      ctx.beginPath();
      let x = Math.random() * s;
      let y = Math.random() * s;
      ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) {
        x += (Math.random() - 0.5) * 70;
        y += 25 + Math.random() * 55;
        ctx.quadraticCurveTo(
          x + (Math.random() - 0.5) * 40,
          y - 15,
          x, y
        );
      }
      ctx.stroke();
    }

    // darker soft veins
    for (let i = 0; i < 10; i++) {
      ctx.strokeStyle = `rgba(55,58,62,${0.08 + Math.random() * 0.12})`;
      ctx.lineWidth = 0.8 + Math.random() * 1.5;
      ctx.beginPath();
      let x = Math.random() * s;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < s) {
        x += (Math.random() - 0.5) * 35;
        y += 20 + Math.random() * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // fine grout around single 800 mm tile
    ctx.strokeStyle = 'rgba(48,50,54,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, s - 3, s - 3);
  }, 512, 1);
}

function rugSwirlMap() {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = '#3d4550';
    ctx.fillRect(0, 0, s, s);
    const colors = ['#5a6a7a', '#6b5344', '#4a5560', '#8a7a68', '#2f3a44', '#a09080'];
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.35 + Math.random() * 0.4;
      ctx.lineWidth = 8 + Math.random() * 28;
      ctx.beginPath();
      const cx = s * 0.5 + (Math.random() - 0.5) * 80;
      const cy = s * 0.5 + (Math.random() - 0.5) * 80;
      const r = 40 + Math.random() * (s * 0.4);
      ctx.arc(cx, cy, r, Math.random() * Math.PI, Math.random() * Math.PI + 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, 512, 1);
}

function woodMap() {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = '#3d2918';
    ctx.fillRect(0, 0, s, s);
    const plankH = s / 8;
    for (let row = 0; row < 8; row++) {
      const y = row * plankH;
      const base = 45 + (row % 3) * 8;
      ctx.fillStyle = `rgb(${base + 20},${base - 5},${base - 25})`;
      ctx.fillRect(0, y, s, plankH - 1);
      ctx.strokeStyle = 'rgba(20,12,8,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y + plankH); ctx.lineTo(s, y + plankH); ctx.stroke();
      for (let k = 0; k < 5; k++) {
        ctx.strokeStyle = `rgba(80,50,25,${0.08 + Math.random() * 0.1})`;
        ctx.beginPath();
        const x0 = Math.random() * s;
        ctx.moveTo(x0, y + 2);
        ctx.bezierCurveTo(x0 + 40, y + plankH * 0.4, x0 - 20, y + plankH * 0.7, x0 + 30, y + plankH - 2);
        ctx.stroke();
      }
    }
  }, 512, 4);
}

function walnutMap() {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = '#3a2416';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      const y = (i / 40) * s;
      const shade = 40 + (i % 5) * 6;
      ctx.strokeStyle = `rgba(${shade + 30},${shade},${shade - 10},0.35)`;
      ctx.lineWidth = 2 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + 4, s * 0.7, y - 4, s, y + 2);
      ctx.stroke();
    }
  }, 256, 2);
}

function tileMap(base = '#c8ccd0') {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    const n = 4;
    const t = s / n;
    ctx.strokeStyle = 'rgba(90,92,96,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i * t, 0); ctx.lineTo(i * t, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * t); ctx.lineTo(s, i * t); ctx.stroke();
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.035})`;
      ctx.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
    }
  }, 256, 4);
}

function fabricMap(color = '#e8e4dc') {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  }, 256, 2);
}

export function createMaterials() {
  const marble = marbleMap();
  const wood = woodMap();
  const walnut = walnutMap();
  const bathTile = tileMap('#d5d8dc');
  const kitTile = tileMap('#e4e2dc');
  const balcTile = tileMap('#a8adb4');
  const fabricGrey = fabricMap('#8e949c');
  const fabricBeige = fabricMap('#c9c0b4');
  const fabricBlue = fabricMap('#5a6a7a');
  const fabricCream = fabricMap('#cfc6ba');
  const rugTex = rugSwirlMap();

  return {
    grey_marble: new THREE.MeshStandardMaterial({
      map: marble, roughness: 0.22, metalness: 0.08, color: 0xffffff,
      envMapIntensity: 0.55
    }),
    dark_wood: new THREE.MeshStandardMaterial({
      map: wood, roughness: 0.55, metalness: 0.0, color: 0xffffff,
      envMapIntensity: 0.35
    }),
    bath_tile: new THREE.MeshStandardMaterial({
      map: bathTile, roughness: 0.35, metalness: 0.0, envMapIntensity: 0.4
    }),
    kitchen_tile: new THREE.MeshStandardMaterial({
      map: kitTile, roughness: 0.4, metalness: 0.0, envMapIntensity: 0.35
    }),
    balcony_tile: new THREE.MeshStandardMaterial({
      map: balcTile, roughness: 0.45, metalness: 0.0, envMapIntensity: 0.4
    }),
    wall: new THREE.MeshStandardMaterial({
      color: 0xcfcac2, roughness: 0.88, metalness: 0.0, envMapIntensity: 0.2
    }),
    wall_accent: new THREE.MeshStandardMaterial({
      color: 0xc4bfb6, roughness: 0.85, metalness: 0.0, envMapIntensity: 0.2
    }),
    ceiling: new THREE.MeshStandardMaterial({
      color: 0xf2f0ec, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.1
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xb8d4e8, metalness: 0, roughness: 0.05,
      transmission: 0.85, thickness: 0.05, transparent: true, opacity: 0.45,
      side: THREE.DoubleSide, envMapIntensity: 0.6
    }),
    railing: new THREE.MeshStandardMaterial({
      color: 0x4a4a4a, metalness: 0.85, roughness: 0.25, envMapIntensity: 0.7
    }),
    fabric: new THREE.MeshStandardMaterial({
      map: fabricGrey, roughness: 0.85, metalness: 0.0, envMapIntensity: 0.25
    }),
    fabric_beige: new THREE.MeshStandardMaterial({
      map: fabricBeige, roughness: 0.88, metalness: 0.0, envMapIntensity: 0.25
    }),
    fabric_cream: new THREE.MeshStandardMaterial({
      map: fabricCream, roughness: 0.88, metalness: 0.0, envMapIntensity: 0.25
    }),
    fabric_blue: new THREE.MeshStandardMaterial({
      map: fabricBlue, roughness: 0.85, metalness: 0.0, envMapIntensity: 0.25
    }),
    wood_furniture: new THREE.MeshStandardMaterial({
      color: 0x5c4030, roughness: 0.45, metalness: 0.05, envMapIntensity: 0.4
    }),
    wood_dark: new THREE.MeshStandardMaterial({
      color: 0x2a1a10, roughness: 0.4, metalness: 0.05, envMapIntensity: 0.45
    }),
    walnut: new THREE.MeshStandardMaterial({
      map: walnut, color: 0xffffff, roughness: 0.38, metalness: 0.05, envMapIntensity: 0.5
    }),
    white_paint: new THREE.MeshStandardMaterial({
      color: 0xe8e6e2, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.3
    }),
    cabinet_white: new THREE.MeshStandardMaterial({
      color: 0xeceae6, roughness: 0.42, metalness: 0.02, envMapIntensity: 0.35
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xdddddd, metalness: 0.95, roughness: 0.15, envMapIntensity: 0.9
    }),
    ceramic: new THREE.MeshStandardMaterial({
      color: 0xf8f8f8, roughness: 0.2, metalness: 0.0, envMapIntensity: 0.5
    }),
    ceramic_blue: new THREE.MeshStandardMaterial({
      color: 0x7ba3c4, roughness: 0.25, metalness: 0.0, envMapIntensity: 0.45
    }),
    black_keys: new THREE.MeshStandardMaterial({
      color: 0x111111, roughness: 0.4, metalness: 0.1, envMapIntensity: 0.4
    }),
    piano_black: new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0a, roughness: 0.12, metalness: 0.35,
      clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.0
    }),
    piano_white: new THREE.MeshStandardMaterial({
      color: 0xf5f5f2, roughness: 0.35, metalness: 0.05, envMapIntensity: 0.4
    }),
    rug: new THREE.MeshStandardMaterial({
      map: rugTex, color: 0xffffff, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.15
    }),
    rug_warm: new THREE.MeshStandardMaterial({
      color: 0x6b5344, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.15
    }),
    rug_teal: new THREE.MeshStandardMaterial({
      color: 0x3d5a5c, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.15
    }),
    plant: new THREE.MeshStandardMaterial({
      color: 0x2d5a27, roughness: 0.8, metalness: 0.0, envMapIntensity: 0.2
    }),
    pot: new THREE.MeshStandardMaterial({
      color: 0x8b6914, roughness: 0.6, metalness: 0.0, envMapIntensity: 0.3
    }),
    mattress: new THREE.MeshStandardMaterial({
      color: 0xb8b0a4, roughness: 0.88, metalness: 0.0, envMapIntensity: 0.2
    }),
    duvet: new THREE.MeshStandardMaterial({
      color: 0xc4bbb0, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.2
    }),
    pillow: new THREE.MeshStandardMaterial({
      color: 0xd8d2c8, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.2
    }),
    counter: new THREE.MeshStandardMaterial({
      color: 0xd4d0c8, roughness: 0.28, metalness: 0.08, envMapIntensity: 0.55
    }),
    appliance: new THREE.MeshStandardMaterial({
      color: 0xd0d0d0, metalness: 0.65, roughness: 0.28, envMapIntensity: 0.7
    }),
    hood: new THREE.MeshStandardMaterial({
      color: 0x2a2a2a, metalness: 0.7, roughness: 0.3, envMapIntensity: 0.6
    }),
    lampshade: new THREE.MeshStandardMaterial({
      color: 0xe8dfd0, roughness: 0.75, metalness: 0.0, emissive: 0xffe8c8, emissiveIntensity: 0.15
    })
  };
}

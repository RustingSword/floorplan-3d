import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { createMaterials } from './materials.js';
import { buildHouse } from './house.js';
import { Player } from './player.js';
import { AutoTour } from './tour.js';

const BASE = new URL('.', import.meta.url); // assets/js/
const SITE = new URL('../', BASE); // assets/
const ROOT = new URL('../../', BASE); // site/ — but rooms.json is outside site

async function loadRooms() {
  const candidates = [
    new URL('../../rooms.json', import.meta.url), // site/rooms.json
    new URL('./rooms.json', window.location.href),
    new URL('../../../rooms.json', import.meta.url)
  ];
  for (const u of candidates) {
    try {
      const r = await fetch(u);
      if (r.ok) return await r.json();
    } catch (_) { /* continue */ }
  }
  throw new Error('Could not load rooms.json');
}

function isMobile() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

function setupMinimap(player, footprint) {
  const dot = document.getElementById('minimap-dot');
  const map = document.getElementById('minimap');
  // Floorplan image crop is approximate: plan occupies left~78% of jpg
  // Map world x,z -> minimap %
  const W = footprint.width;
  const D = footprint.depth;
  return function updateMinimap() {
    const x = player.camera.position.x;
    const z = player.camera.position.z;
    // image object-position focuses plan; map to 8%–78% width, 12%–82% height of minimap box
    const left = 8 + (x / W) * 70;
    const top = 82 - (z / D) * 70;
    dot.style.left = `${Math.max(5, Math.min(95, left))}%`;
    dot.style.top = `${Math.max(5, Math.min(95, top))}%`;
    // arrow points in look direction; yaw 0 looks down -Z in three default... our player uses look
    const yaw = player.yaw;
    // plan: +z = north = up on minimap; three yaw: 0 faces -z (south). Convert:
    const deg = (-yaw * 180) / Math.PI;
    dot.style.transform = `rotate(${deg}deg)`;
  };
}

function setupMobile(player) {
  const wrap = document.getElementById('mobile-controls');
  if (!isMobile()) return;
  wrap.classList.remove('hidden');
  document.getElementById('hint').textContent = 'Joystick move · drag right to look';

  const joy = document.getElementById('joystick');
  const knob = document.getElementById('joystick-knob');
  const lookPad = document.getElementById('look-pad');
  let jid = null;
  const origin = { x: 0, y: 0 };

  function joyPos(e, touch) {
    const t = touch || e;
    const rect = joy.getBoundingClientRect();
    return { x: t.clientX - rect.left - rect.width / 2, y: t.clientY - rect.top - rect.height / 2 };
  }

  joy.addEventListener('pointerdown', (e) => {
    jid = e.pointerId;
    joy.setPointerCapture(jid);
    origin.x = 0; origin.y = 0;
    const p = joyPos(e);
    const len = Math.min(40, Math.hypot(p.x, p.y));
    const a = Math.atan2(p.y, p.x);
    knob.style.transform = `translate(${Math.cos(a) * len}px, ${Math.sin(a) * len}px)`;
    player.setMobileInput(Math.cos(a) * len / 40, -Math.sin(a) * len / 40);
  });
  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId !== jid) return;
    const p = joyPos(e);
    const len = Math.min(40, Math.hypot(p.x, p.y) || 0);
    const a = Math.atan2(p.y, p.x);
    knob.style.transform = `translate(${Math.cos(a) * len}px, ${Math.sin(a) * len}px)`;
    player.setMobileInput((Math.cos(a) * len) / 40, (-Math.sin(a) * len) / 40);
  });
  const endJoy = (e) => {
    if (e.pointerId !== jid) return;
    jid = null;
    knob.style.transform = 'translate(0,0)';
    player.setMobileInput(0, 0);
  };
  joy.addEventListener('pointerup', endJoy);
  joy.addEventListener('pointercancel', endJoy);

  let lid = null, lx = 0, ly = 0;
  lookPad.addEventListener('pointerdown', (e) => {
    lid = e.pointerId;
    lookPad.setPointerCapture(lid);
    lx = e.clientX; ly = e.clientY;
  });
  lookPad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lid) return;
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    player.lookDelta(dx, dy);
  });
  lookPad.addEventListener('pointerup', () => { lid = null; });
}

async function main() {
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Gradient sky backdrop
  {
    const skyC = document.createElement('canvas');
    skyC.width = 4; skyC.height = 256;
    const sctx = skyC.getContext('2d');
    const grad = sctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#87b0d0');
    grad.addColorStop(0.4, '#b8d0e4');
    grad.addColorStop(0.7, '#d4e0ea');
    grad.addColorStop(1, '#e4ddd0');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 4, 256);
    const skyTex = new THREE.CanvasTexture(skyC);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    scene.background = skyTex;
  }
  scene.fog = new THREE.Fog(0xc8d4dc, 32, 75);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 120);

  // Environment
  try {
    const hdr = await new RGBELoader().loadAsync(new URL('../textures/env.hdr', import.meta.url).href);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdr;
    if ('environmentIntensity' in scene) scene.environmentIntensity = 0.4;
  } catch (e) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    if ('environmentIntensity' in scene) scene.environmentIntensity = 0.35;
  }

  // Lights — lower exposure, visible sun shadows, warm interior
  const amb = new THREE.AmbientLight(0xfff0e0, 0.22);
  scene.add(amb);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.55);
  sun.position.set(10, 16, -8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 45;
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -6;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(9, 0, 5);
  const fill = new THREE.DirectionalLight(0xb8c8e0, 0.28);
  fill.position.set(-6, 7, 10);
  scene.add(fill);

  const rooms = await loadRooms();
  // Copy rooms.json into site for static hosting
  const mats = createMaterials();
  const house = buildHouse(rooms, mats);
  scene.add(house);

  // Exterior plaza (muted) + distant city silhouette
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x6a6e72, roughness: 0.95, envMapIntensity: 0.2 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(8, -0.08, 6);
  ground.receiveShadow = true;
  scene.add(ground);

  const city = new THREE.Group();
  city.name = 'cityscape';
  // Daytime distant buildings (not night neon)
  const bldgMat = new THREE.MeshStandardMaterial({
    color: 0x9aa3ad, roughness: 0.9, metalness: 0.02, envMapIntensity: 0.2
  });
  const bldgDark = new THREE.MeshStandardMaterial({
    color: 0x7a8490, roughness: 0.88, metalness: 0.04, envMapIntensity: 0.2
  });
  const bldgWarm = new THREE.MeshStandardMaterial({
    color: 0xb0a89c, roughness: 0.92, metalness: 0.02, envMapIntensity: 0.18
  });
  const windowDay = new THREE.MeshStandardMaterial({
    color: 0x7a9bb0, roughness: 0.35, metalness: 0.2, envMapIntensity: 0.4
  });
  const matsCycle = [bldgMat, bldgDark, bldgWarm];
  const addFacade = (bx, bz, bw, bh, bd, faceSouth) => {
    for (let wy = 2; wy < bh - 1; wy += 2.4) {
      for (let wx = -bw / 2 + 1.3; wx < bw / 2 - 0.5; wx += 2.1) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.85), windowDay);
        w.position.set(bx + wx, wy, bz + (faceSouth ? bd / 2 + 0.02 : -bd / 2 - 0.02));
        if (!faceSouth) w.rotation.y = Math.PI;
        city.add(w);
      }
    }
  };
  // South skyline (beyond living balcony)
  [
    [-18, -14, 8, 16, 6], [-8, -16, 10, 20, 8], [4, -15, 7, 12, 5],
    [14, -17, 9, 22, 7], [26, -14, 11, 14, 6], [38, -16, 8, 18, 9],
    [-28, -18, 12, 11, 10], [48, -15, 10, 13, 8]
  ].forEach(([bx, bz, bw, bh, bd], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), matsCycle[i % 3]);
    m.position.set(bx, bh / 2 - 0.05, bz);
    city.add(m);
    addFacade(bx, bz, bw, bh, bd, true);
  });
  // North skyline (dining balcony)
  [
    [-12, 26, 10, 15, 7], [-2, 28, 8, 12, 5], [8, 27, 11, 18, 8],
    [18, 29, 9, 14, 6], [28, 26, 12, 16, 7], [40, 28, 8, 12, 5],
    [9.3, 32, 14, 10, 4]
  ].forEach(([bx, bz, bw, bh, bd], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), matsCycle[i % 3]);
    m.position.set(bx, bh / 2 - 0.05, bz);
    city.add(m);
    addFacade(bx, bz, bw, bh, bd, false);
  });
  scene.add(city);

  // Continuous slab under open living/dining/hall to seal seams
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(10.5, 0.04, 9.5),
    mats.grey_marble
  );
  slab.position.set(11.0, -0.01, 5.5);
  slab.receiveShadow = true;
  scene.add(slab);

  const player = new Player(camera, canvas);
  const tour = new AutoTour(camera, rooms.tour_path, player);
  const updateMinimap = setupMinimap(player, rooms.meta.footprint_m);
  setupMobile(player);

  const blocker = document.getElementById('blocker');
  const btnStart = document.getElementById('btn-start');
  const btnLock = document.getElementById('btn-lock');
  const btnTour = document.getElementById('btn-tour');

  function enter() {
    blocker.classList.add('hidden');
    if (!isMobile()) player.lock();
  }
  btnStart.addEventListener('click', enter);
  btnLock.addEventListener('click', () => {
    blocker.classList.add('hidden');
    player.lock();
  });
  player.controls.addEventListener('unlock', () => {
    if (!tour.active && !isMobile()) {
      // stay in scene; show hint via button
      btnLock.textContent = 'Click to Walk';
    }
  });
  player.controls.addEventListener('lock', () => {
    btnLock.textContent = 'Walking…';
  });

  btnTour.addEventListener('click', () => {
    if (tour.active) {
      tour.stop();
      btnTour.classList.remove('active');
      btnTour.textContent = 'Auto Tour';
    } else {
      blocker.classList.add('hidden');
      player.unlock();
      tour.start();
      btnTour.classList.add('active');
      btnTour.textContent = 'Stop Tour';
    }
  });
  tour.onDone = () => {
    btnTour.classList.remove('active');
    btnTour.textContent = 'Auto Tour';
  };

  const params = new URLSearchParams(location.search);
  const autoTour = params.get('tour') === '1';
  if (autoTour) {
    blocker.classList.add('hidden');
    blocker.style.display = 'none';
    player.unlock();
    tour.start();
    btnTour.classList.add('active');
    btnTour.textContent = 'Stop Tour';
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });

  canvas.addEventListener('click', () => {
    if (!blocker.classList.contains('hidden')) return;
    if (!isMobile() && !tour.active) player.lock();
  });

  // Debug / critic API
  window.__FP3D = {
    camera,
    player,
    scene,
    renderer,
    rooms,
    setView(x, y, z, lookX, lookY, lookZ) {
      player.touring = true;
      camera.position.set(x, y, z);
      camera.lookAt(lookX, lookY, lookZ);
    },
    topDown(cx, cz, height = 9) {
      player.touring = true;
      camera.position.set(cx, height, cz);
      camera.near = 0.1;
      camera.far = 80;
      camera.fov = 50;
      camera.updateProjectionMatrix();
      camera.lookAt(cx, 0, cz);
    },
    eyeLevel(x, z, lookX, lookZ) {
      player.touring = true;
      camera.fov = 70;
      camera.updateProjectionMatrix();
      camera.position.set(x, 1.6, z);
      camera.lookAt(lookX, 1.2, lookZ);
    },
    resumeWalk() { player.touring = false; }
  };

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    player.update(dt);
    tour.update(dt);
    updateMinimap();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error(err);
  document.getElementById('blocker-inner').innerHTML =
    `<h1>Load error</h1><p>${err.message}</p>`;
});

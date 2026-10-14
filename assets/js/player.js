import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { getAllColliders } from './house.js';

const EYE = 1.6;
const SPEED = 3.2;
const RADIUS = 0.28;

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.keys = { f: false, b: false, l: false, r: false };
    this.mobile = { x: 0, y: 0 };
    this.enabled = true;
    this.touring = false;

    camera.position.set(10.5, EYE, 3.8);

    document.addEventListener('keydown', (e) => this.onKey(e, true));
    document.addEventListener('keyup', (e) => this.onKey(e, false));
  }

  onKey(e, down) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.keys.f = down; break;
      case 'KeyS': case 'ArrowDown': this.keys.b = down; break;
      case 'KeyA': case 'ArrowLeft': this.keys.l = down; break;
      case 'KeyD': case 'ArrowRight': this.keys.r = down; break;
    }
  }

  lock() { this.controls.lock(); }
  unlock() { this.controls.unlock(); }
  get locked() { return this.controls.isLocked; }

  setMobileInput(x, y) {
    this.mobile.x = x;
    this.mobile.y = y;
  }

  lookDelta(dx, dy) {
    if (this.touring) return;
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(this.camera.quaternion);
    euler.y -= dx * 0.0025;
    euler.x -= dy * 0.0025;
    euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x));
    this.camera.quaternion.setFromEuler(euler);
  }

  collide(pos) {
    const colliders = getAllColliders();
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const dist2 = dx * dx + dz * dz;
      if (dist2 < RADIUS * RADIUS) {
        const dist = Math.sqrt(dist2) || 0.0001;
        const push = RADIUS - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      }
    }
    // keep roughly inside footprint
    pos.x = Math.max(0.3, Math.min(17.0, pos.x));
    pos.z = Math.max(0.2, Math.min(11.3, pos.z));
  }

  update(dt) {
    if (this.touring || !this.enabled) return;

    this.direction.set(0, 0, 0);
    const forward = Number(this.keys.f) - Number(this.keys.b);
    const right = Number(this.keys.r) - Number(this.keys.l);
    this.direction.z = forward;
    this.direction.x = right;
    // mobile joystick: y forward, x strafe
    this.direction.z += this.mobile.y;
    this.direction.x += this.mobile.x;

    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();
      const speed = SPEED * dt;
      // move relative to camera yaw
      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.setFromQuaternion(this.camera.quaternion);
      const sin = Math.sin(euler.y);
      const cos = Math.cos(euler.y);
      const dx = this.direction.x * cos + this.direction.z * sin;
      const dz = -this.direction.x * sin + this.direction.z * cos;

      const pos = this.camera.position.clone();
      pos.x += dx * speed;
      this.collide(pos);
      pos.z += dz * speed;
      this.collide(pos);
      pos.y = EYE;
      this.camera.position.copy(pos);
    } else {
      this.camera.position.y = EYE;
    }
  }

  get yaw() {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(this.camera.quaternion);
    return euler.y;
  }
}

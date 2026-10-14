import * as THREE from 'three';

/**
 * Smooth auto-tour along waypoints from rooms.json
 */
export class AutoTour {
  constructor(camera, path, player) {
    this.camera = camera;
    this.path = path;
    this.player = player;
    this.active = false;
    this.seg = 0;
    this.t = 0;
    this.duration = 4.5; // seconds per segment
    this._from = new THREE.Vector3();
    this._to = new THREE.Vector3();
    this._lookFrom = new THREE.Vector3();
    this._lookTo = new THREE.Vector3();
    this.onDone = null;
  }

  start() {
    if (!this.path?.length) return;
    this.active = true;
    this.player.touring = true;
    this.seg = 0;
    this.t = 0;
    this._setupSeg();
  }

  stop() {
    this.active = false;
    this.player.touring = false;
    if (this.onDone) this.onDone();
  }

  _setupSeg() {
    const a = this.path[this.seg];
    const b = this.path[(this.seg + 1) % this.path.length];
    this._from.set(a.x, a.y, a.z);
    this._to.set(b.x, b.y, b.z);
    this._lookFrom.set(a.lookAt[0], a.lookAt[1], a.lookAt[2]);
    this._lookTo.set(b.lookAt[0], b.lookAt[1], b.lookAt[2]);
    if (this.seg === 0 && this.t === 0) {
      this.camera.position.copy(this._from);
      this.camera.lookAt(this._lookFrom);
    }
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt / this.duration;
    const u = smoothstep(Math.min(1, this.t));
    this.camera.position.lerpVectors(this._from, this._to, u);
    const look = new THREE.Vector3().lerpVectors(this._lookFrom, this._lookTo, u);
    this.camera.lookAt(look);

    if (this.t >= 1) {
      this.t = 0;
      this.seg++;
      if (this.seg >= this.path.length - 1) {
        // one full pass then stop at end
        this.seg = this.path.length - 1;
        this.stop();
        return;
      }
      this._setupSeg();
    }
  }
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

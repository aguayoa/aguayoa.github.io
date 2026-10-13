// Scene pieces: floor, palace, Cell Games pillars, the calendar wall, and the fighter.

const lambert = (color) => new THREE.MeshLambertMaterial({ color });

// Shared drag flag so a mouse drag-to-look doesn't count as clicking a month
const pointer = { downAt: null, dragged: false };

// Height of the ground at (x, z): the palace platform is raised slightly
const PALACE = { x: 0, z: 3 };
function groundAt(x, z) {
  const r = Math.hypot(x - PALACE.x, z - PALACE.z);
  return r < 6.4 ? 0.25 : r < 7.2 ? 0.12 : 0;
}

AFRAME.registerComponent("tiled-floor", {
  init() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#f7f4ed";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#ddd6c7";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 256, 256);
    const tex = canvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(200, 200);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshLambertMaterial({ map: tex }));
    mesh.rotation.x = -Math.PI / 2;
    this.el.setObject3D("mesh", mesh);
  },
});

AFRAME.registerComponent("palace-columns", {
  init() {
    const n = 8, r = 5.6, group = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.32, 0.32, 4.8, 24);
    const mat = lambert("#fbf9f4");
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2;
      const col = new THREE.Mesh(geo, mat);
      col.position.set(Math.sin(a) * r, 2.65, Math.cos(a) * r);
      group.add(col);
    }
    this.el.setObject3D("mesh", group);
  },
});

// White concrete pillar in the style of the Cell Games ring corners:
// stepped base, square tapering shaft with bands, pyramid tip.
AFRAME.registerComponent("cell-pillar", {
  init() {
    const g = new THREE.Group();
    const stone = lambert("#f1eee7"), band = lambert("#dcd6ca");
    const box = (w, h, d, y, m) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.y = y;
      g.add(b);
    };
    box(3.4, 1.0, 3.4, 0.5, band);
    box(2.8, 1.0, 2.8, 1.5, stone);

    const H = 22, rBottom = 1.25, rTop = 0.85, base = 2;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, H, 4), stone);
    shaft.rotation.y = Math.PI / 4;
    shaft.position.y = base + H / 2;
    g.add(shaft);

    [0.25, 0.5, 0.75].forEach((f) => {
      const r = rBottom + (rTop - rBottom) * f;
      box(r * Math.SQRT2 + 0.25, 0.45, r * Math.SQRT2 + 0.25, base + H * f, band);
    });
    box(rTop * Math.SQRT2 + 0.35, 0.6, rTop * Math.SQRT2 + 0.35, base + H + 0.3, band);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(rTop * 1.1, 3.2, 4), stone);
    tip.rotation.y = Math.PI / 4;
    tip.position.y = base + H + 0.6 + 1.6;
    g.add(tip);

    this.el.setObject3D("mesh", g);
  },
});

// ── Calendar wall ─────────────────────────────────────────
// The wall entity's origin is the bottom-center of the calendar, so scaling keeps it on the floor.

let focused = null;

AFRAME.registerComponent("month-panel", {
  init() {
    this.home = null;
    this.target = null;
    this.el.addEventListener("click", () => {
      if (pointer.dragged) return;
      if (focused === this) return this.release();
      if (focused) focused.release();
      this.bringClose();
    });
  },
  // Float the month in front of the viewer, wherever the wall currently is
  bringClose() {
    const { pos: camPos, fwd } = headPose();
    const worldPos = camPos.clone().addScaledVector(fwd, 4.2);
    const dummy = new THREE.Object3D();
    dummy.position.copy(worldPos);
    dummy.lookAt(camPos.x, worldPos.y, camPos.z);

    const parent = this.el.object3D.parent;
    parent.updateMatrixWorld();
    const parentQuat = parent.getWorldQuaternion(new THREE.Quaternion());
    const parentScale = parent.getWorldScale(new THREE.Vector3()).x;
    this.target = {
      pos: parent.worldToLocal(worldPos.clone()),
      quat: parentQuat.invert().multiply(dummy.quaternion),
      scale: 0.58 / parentScale,
    };
    focused = this;
  },
  release() {
    this.target = this.home;
    focused = null;
  },
  tick(t, dt) {
    const o = this.el.object3D;
    if (!this.home) {
      this.home = { pos: o.position.clone(), quat: o.quaternion.clone(), scale: o.scale.x };
      this.target = this.home;
    }
    const k = 1 - Math.exp(-(dt || 16) / 120);
    o.position.lerp(this.target.pos, k);
    o.quaternion.slerp(this.target.quat, k);
    const s = o.scale.x + (this.target.scale - o.scale.x) * k;
    o.scale.set(s, s, s);
  },
});

AFRAME.registerComponent("calendar-wall", {
  init() {
    const PW = 6.4, PH = 5.6, GAP = 0.6, cols = 4, rows = 3;
    const left = -((cols * PW + (cols - 1) * GAP) / 2) + PW / 2;
    const bottom = 2.4 + PH / 2;

    this.panels = [];
    for (let i = 0; i < 12; i++) {
      const c = i % cols, r = rows - 1 - Math.floor(i / cols);
      const canvas = document.createElement("canvas");
      canvas.width = 1024; canvas.height = 896;
      const tex = canvasTexture(canvas);

      const group = new THREE.Group();
      const face = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(PW + 0.24, PH + 0.24), new THREE.MeshBasicMaterial({ color: "#d6cebd", fog: false }));
      frame.position.z = -0.03;
      group.add(frame, face);

      const el = document.createElement("a-entity");
      el.classList.add("clickable");
      el.setAttribute("position", `${left + c * (PW + GAP)} ${bottom + r * (PH + GAP)} 0`);
      el.setAttribute("month-panel", "");
      el.addEventListener("loaded", () => el.setObject3D("mesh", group), { once: true });
      this.el.appendChild(el);
      this.panels.push({ canvas, tex });
    }

    const back = new THREE.Mesh(new THREE.BoxGeometry(30, 22, 0.6), lambert("#e9e3d6"));
    back.position.set(0, 12, -0.4);
    this.el.object3D.add(back);

    const tc = document.createElement("canvas");
    tc.width = 2048; tc.height = 512;
    this.titleCanvas = tc;
    this.titleTex = canvasTexture(tc);
    const title = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 5.5),
      new THREE.MeshBasicMaterial({ map: this.titleTex, transparent: true, fog: false })
    );
    title.position.set(0, 27.2, 0);
    this.el.object3D.add(title);
  },
  render(fy) {
    const months = fiscalMonths(fy), events = eventsByDate();
    this.panels.forEach((p, i) => { drawMonth(p.canvas, months[i], events); p.tex.needsUpdate = true; });
    drawTitle(this.titleCanvas, fy);
    this.titleTex.needsUpdate = true;
  },
});

// ── Fighter ───────────────────────────────────────────────
// A stylized martial artist inspired by Cell Games–era Gohan: purple gi,
// red sash, blue wristbands, spiky black hair. "Power up" turns the hair gold
// and adds an aura. Built from simple shapes; faces -Z like the camera.

AFRAME.registerComponent("fighter-avatar", {
  init() {
    const C = { gi: "#5a2d91", sash: "#c8102e", skin: "#f0c39b", boot: "#6b4a2b", band: "#2747a8", hair: "#151515" };
    const root = new THREE.Group();
    const body = new THREE.Group();          // pivots at the hips so the whole body can lean when flying
    body.position.y = 0.92;
    root.add(body);

    const mesh = (geo, color, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, typeof color === "string" ? lambert(color) : color);
      m.position.set(x, y, z);
      return m;
    };

    // Legs (baggy gi pants + shoes), pivot at the hip
    this.legs = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.11, 0, 0);
      pivot.add(mesh(new THREE.CylinderGeometry(0.12, 0.095, 0.74, 12), C.gi, 0, -0.37, 0));
      pivot.add(mesh(new THREE.BoxGeometry(0.15, 0.13, 0.27), C.boot, 0, -0.82, -0.04));
      body.add(pivot);
      return pivot;
    });

    // Torso
    body.add(mesh(new THREE.BoxGeometry(0.36, 0.18, 0.24), C.gi, 0, 0.06, 0));
    body.add(mesh(new THREE.BoxGeometry(0.4, 0.1, 0.27), C.sash, 0, 0.16, 0));
    body.add(mesh(new THREE.BoxGeometry(0.44, 0.48, 0.26), C.gi, 0, 0.44, 0));
    body.add(mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10), C.skin, 0, 0.72, 0));

    // Arms (sleeveless gi), pivot at the shoulder
    this.arms = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.29, 0.64, 0);
      pivot.add(mesh(new THREE.SphereGeometry(0.08, 12, 8), C.gi));
      pivot.add(mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.3, 10), C.skin, 0, -0.17, 0));
      pivot.add(mesh(new THREE.CylinderGeometry(0.052, 0.048, 0.26, 10), C.skin, 0, -0.43, 0));
      pivot.add(mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.09, 10), C.band, 0, -0.52, 0));
      pivot.add(mesh(new THREE.SphereGeometry(0.058, 10, 8), C.skin, 0, -0.6, 0));
      pivot.rotation.z = side * 0.12;
      body.add(pivot);
      return pivot;
    });

    // Head, face, hair
    const head = new THREE.Group();
    head.position.y = 0.88;
    body.add(head);
    head.add(mesh(new THREE.SphereGeometry(0.13, 20, 16), C.skin));
    const dark = lambert("#111111");
    [-1, 1].forEach((side) => {
      head.add(mesh(new THREE.BoxGeometry(0.035, 0.022, 0.01), dark, side * 0.045, 0.0, -0.125));
      head.add(mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), dark, side * 0.047, 0.035, -0.124));
    });

    this.hairMat = lambert(C.hair);
    this.spikes = [];
    const UP = new THREE.Vector3(0, 1, 0);
    const spikeDirs = [
      [0, 1, 0.1, 0.07, 0.24], [0.45, 0.9, 0.25, 0.065, 0.22], [-0.45, 0.9, 0.25, 0.065, 0.22],
      [0.2, 0.75, 0.7, 0.07, 0.26], [-0.2, 0.75, 0.7, 0.07, 0.26], [0, 0.45, 0.95, 0.07, 0.24],
      [0.8, 0.55, 0.2, 0.06, 0.2], [-0.8, 0.55, 0.2, 0.06, 0.2], [0.6, 0.3, 0.7, 0.06, 0.2],
      [-0.6, 0.3, 0.7, 0.06, 0.2], [0.25, 0.95, -0.35, 0.06, 0.18], [-0.25, 0.95, -0.35, 0.06, 0.18],
      [0.12, 0.2, -1, 0.035, 0.12], [-0.18, 0.15, -1, 0.035, 0.11],       // bangs over the forehead
    ];
    head.add(mesh(new THREE.SphereGeometry(0.138, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), this.hairMat, 0, 0.01, 0.01));
    spikeDirs.forEach(([x, y, z, r, h]) => {
      const dir = new THREE.Vector3(x, y, z).normalize();
      const up = dir.clone().lerp(UP, 0.65).normalize();     // powered-up hair stands taller
      const spike = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), this.hairMat);
      head.add(spike);
      this.spikes.push({ spike, dir, up, h });
    });

    // Aura (visible when powered up)
    this.aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 24, 16),
      new THREE.MeshBasicMaterial({ color: "#ffc400", transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, fog: false })
    );
    this.aura.scale.set(1, 1.55, 1);
    this.aura.position.y = 0.95;
    root.add(this.aura);

    // Soft round shadow on the ground
    const sc = document.createElement("canvas");
    sc.width = sc.height = 128;
    const sctx = sc.getContext("2d");
    const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, "rgba(0,0,0,0.35)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    root.add(this.shadow);

    this.root = root;
    this.body = body;
    this.phase = 0;
    this.setPowered(false);
    this.el.setObject3D("mesh", root);
  },

  setPowered(on) {
    this.powered = on;
    this.hairMat.color.set(on ? "#ffd84a" : "#151515");
    this.hairMat.emissive = new THREE.Color(on ? "#6b5200" : "#000000");
    this.aura.visible = on;
    this.spikes.forEach(({ spike, dir, up, h }) => {
      const d = on ? up : dir;
      const len = on ? h * 1.25 : h;
      spike.scale.set(1, len / h, 1);
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      spike.position.copy(d).multiplyScalar(0.11 + len / 2 - 0.02);
    });
  },

  // speed: m/s along the ground; airborne: above the floor; ground: floor height under the fighter
  animate(dt, speed, airborne, ground, t) {
    const k = 1 - Math.exp(-dt * 10);
    const moving = speed > 0.2;
    let legL = 0, legR = 0, armL = 0, armR = 0, lean = 0, bob = 0;

    if (airborne) {
      lean = moving ? -0.55 : 0;
      legL = 0.25; legR = -0.1;
      armL = armR = moving ? 0.5 : -0.15;
    } else if (moving) {
      this.phase += dt * (4 + speed * 0.9);
      const amp = Math.min(1, speed / 6);
      const s = Math.sin(this.phase);
      legL = s * 0.75 * amp; legR = -legL;
      armL = -s * 0.6 * amp; armR = -armL;
      bob = Math.abs(Math.cos(this.phase)) * 0.05 * amp;
      lean = -0.08 * amp;
    }

    const lerp = (a, b) => a + (b - a) * k;
    this.legs[0].rotation.x = lerp(this.legs[0].rotation.x, legL);
    this.legs[1].rotation.x = lerp(this.legs[1].rotation.x, legR);
    this.arms[0].rotation.x = lerp(this.arms[0].rotation.x, armL);
    this.arms[1].rotation.x = lerp(this.arms[1].rotation.x, armR);
    this.body.rotation.x = lerp(this.body.rotation.x, lean);
    this.body.position.y = 0.92 + bob + (airborne ? Math.sin(t / 400) * 0.04 : 0);

    if (this.powered) {
      const p = 1 + Math.sin(t / 90) * 0.04;
      this.aura.scale.set(p, 1.55 * p, p);
      this.aura.material.opacity = 0.28 + Math.sin(t / 70) * 0.07;
    }

    // keep the shadow on the floor and fade it as the fighter rises
    const height = this.el.object3D.position.y - ground;
    this.shadow.position.y = -height + 0.02;
    const fade = Math.max(0.15, 1 - height / 12);
    this.shadow.scale.setScalar(fade);
  },
});

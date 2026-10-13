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
// Layouts: "year" (4×3 grid) or "list" (month tabs down the left, selected month large on the right).
// Any month can also be brought to the front, floating in front of the viewer.
// Clicking the calendar shows its controls: layout buttons, size buttons, and a drag-to-resize handle.

const WALL = { PW: 6.4, PH: 5.6, GAP: 0.6, cols: 4, rows: 3 };
const HIDDEN = 0.0001;
const basic = (opts) => new THREE.MeshBasicMaterial({ fog: false, ...opts });
const makeCanvas = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });

AFRAME.registerComponent("calendar-wall", {
  init() {
    const { PW, PH, GAP, cols, rows } = WALL;
    this.fy = DEFAULT_FY;
    this.layout = "year";
    this.selected = 0;
    this.front = null;          // index of the month floating in front of the viewer
    this.frontPose = null;
    this.selectedDay = null;
    this.controlsShown = false;
    this.resizing = null;
    this.items = [];            // entities eased toward a target pose every frame

    const left = -((cols * PW + (cols - 1) * GAP) / 2) + PW / 2;
    const bottom = 2.4 + PH / 2;
    this.gridPos = (i) => new THREE.Vector3(left + (i % cols) * (PW + GAP), bottom + (rows - 1 - Math.floor(i / cols)) * (PH + GAP), 0);
    this.tabPos = (i) => new THREE.Vector3(-11.6, 21.4 - i * 1.5, 0.05);
    this.bigPos = new THREE.Vector3(4.25, 11.6, 0.05);
    this.bigScale = 3;

    // Back slab: clicking empty wall shows the controls
    const slab = this.addClickable(new THREE.Mesh(new THREE.BoxGeometry(30, 22, 0.6), lambert("#e9e3d6")), () => this.showControls(true));
    this.track(slab, new THREE.Vector3(0, 12, -0.4), 1);

    // Months
    this.months = Array.from({ length: 12 }, (_, i) => {
      const canvas = makeCanvas(1024, 896), tex = canvasTexture(canvas);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), basic({ map: tex }));
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(PW + 0.24, PH + 0.24), basic({ color: "#d6cebd" }));
      frame.position.z = -0.03;
      const group = new THREE.Group();
      group.add(frame, face);
      const el = this.addClickable(group, (e) => this.onMonthClick(i, face, e));
      return { canvas, tex, item: this.track(el, this.gridPos(i), 1) };
    });

    // Month tabs for the list layout
    this.tabs = Array.from({ length: 12 }, (_, i) => {
      const canvas = makeCanvas(1024, 200), tex = canvasTexture(canvas);
      const el = this.addClickable(new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1.13), basic({ map: tex })), () => this.selectMonth(i));
      return { canvas, tex, item: this.track(el, this.tabPos(i), HIDDEN) };
    });

    // Toolbar (above the calendar) — hidden until the calendar is clicked
    const buttons = [
      { id: "year", label: "Year", w: 3.0 },
      { id: "list", label: "Month list", w: 4.4 },
      { id: "front", label: "Bring to front", w: 5.4 },
      { id: "smaller", label: "−", w: 1.5 },
      { id: "bigger", label: "+", w: 1.5 },
      { id: "reset", label: "Reset", w: 2.6 },
      { id: "close", label: "✕", w: 1.5 },
    ];
    const gap = 0.3, total = buttons.reduce((s, b) => s + b.w, 0) + gap * (buttons.length - 1);
    let x = -total / 2;
    this.buttons = buttons.map((b) => {
      const canvas = makeCanvas(Math.round(b.w * 160), 208), tex = canvasTexture(canvas);
      const el = this.addClickable(new THREE.Mesh(new THREE.PlaneGeometry(b.w, 1.3), basic({ map: tex })), () => this.onButton(b.id));
      const pos = new THREE.Vector3(x + b.w / 2, 24.1, 0.1);
      x += b.w + gap;
      return { ...b, canvas, tex, item: this.track(el, pos, HIDDEN) };
    });

    // Drag-to-resize handle on the bottom-right corner
    const hc = makeCanvas(256, 256);
    drawHandle(hc);
    const handle = this.addClickable(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), basic({ map: canvasTexture(hc), transparent: true })));
    handle.addEventListener("mousedown", (e) => this.startResize(e.detail.cursorEl));
    this.handle = this.track(handle, new THREE.Vector3(15.1, 1.1, 0.4), HIDDEN);

    // Title
    this.titleCanvas = makeCanvas(2048, 512);
    this.titleTex = canvasTexture(this.titleCanvas);
    const title = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.5), basic({ map: this.titleTex, transparent: true }));
    title.position.set(0, 28.6, 0);
    this.el.object3D.add(title);

    // Desktop drag-to-resize
    window.addEventListener("pointermove", (e) => {
      if (!this.resizing || this.resizing.hand) return;
      this.el.emit("wall-scale", { scale: this.el.object3D.scale.x * Math.exp((e.movementX - e.movementY) * 0.002) });
    });
    window.addEventListener("pointerup", () => this.endResize());
  },

  // Create a clickable child entity holding a mesh
  addClickable(object, onClick) {
    const el = document.createElement("a-entity");
    el.classList.add("clickable");
    el.addEventListener("loaded", () => el.setObject3D("mesh", object), { once: true });
    if (onClick) el.addEventListener("click", (e) => { if (!pointer.dragged) onClick(e); });
    this.el.appendChild(el);
    return el;
  },

  track(el, pos, scale) {
    const item = { el, snap: true, target: { pos, quat: new THREE.Quaternion(), scale } };
    this.items.push(item);
    return item;
  },

  setTarget(item, pos, scale, quat = new THREE.Quaternion()) {
    item.target = { pos, quat, scale };
  },

  tick(t, dt) {
    const k = 1 - Math.exp(-(dt || 16) / 120);
    this.items.forEach((item) => {
      if (!item.el.hasLoaded) return;
      const o = item.el.object3D, { pos, quat, scale } = item.target;
      if (item.snap) { o.position.copy(pos); o.quaternion.copy(quat); o.scale.setScalar(scale); item.snap = false; }
      o.position.lerp(pos, k);
      o.quaternion.slerp(quat, k);
      o.scale.setScalar(o.scale.x + (scale - o.scale.x) * k);
      o.visible = o.scale.x > HIDDEN * 20;
    });

    // VR drag-to-resize: move the controller up/right to grow, down/left to shrink
    const r = this.resizing;
    if (r && r.hand) {
      const d = r.hand.object3D.getWorldPosition(new THREE.Vector3()).sub(r.start);
      this.el.emit("wall-scale", { scale: r.startScale * Math.exp((d.x + d.y) * 0.8) });
    }
  },

  // ── Layout ──────────────────────────────────────────────
  applyLayout() {
    const list = this.layout === "list";
    this.months.forEach((m, i) => {
      if (this.front === i && this.frontPose) {
        this.setTarget(m.item, this.frontPose.pos, this.frontPose.scale, this.frontPose.quat);
      } else if (list) {
        this.setTarget(m.item, this.bigPos, i === this.selected ? this.bigScale : HIDDEN);
      } else {
        this.setTarget(m.item, this.gridPos(i), 1);
      }
    });
    this.tabs.forEach((tab, i) => this.setTarget(tab.item, this.tabPos(i), list ? 1 : HIDDEN));
    const shown = this.controlsShown ? 1 : HIDDEN;
    this.buttons.forEach((b) => this.setTarget(b.item, b.item.target.pos, shown));
    this.setTarget(this.handle, this.handle.target.pos, shown);
    this.renderControls();
  },

  setLayout(layout) {
    this.layout = layout;
    this.front = null;
    this.applyLayout();
    this.el.emit("layout-changed", { layout });
  },

  selectMonth(i) {
    this.selected = i;
    this.front = null;
    this.applyLayout();
  },

  toggleFront(i) {
    if (this.front === i) {
      this.front = null;
    } else {
      this.front = i;
      this.selected = i;
      this.frontPose = this.poseInFrontOfViewer();
    }
    this.applyLayout();
  },

  clearFront() {
    if (this.front === null) return false;
    this.front = null;
    this.applyLayout();
    return true;
  },

  // Where to float a month so it sits ~4 m in front of the viewer, in the wall's own coordinates
  poseInFrontOfViewer() {
    // follow the actual gaze (including looking up/down), but keep the month upright
    const cam = document.getElementById("cam").getObject3D("camera");
    const camPos = cam.getWorldPosition(new THREE.Vector3());
    const gaze = cam.getWorldDirection(new THREE.Vector3());
    const worldPos = camPos.clone().addScaledVector(gaze, 4.2);
    const dummy = new THREE.Object3D();
    dummy.position.copy(worldPos);
    dummy.lookAt(camPos.x, worldPos.y, camPos.z);
    const wall = this.el.object3D;
    wall.updateMatrixWorld();
    const wallQuat = wall.getWorldQuaternion(new THREE.Quaternion());
    return {
      pos: wall.worldToLocal(worldPos.clone()),
      quat: wallQuat.invert().multiply(dummy.quaternion),
      scale: 0.5 / wall.getWorldScale(new THREE.Vector3()).x,
    };
  },

  showControls(on) {
    if (this.controlsShown === on) return;
    this.controlsShown = on;
    this.applyLayout();
  },

  onButton(id) {
    if (id === "year" || id === "list") this.setLayout(id);
    if (id === "front") this.toggleFront(this.selected);
    if (id === "smaller") this.el.emit("wall-resize", { factor: 1 / 1.15 });
    if (id === "bigger") this.el.emit("wall-resize", { factor: 1.15 });
    if (id === "reset") this.el.emit("wall-reset");
    if (id === "close") this.showControls(false);
  },

  // Header → bring the month to the front (or send it back). Day → select it and open its summary.
  onMonthClick(i, face, e) {
    this.showControls(true);
    const hit = e.detail.intersection;
    if (!hit || hit.object !== face || !hit.uv) return;
    const cx = hit.uv.x * 1024, cy = (1 - hit.uv.y) * 896;
    if (cy < HEADER_BOTTOM) return this.toggleFront(i);
    const key = dayAt(fiscalMonths(this.fy)[i], cx, cy);
    if (!key) return;
    this.selected = i;
    this.selectedDay = key;
    this.render();
    this.el.emit("day-selected", { key });
  },

  // ── Resize handle ───────────────────────────────────────
  startResize(cursorEl) {
    const hand = cursorEl && cursorEl !== this.el.sceneEl ? cursorEl : null;
    this.resizing = {
      hand,
      startScale: this.el.object3D.scale.x,
      start: hand ? hand.object3D.getWorldPosition(new THREE.Vector3()) : null,
    };
    pointer.dragged = true;
    if (hand) hand.addEventListener("mouseup", () => this.endResize(), { once: true });
  },

  endResize() {
    if (!this.resizing) return;
    this.resizing = null;
    this.el.emit("wall-resize-end");
  },

  // ── Drawing ─────────────────────────────────────────────
  setFY(fy) {
    this.fy = fy;
    const now = new Date();
    const idx = fiscalMonths(fy).findIndex((m) => m.year === now.getFullYear() && m.month === now.getMonth());
    this.selected = idx >= 0 ? idx : 0;
    this.front = null;
    this.render();
    this.applyLayout();
  },

  render() {
    const months = fiscalMonths(this.fy), events = eventsByDate(), notes = window.dayNotes || {};
    this.months.forEach((m, i) => { drawMonth(m.canvas, months[i], events, notes, this.selectedDay); m.tex.needsUpdate = true; });
    drawTitle(this.titleCanvas, this.fy);
    this.titleTex.needsUpdate = true;
    this.renderControls();
  },

  renderControls() {
    const months = fiscalMonths(this.fy);
    this.tabs.forEach((tab, i) => { drawTab(tab.canvas, months[i], i === this.selected); tab.tex.needsUpdate = true; });
    this.buttons.forEach((b) => {
      const active = b.id === this.layout || (b.id === "front" && this.front !== null);
      drawButton(b.canvas, b.label, active);
      b.tex.needsUpdate = true;
    });
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

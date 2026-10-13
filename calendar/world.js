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
// Layouts: "year" (4×3 grid), "list" = Overview (the whole year: one row per month, every day side by side),
// "reminders" (an iMessage-style thread) or "todo" (a checklist). The last two replace the calendar.
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
      el.addEventListener("mousedown", (e) => this.startDayDrag(i, face, e));
      return { canvas, tex, face, hits: [], item: this.track(el, this.gridPos(i), 1) };
    });
    this.selection = null;      // {start, end} day keys while a range is being selected
    this.anchorDay = null;      // last clicked day, for Shift+click ranges
    this.suppressClickUntil = 0;
    window.addEventListener("pointerup", () => this.endDayDrag());

    // Month tabs for the list layout
    this.tabs = Array.from({ length: 12 }, (_, i) => {
      const canvas = makeCanvas(1024, 200), tex = canvasTexture(canvas);
      const el = this.addClickable(new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1.13), basic({ map: tex })), () => this.selectMonth(i));
      return { canvas, tex, item: this.track(el, this.tabPos(i), HIDDEN) };
    });

    // Reminders / to-do board, shown in place of the calendar
    this.boardCanvas = makeCanvas(2048, 1500);
    this.boardTex = canvasTexture(this.boardCanvas);
    this.boardHits = [];
    const boardFace = new THREE.Mesh(new THREE.PlaneGeometry(28, 20.5), basic({ map: this.boardTex }));
    const board = this.addClickable(boardFace, (e) => this.onBoardClick(boardFace, e));
    this.board = this.track(board, new THREE.Vector3(0, 12.1, 0.06), HIDDEN);

    // Overview planner: the whole fiscal year on one big sheet
    this.planCanvas = makeCanvas(PLAN.W, PLAN.H);
    this.planTex = canvasTexture(this.planCanvas);
    this.planHits = [];
    this.planFace = new THREE.Mesh(new THREE.PlaneGeometry(28, 21), basic({ map: this.planTex }));
    const planner = this.addClickable(this.planFace, (e) => this.onPlannerClick(e));
    planner.addEventListener("mousedown", (e) => this.startPlannerDrag(e));
    this.planner = this.track(planner, new THREE.Vector3(0, 12.3, 0.07), HIDDEN);

    // Toolbar (above the calendar) — hidden until the calendar is clicked
    const buttons = [
      { id: "year", label: "Year", w: 2.6 },
      { id: "list", label: "Overview", w: 3.6 },
      { id: "reminders", label: "Reminders", w: 3.8 },
      { id: "todo", label: "To-do", w: 2.8 },
      { id: "front", label: "Bring to front", w: 4.8 },
      { id: "smaller", label: "−", w: 1.4 },
      { id: "bigger", label: "+", w: 1.4 },
      { id: "reset", label: "Reset", w: 2.3 },
      { id: "close", label: "✕", w: 1.4 },
    ];
    const gap = 0.25, total = buttons.reduce((s, b) => s + b.w, 0) + gap * (buttons.length - 1);
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

    this.updateDayDrag();

    // Ringing Reminders button (on entering the room with new reminders)
    if (this.ring) {
      const sec = this.el.sceneEl.time / 1000, elapsed = sec - this.ring.t0;
      if (elapsed > 15) {
        this.stopRinging();
      } else {
        const b = this.buttons.find((x) => x.id === "reminders"), o = b.item.el.object3D;
        const ringing = elapsed % 1.6 < 1.0;              // ring-ring … pause … ring-ring
        o.visible = true;
        o.scale.setScalar(1.3 + (ringing ? Math.abs(Math.sin(sec * 18)) * 0.08 : 0));
        o.rotation.z = ringing ? Math.sin(sec * 55) * 0.1 : 0;
        if (sec - this.ring.drawn > 0.06) {
          drawRingButton(b.canvas, this.ring.count, elapsed, ringing);
          b.tex.needsUpdate = true;
          this.ring.drawn = sec;
        }
      }
    }

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
    const boardView = this.layout === "reminders" || this.layout === "todo";
    this.setTarget(this.board, this.board.target.pos, boardView ? 1 : HIDDEN);
    if (boardView) this.renderBoard();
    this.setTarget(this.planner, this.planner.target.pos, list ? 1 : HIDDEN);
    if (list) this.renderPlanner();
    this.months.forEach((m, i) => {
      if (boardView) {
        this.setTarget(m.item, this.gridPos(i), HIDDEN);
      } else if (this.front === i && this.frontPose) {
        this.setTarget(m.item, this.frontPose.pos, this.frontPose.scale, this.frontPose.quat);
      } else if (list) {
        this.setTarget(m.item, this.gridPos(i), HIDDEN);
      } else {
        this.setTarget(m.item, this.gridPos(i), 1);
      }
    });
    this.tabs.forEach((tab, i) => this.setTarget(tab.item, this.tabPos(i), HIDDEN));
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

  startRinging(count) {
    this.ring = { t0: this.el.sceneEl.time / 1000, count, drawn: 0 };
  },

  stopRinging() {
    if (!this.ring) return;
    this.ring = null;
    const b = this.buttons.find((x) => x.id === "reminders");
    b.item.el.object3D.rotation.z = 0;
    this.applyLayout();
  },

  onButton(id) {
    if (id === "reminders") this.stopRinging();
    if (["year", "list", "reminders", "todo"].includes(id)) this.setLayout(id);
    if (id === "front") this.toggleFront(this.selected);
    if (id === "smaller") this.el.emit("wall-resize", { factor: 1 / 1.15 });
    if (id === "bigger") this.el.emit("wall-resize", { factor: 1.15 });
    if (id === "reset") this.el.emit("wall-reset");
    if (id === "close") this.showControls(false);
  },

  // Header → bring the month to the front (or send it back). Event bar → open that event.
  // Reminder dot → iMessage bubble. Shift+click → range from the last clicked day. Day → its summary.
  onMonthClick(i, face, e) {
    this.showControls(true);
    if (this.el.sceneEl.time < this.suppressClickUntil) return;
    const hit = e.detail.intersection;
    if (!hit || hit.object !== face || !hit.uv) return;
    const cx = hit.uv.x * 1024, cy = (1 - hit.uv.y) * 896;
    if (cy < HEADER_BOTTOM) return this.toggleFront(i);
    const bar = this.months[i].hits.find((h) => cx >= h.x && cx <= h.x + h.w && cy >= h.y && cy <= h.y + h.h);
    if (bar) return this.el.emit("event-open", { id: bar.eventId, point: hit.point.clone() });
    const cell = cellAt(fiscalMonths(this.fy)[i], cx, cy);
    if (!cell) return;
    const key = cell.key;
    const dayReminders = (window.roomData.reminders || []).filter((r) => r.due_date === key);
    if (cell.inDots && dayReminders.length) {
      this.el.emit("reminder-bubble", { key, point: hit.point.clone() });
      return;
    }
    const me = e.detail.mouseEvent;
    if (me && me.shiftKey && this.anchorDay && this.anchorDay !== key) {
      return this.selectRange(this.anchorDay, key);
    }
    this.anchorDay = key;
    this.selected = i;
    this.selectedDay = key;
    this.render();
    this.el.emit("day-selected", { key });
  },

  // ── Overview planner ────────────────────────────────────
  plannerPixel(hit) {
    if (!hit || hit.object !== this.planFace || !hit.uv) return null;
    return [hit.uv.x * PLAN.W, (1 - hit.uv.y) * PLAN.H];
  },

  onPlannerClick(e) {
    this.showControls(true);
    if (this.el.sceneEl.time < this.suppressClickUntil) return;
    const hit = e.detail.intersection, px = this.plannerPixel(hit);
    if (!px) return;
    const h = plannerHit(this.planHits, px[0], px[1]);
    if (!h) return;
    const point = hit.point.clone();
    if (h.type === "event") return this.el.emit("event-open", { id: h.eventId, point });
    if (h.type === "streak") return this.el.emit("streak-click", { key: h.key, area: h.area, point });
    if (h.type === "dots") return this.el.emit("reminder-bubble", { key: h.key, point });
    if (h.type === "month") { this.selected = h.index; return this.toggleFront(h.index); }
    const me = e.detail.mouseEvent;
    if (me && me.shiftKey && this.anchorDay && this.anchorDay !== h.key) return this.selectRange(this.anchorDay, h.key);
    this.anchorDay = h.key;
    this.selectedDay = h.key;
    this.render();
    this.el.emit("day-selected", { key: h.key });
  },

  startPlannerDrag(e) {
    const px = this.plannerPixel(e.detail.intersection);
    if (!px) return;
    const h = plannerHit(this.planHits, px[0], px[1]);
    if (!h || h.type !== "day") return;
    const cursorEl = e.detail.cursorEl && e.detail.cursorEl !== this.el.sceneEl ? e.detail.cursorEl : this.el.sceneEl;
    this.dayDrag = { startKey: h.key, lastKey: h.key, cursorEl };
    pointer.dayDrag = true;
    if (cursorEl !== this.el.sceneEl) cursorEl.addEventListener("mouseup", () => this.endDayDrag(), { once: true });
  },

  renderPlanner() {
    this.planHits = [];
    drawPlanner(this.planCanvas, this.fy, window.roomData || {}, this.planHits, this.selection, this.selectedDay);
    this.planTex.needsUpdate = true;
  },

  // ── Drag across days to make a multi-day event ──────────
  startDayDrag(i, face, e) {
    const hit = e.detail.intersection;
    if (!hit || hit.object !== face || !hit.uv) return;
    const cx = hit.uv.x * 1024, cy = (1 - hit.uv.y) * 896;
    if (cy < HEADER_BOTTOM) return;
    if (this.months[i].hits.some((h) => cx >= h.x && cx <= h.x + h.w && cy >= h.y && cy <= h.y + h.h)) return;
    const cell = cellAt(fiscalMonths(this.fy)[i], cx, cy);
    if (!cell) return;
    if (cell.inDots && (window.roomData.reminders || []).some((r) => r.due_date === cell.key)) return;   // that's a dot click
    const cursorEl = e.detail.cursorEl && e.detail.cursorEl !== this.el.sceneEl ? e.detail.cursorEl : this.el.sceneEl;
    this.dayDrag = { startKey: cell.key, lastKey: cell.key, cursorEl };
    pointer.dayDrag = true;
    if (cursorEl !== this.el.sceneEl) cursorEl.addEventListener("mouseup", () => this.endDayDrag(), { once: true });
  },

  // Which day is under the cursor right now, across all month panels
  dayUnderCursor(cursorEl) {
    const rc = cursorEl.components.raycaster;
    if (!rc) return null;
    if (this.layout === "list") {
      const px = this.plannerPixel(rc.getIntersection(this.planner.el));
      const h = px && plannerHit(this.planHits.filter((x) => x.type === "day"), px[0], px[1]);
      return h ? h.key : null;
    }
    const months = fiscalMonths(this.fy);
    for (let j = 0; j < 12; j++) {
      const m = this.months[j];
      if (m.item.el.object3D.scale.x < 0.01) continue;
      const hit = rc.getIntersection(m.item.el);
      if (!hit || hit.object !== m.face || !hit.uv) continue;
      const cell = cellAt(months[j], hit.uv.x * 1024, (1 - hit.uv.y) * 896);
      if (cell) return cell.key;
    }
    return null;
  },

  updateDayDrag() {
    const d = this.dayDrag;
    if (!d) return;
    const key = this.dayUnderCursor(d.cursorEl);
    if (!key || key === d.lastKey) return;
    d.lastKey = key;
    this.selection = key < d.startKey ? { start: key, end: d.startKey } : { start: d.startKey, end: key };
    this.render();
  },

  endDayDrag() {
    const d = this.dayDrag;
    if (!d) return;
    this.updateDayDrag();          // catch the day under the cursor at the moment of release
    this.dayDrag = null;
    pointer.dayDrag = false;
    if (d.lastKey !== d.startKey) {
      this.suppressClickUntil = this.el.sceneEl.time + 400;   // the drag's release shouldn't also count as a click
      this.selectRange(d.startKey, d.lastKey);
    } else if (this.selection) {
      this.clearSelection();
    }
  },

  selectRange(a, b) {
    this.selection = a <= b ? { start: a, end: b } : { start: b, end: a };
    this.render();
    this.el.emit("range-selected", { ...this.selection });
  },

  clearSelection() {
    if (!this.selection) return;
    this.selection = null;
    this.render();
  },

  onBoardClick(face, e) {
    this.showControls(true);
    const hit = e.detail.intersection;
    if (!hit || hit.object !== face || !hit.uv) return;
    const cx = hit.uv.x * this.boardCanvas.width, cy = (1 - hit.uv.y) * this.boardCanvas.height;
    const target = this.boardHits.find((h) => cx >= h.x && cx <= h.x + h.w && cy >= h.y && cy <= h.y + h.h);
    if (target) this.el.emit("board-action", { action: target.action, id: target.id });
  },

  renderBoard() {
    const data = window.roomData || {};
    this.boardHits = [];
    if (this.layout === "reminders") drawReminderBoard(this.boardCanvas, data.reminders || [], this.boardHits);
    if (this.layout === "todo") drawTodoBoard(this.boardCanvas, data.todos || [], this.boardHits);
    this.boardTex.needsUpdate = true;
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
    const data = window.roomData || {};
    const months = fiscalMonths(this.fy), events = data.events || [], notes = data.notes || {};
    const reminders = {};
    (data.reminders || []).forEach((r) => (reminders[r.due_date] ||= []).push(r));
    this.months.forEach((m, i) => {
      m.hits = [];
      drawMonth(m.canvas, months[i], events, notes, this.selectedDay, reminders, m.hits, this.selection);
      m.tex.needsUpdate = true;
    });
    if (this.layout === "reminders" || this.layout === "todo") this.renderBoard();
    if (this.layout === "list") this.renderPlanner();
    drawTitle(this.titleCanvas, this.fy);
    this.titleTex.needsUpdate = true;
    this.renderControls();
  },

  renderControls() {
    const months = fiscalMonths(this.fy);
    this.tabs.forEach((tab, i) => { drawTab(tab.canvas, months[i], i === this.selected); tab.tex.needsUpdate = true; });
    this.buttons.forEach((b) => {
      const active = b.id === this.layout || (b.id === "front" && this.front !== null && this.layout !== "reminders" && this.layout !== "todo");
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

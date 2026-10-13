// The Gravity Room: a round training chamber with a gravity machine in the middle.
// The machine shows the skill you're training now (higher progress = higher gravity);
// the board lists the skills you're chasing. Click a skill on the board to start training it.

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "ui-monospace, 'Cascadia Mono', Consolas, monospace";
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const AREAS = window.LIFE_AREAS;
const areaOf = (id) => AREAS.find((a) => a.id === id);
const fromArea = areaOf(new URLSearchParams(location.search).get("area"));
const gravityOf = (progress) => Math.round(10 + (progress || 0) * 4.9);   // 10× … 500×
const ROOM_R = 9, ROOM_H = 7.2;

let skills = [];
const current = () => skills.find((s) => s.status === "current");
const chasing = () => skills.filter((s) => s.status === "aspire");
const mastered = () => skills.filter((s) => s.status === "mastered");

function makeCanvas(w, h) { return Object.assign(document.createElement("canvas"), { width: w, height: h }); }
function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
  return text + "…";
}

// ── Textures ──────────────────────────────────────────────
function wallPanels() {
  const c = makeCanvas(512, 512), ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#f2f1ee"); g.addColorStop(1, "#dcdad4");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "#b9b6ae"; ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 508);
  ctx.beginPath(); ctx.moveTo(0, 340); ctx.lineTo(512, 340); ctx.stroke();
  ctx.fillStyle = "#a9a59c";
  [[18, 18], [494, 18], [18, 494], [494, 494], [18, 322], [494, 322], [18, 358], [494, 358]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); });
  return canvasTex(c, [24, 1]);
}

function floorPlate() {
  const S = 1024, c = makeCanvas(S, S), ctx = c.getContext("2d");
  ctx.fillStyle = "#5d5f63"; ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  for (let r = 60; r < S / 2; r += 70) {
    ctx.strokeStyle = r % 140 === 60 ? "#7c7f84" : "#4c4e52"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = "#4c4e52"; ctx.lineWidth = 5;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 130, Math.sin(a) * 130); ctx.lineTo(Math.cos(a) * S / 2, Math.sin(a) * S / 2); ctx.stroke();
  }
  ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 14;                  // red safety ring around the machine
  ctx.beginPath(); ctx.arc(0, 0, 175, 0, Math.PI * 2); ctx.stroke();
  return canvasTex(c);
}

function stars() {
  const c = makeCanvas(256, 256), ctx = c.getContext("2d");
  ctx.fillStyle = "#04060f"; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
    const s = Math.random() < 0.1 ? 2.5 : 1.2;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  return canvasTex(c);
}

// ── Room geometry ─────────────────────────────────────────
AFRAME.registerComponent("gravity-room", {
  init() {
    const g = new THREE.Group();
    const lam = (opts) => new THREE.MeshLambertMaterial(opts);

    const wall = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_R, ROOM_R, ROOM_H, 72, 1, true), lam({ map: wallPanels(), side: THREE.BackSide }));
    wall.position.y = ROOM_H / 2;
    g.add(wall);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(ROOM_R, 72), lam({ map: floorPlate() }));
    floor.rotation.x = -Math.PI / 2;
    g.add(floor);

    const ceil = new THREE.Mesh(new THREE.CircleGeometry(ROOM_R, 72), lam({ color: "#e6e4df", side: THREE.BackSide }));
    ceil.rotation.x = -Math.PI / 2;
    ceil.position.y = ROOM_H;
    g.add(ceil);
    const lightRing = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.12, 8, 96), new THREE.MeshBasicMaterial({ color: "#fff6e8" }));
    lightRing.rotation.x = Math.PI / 2;
    lightRing.position.y = ROOM_H - 0.05;
    g.add(lightRing);

    // floor trim + portholes looking out into space
    const trim = new THREE.Mesh(new THREE.TorusGeometry(ROOM_R - 0.05, 0.1, 6, 96), lam({ color: "#9a968d" }));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.4;
    g.add(trim);
    const starTex = stars(), frameMat = lam({ color: "#8f8b83" });
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * Math.PI * 2;
      const p = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.8, 40), new THREE.MeshBasicMaterial({ map: starTex }));
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.12, 10, 40), frameMat);
      p.add(glass, frame);
      p.position.set(Math.sin(a) * (ROOM_R - 0.06), 4.2, Math.cos(a) * (ROOM_R - 0.06));
      p.lookAt(0, 4.2, 0);
      g.add(p);
    }

    // the gravity machine: base, central column, glowing core ring
    const steel = lam({ color: "#c9c7c2" }), dark = lam({ color: "#3b3d41" });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.5, 48), dark);
    base.position.y = 0.25;
    const step = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.3, 48), steel);
    step.position.y = 0.65;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, ROOM_H, 32), steel);
    column.position.y = ROOM_H / 2;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 32), dark);
    collar.position.y = 3.3;
    g.add(base, step, column, collar);
    this.core = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.13, 16, 64), new THREE.MeshBasicMaterial({ color: "#ff2a2a", transparent: true, opacity: 0.9 }));
    this.core.rotation.x = Math.PI / 2;
    this.core.position.y = 3.3;
    g.add(this.core);
    this.glow = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.45, 16, 64), new THREE.MeshBasicMaterial({ color: "#ff3b30", transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.rotation.x = Math.PI / 2;
    this.glow.position.y = 3.3;
    g.add(this.glow);

    // exit door behind where you start
    const door = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 0.2), lam({ color: "#b8b4ab" }));
    slab.position.y = 1.7;
    const dc = makeCanvas(512, 160), dctx = dc.getContext("2d");
    dctx.fillStyle = "#1b1b1a"; dctx.fillRect(0, 0, 512, 160);
    dctx.fillStyle = "#4cd964"; dctx.font = `800 64px ${FONT}`; dctx.textAlign = "center"; dctx.textBaseline = "middle";
    dctx.fillText("◀ EXIT", 256, 84);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.44), new THREE.MeshBasicMaterial({ map: canvasTex(dc) }));
    sign.position.set(0, 3.0, 0.11);
    door.add(slab, sign);
    door.position.set(0, 0, ROOM_R - 0.15);
    door.rotation.y = Math.PI;
    this.door = door;

    this.el.setObject3D("mesh", g);
    const doorEl = document.createElement("a-entity");
    doorEl.classList.add("clickable");
    doorEl.addEventListener("loaded", () => doorEl.setObject3D("mesh", door), { once: true });
    doorEl.addEventListener("click", () => { if (!pointer.dragged) leaveRoom(); });
    this.el.sceneEl.appendChild(doorEl);
  },
  tick(t) {
    // the core pulses faster the higher the gravity
    const s = current(), g = s ? gravityOf(s.progress) : 10;
    const speed = 1.5 + g / 120;
    const pulse = 0.5 + 0.5 * Math.sin((t / 1000) * speed * Math.PI);
    this.core.material.opacity = 0.65 + 0.35 * pulse;
    this.glow.material.opacity = 0.1 + 0.18 * pulse;
    this.glow.scale.setScalar(1 + 0.06 * pulse);
    const red = document.getElementById("red-light");
    if (red) red.object3D.children[0] && (red.object3D.children[0].intensity = 0.6 + 0.9 * pulse * Math.min(1, g / 250));
  },
});

// ── Console screen on the machine ─────────────────────────
AFRAME.registerComponent("skill-console", {
  init() {
    this.canvas = makeCanvas(1024, 640);
    this.tex = canvasTex(this.canvas);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.18), new THREE.MeshLambertMaterial({ color: "#3b3d41" }));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.9), new THREE.MeshBasicMaterial({ map: this.tex }));
    screen.position.z = 0.1;
    const g = new THREE.Group();
    g.add(housing, screen);
    this.el.setObject3D("mesh", g);
  },
  render() {
    const ctx = this.canvas.getContext("2d"), W = 1024, H = 640;
    const s = current();
    ctx.fillStyle = "#07090c"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#1e2a22"; ctx.lineWidth = 2;
    for (let y = 0; y < H; y += 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }   // scanlines
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ff453a";
    ctx.font = `700 40px ${MONO}`;
    ctx.fillText("GRAVITY", 50, 80);
    ctx.font = `800 190px ${MONO}`;
    ctx.fillText(`${s ? gravityOf(s.progress) : 1}×`, 40, 270);
    ctx.fillStyle = "#4cd964";
    ctx.font = `700 34px ${MONO}`;
    ctx.fillText("NOW TRAINING", 50, 350);
    ctx.font = `800 58px ${FONT}`;
    ctx.fillStyle = "#e9ffe9";
    ctx.fillText(fitText(ctx, s ? s.name : "Pick a skill on the board", W - 100), 50, 425);
    if (s) {
      ctx.fillStyle = "#1e2a22"; ctx.fillRect(50, 465, W - 100, 34);
      ctx.fillStyle = "#4cd964"; ctx.fillRect(50, 465, (W - 100) * (s.progress / 100), 34);
      ctx.font = `700 32px ${MONO}`;
      ctx.fillText(`${s.progress}% · ${areaOf(s.area) ? areaOf(s.area).label.toUpperCase() : ""}`, 50, 550);
    }
    if (fromArea) {
      ctx.fillStyle = "#8e9a90";
      ctx.font = `600 28px ${MONO}`;
      ctx.fillText(`ENTERED FROM: ${fromArea.label.toUpperCase()} STREAK`, 50, 610);
    }
    this.tex.needsUpdate = true;
  },
});

// ── Skills board on the wall ──────────────────────────────
AFRAME.registerComponent("skill-board", {
  init() {
    this.canvas = makeCanvas(2048, 1280);
    this.tex = canvasTex(this.canvas);
    this.hits = [];
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4), new THREE.MeshBasicMaterial({ map: this.tex }));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(6.7, 4.3, 0.12), new THREE.MeshLambertMaterial({ color: "#3b3d41" }));
    frame.position.z = -0.08;
    const g = new THREE.Group();
    g.add(frame, this.face);
    this.el.setObject3D("mesh", g);
    this.el.addEventListener("click", (e) => {
      if (pointer.dragged) return;
      const hit = e.detail.intersection;
      if (!hit || hit.object !== this.face || !hit.uv) return;
      const x = hit.uv.x * 2048, y = (1 - hit.uv.y) * 1280;
      const h = this.hits.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      if (h) trainSkill(h.id);
    });
  },
  render() {
    const ctx = this.canvas.getContext("2d"), W = 2048, H = 1280, M = 80;
    this.hits = [];
    ctx.fillStyle = "#101317"; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#e9ecef";
    ctx.font = `800 96px ${FONT}`;
    ctx.fillText("Skills I'm chasing", M, 140);
    ctx.fillStyle = "#8e959c";
    ctx.font = `500 40px ${FONT}`;
    ctx.fillText("Tap a skill to start training it on the gravity machine", M, 200);

    const list = chasing();
    let y = 270;
    if (!list.length) {
      ctx.fillStyle = "#8e959c";
      ctx.font = `500 52px ${FONT}`;
      ctx.fillText("Nothing on the list yet. Add skills from the menu.", M, 360);
    }
    list.slice(0, 7).forEach((s) => {
      const a = areaOf(s.area), hl = fromArea && a && a.id === fromArea.id;
      ctx.fillStyle = hl ? "#1d2733" : "#171b21";
      ctx.beginPath(); ctx.roundRect(M, y, W - M * 2, 110, 22); ctx.fill();
      if (hl) { ctx.strokeStyle = fromArea.color; ctx.lineWidth = 5; ctx.stroke(); }
      ctx.fillStyle = a ? a.color : "#8e959c";
      ctx.beginPath(); ctx.arc(M + 56, y + 55, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f1f3f5";
      ctx.font = `700 54px ${FONT}`;
      ctx.fillText(fitText(ctx, s.name, W - M * 2 - 560), M + 100, y + 74);
      ctx.fillStyle = "#8e959c";
      ctx.font = `600 38px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(a ? a.label : "", W - M - 290, y + 70);
      ctx.fillStyle = "#ff453a";
      ctx.beginPath(); ctx.roundRect(W - M - 250, y + 20, 220, 70, 35); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `800 36px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText("TRAIN ▶", W - M - 140, y + 68);
      ctx.textAlign = "left";
      this.hits.push({ id: s.id, x: M, y, w: W - M * 2, h: 110 });
      y += 128;
    });
    if (list.length > 7) {
      ctx.fillStyle = "#8e959c"; ctx.font = `600 40px ${FONT}`;
      ctx.fillText(`+ ${list.length - 7} more in the menu`, M, y + 40);
    }

    const done = mastered();
    if (done.length) {
      ctx.fillStyle = "#4cd964";
      ctx.font = `700 40px ${FONT}`;
      ctx.fillText(`Mastered: ${done.map((s) => s.name).join(" · ")}`.slice(0, 90), M, H - 60);
    }
    this.tex.needsUpdate = true;
  },
});

// ── Movement & camera (mouse, keyboard, phone, VR) ────────
const pointer = { downAt: null, prev: null, dragged: false };
const state = { pos: new THREE.Vector3(0, 0, 6), yaw: 0, pitch: 0.12, fov: 75, keys: new Set(), stick: { x: 0, y: 0 }, vrYaw: 0, joy: { x: 0, y: 0, fly: 0 } };

AFRAME.registerComponent("room-controls", {
  init() {
    const scene = this.el.sceneEl;
    const start = () => {
      const canvas = scene.canvas;
      canvas.addEventListener("pointerdown", (e) => { pointer.downAt = pointer.prev = [e.clientX, e.clientY]; pointer.dragged = false; });
      window.addEventListener("pointermove", (e) => {
        if (!pointer.downAt) return;
        const mx = e.clientX - pointer.prev[0], my = e.clientY - pointer.prev[1];
        pointer.prev = [e.clientX, e.clientY];
        if (Math.hypot(e.clientX - pointer.downAt[0], e.clientY - pointer.downAt[1]) > 6) pointer.dragged = true;
        if (!pointer.dragged || TouchControls.pinching()) return;
        const k = 0.0045 * (state.fov / 75);
        state.yaw -= mx * k;
        state.pitch = Math.max(-1.4, Math.min(1.4, state.pitch - my * k));
      });
      window.addEventListener("pointerup", () => { pointer.downAt = null; });
      canvas.addEventListener("wheel", (e) => { e.preventDefault(); state.fov = Math.min(90, Math.max(20, state.fov * (1 + e.deltaY * 0.001))); }, { passive: false });
      let fov0 = state.fov;
      TouchControls.pinch(canvas, { onStart: () => { pointer.dragged = true; fov0 = state.fov; }, onChange: (r) => { state.fov = Math.min(90, Math.max(20, fov0 / r)); } });
      state.joy = TouchControls.joystick();
    };
    if (scene.hasLoaded) start(); else scene.addEventListener("loaded", start, { once: true });

    window.addEventListener("keydown", (e) => { if (!e.target.closest("input, textarea, select, button")) state.keys.add(e.code); });
    window.addEventListener("keyup", (e) => state.keys.delete(e.code));
    window.addEventListener("blur", () => state.keys.clear());
    const left = $("left-hand"), right = $("right-hand");
    left.addEventListener("thumbstickmoved", (e) => { state.stick = { x: e.detail.x, y: e.detail.y }; });
    let turned = false;
    right.addEventListener("thumbstickmoved", (e) => {
      const x = e.detail.x;
      if (!turned && Math.abs(x) > 0.7) { state.vrYaw -= Math.sign(x) * (Math.PI / 6); turned = true; }
      else if (Math.abs(x) < 0.3) turned = false;
    });
  },
  tick(t, dtMs) {
    if (!dtMs) return;
    const dt = Math.min(dtMs / 1000, 0.05), k = state.keys;
    const vr = this.el.sceneEl.is("vr-mode");
    let ix = 0, iz = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) iz += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) iz -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) ix += 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) ix -= 1;
    if (Math.hypot(state.stick.x, state.stick.y) > 0.15) { ix += state.stick.x; iz -= state.stick.y; }
    if (Math.hypot(state.joy.x, state.joy.y) > 0.1) { ix += state.joy.x; iz += state.joy.y; }

    const cam = $("cam"), rig = $("rig");
    let yaw = state.yaw;
    if (vr) {
      const d = cam.getObject3D("camera").getWorldDirection(new THREE.Vector3());
      yaw = Math.atan2(-d.x, -d.z);
    }
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const dir = fwd.multiplyScalar(iz).add(right.multiplyScalar(ix));
    if (dir.length() > 1) dir.normalize();
    state.pos.addScaledVector(dir, 4 * dt);
    // stay inside the room and off the machine
    const r = Math.hypot(state.pos.x, state.pos.z);
    if (r > ROOM_R - 0.8) state.pos.multiplyScalar((ROOM_R - 0.8) / r);
    if (r < 2.2 && r > 0.001) state.pos.multiplyScalar(2.2 / r);

    const o = rig.object3D, c = cam.object3D;
    if (vr) {
      c.position.set(0, 0, 0); c.rotation.set(0, 0, 0);
      o.position.copy(state.pos);
      o.rotation.set(0, state.vrYaw, 0);
    } else {
      o.rotation.set(0, 0, 0);
      o.position.set(state.pos.x, 1.6, state.pos.z);
      c.position.set(0, 0, 0);
      c.rotation.set(state.pitch, state.yaw, 0);
      const three = cam.getObject3D("camera");
      if (three && Math.abs(three.fov - state.fov) > 0.01) { three.fov = state.fov; three.updateProjectionMatrix(); }
    }
  },
});

// ── Data & menu ───────────────────────────────────────────
async function load() {
  try { skills = await Store.skills.list(); } catch (e) { console.error(e); skills = []; }
  renderAll();
}
function renderAll() {
  const con = $("console").components["skill-console"], board = $("board").components["skill-board"];
  if (con) con.render();
  if (board) board.render();
  renderMenu();
}
async function run(task) {
  try { await task(); } catch (e) { alert(e.message); }
  await load();
}
function trainSkill(id) {
  run(async () => {
    for (const s of skills.filter((x) => x.status === "current" && x.id !== id)) await Store.skills.update(s.id, { status: "aspire" });
    await Store.skills.update(id, { status: "current" });
  });
}
function leaveRoom() {
  const w = $("warp");
  w.hidden = false;
  w.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: "forwards" }).finished.then(() => { location.href = "../calendar/?view=first"; });
}

const areaOptions = (sel) => AREAS.map((a) => `<option value="${a.id}" ${a.id === sel ? "selected" : ""}>${esc(a.label)}</option>`).join("");
function renderMenu() {
  const s = current();
  $("current-skill").innerHTML = s ? `
    <input class="sk-name" id="cs-name" value="${esc(s.name)}" aria-label="Skill name">
    <label class="sk-row">Progress <input type="range" id="cs-progress" min="0" max="100" step="5" value="${s.progress}"><output id="cs-out">${s.progress}%</output></label>
    <p class="sk-gravity">Gravity <strong id="cs-grav">${gravityOf(s.progress)}×</strong></p>
    <input class="sk-note" id="cs-note" value="${esc(s.note)}" placeholder="Next step / note">
    <div class="sk-actions">
      <select id="cs-area" aria-label="Area">${areaOptions(s.area)}</select>
      <button type="button" class="plain" id="cs-mastered">✓ Mastered</button>
      <button type="button" class="plain" id="cs-shelve">Back to list</button>
    </div>` : `<p class="tip" style="margin:0">Not training anything. Pick a skill below (or on the board) to start.</p>`;

  $("chasing").innerHTML = chasing().map((x) => {
    const a = areaOf(x.area);
    return `<li><i style="background:${a ? a.color : "#8e959c"}"></i><span>${esc(x.name)}</span>
      <button type="button" class="mini" data-train="${esc(x.id)}" title="Train this">▶</button>
      <button type="button" class="mini" data-del="${esc(x.id)}" title="Remove">✕</button></li>`;
  }).join("") || `<li class="tip">Your list is empty.</li>`;
  $("mastered").textContent = mastered().map((x) => x.name).join(" · ") || "None yet";
  $("add-area").innerHTML = areaOptions(fromArea ? fromArea.id : AREAS[0].id);

  if (s) {
    let timer;
    const save = (patch) => { clearTimeout(timer); timer = setTimeout(() => Store.skills.update(s.id, patch).then(() => { Object.assign(s, patch); $("console").components["skill-console"].render(); }), 400); };
    $("cs-name").addEventListener("input", (e) => save({ name: e.target.value.trim() || s.name }));
    $("cs-note").addEventListener("input", (e) => save({ note: e.target.value }));
    $("cs-area").addEventListener("change", (e) => save({ area: e.target.value }));
    $("cs-progress").addEventListener("input", (e) => {
      const v = Number(e.target.value);
      $("cs-out").textContent = `${v}%`;
      $("cs-grav").textContent = `${gravityOf(v)}×`;
      save({ progress: v });
    });
    $("cs-mastered").addEventListener("click", () => run(() => Store.skills.update(s.id, { status: "mastered", progress: 100 })));
    $("cs-shelve").addEventListener("click", () => run(() => Store.skills.update(s.id, { status: "aspire" })));
  }
}

$("chasing").addEventListener("click", (e) => {
  const t = e.target.closest("[data-train]"), d = e.target.closest("[data-del]");
  if (t) trainSkill(t.dataset.train);
  if (d && confirm("Remove this skill from your list?")) run(() => Store.skills.remove(d.dataset.del));
});
$("add-skill").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("add-name").value.trim();
  if (!name) return;
  $("add-name").value = "";
  run(() => Store.skills.create({ name, area: $("add-area").value, status: "aspire", progress: 0, note: "", position: skills.length }));
});
if (innerWidth < 700) document.querySelector(".hud").removeAttribute("open");

Store.init().then((s) => {
  Account.mount($("account"));
  $("mode-note").textContent = s.signedIn ? "Saved to your account, private to you." : "Sandbox: changes stay in this browser. Sign in to save to your account.";
  Store.onChange(load);
  const scene = document.querySelector("a-scene");
  if (scene.hasLoaded) load(); else scene.addEventListener("loaded", load, { once: true });
});

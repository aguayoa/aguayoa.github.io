// Movement, camera views, calendar size/position, day summaries, and the on-screen menu.

const VIEWS = ["first", "third", "overview"];
const WALL_DEFAULT = { scale: 1, dist: 22.4, x: 0, y: 0 };
const WALL_LIMITS = { scale: [0.4, 2.5], dist: [8, 70], x: [-40, 40], y: [-4, 20] };
const START = { x: 0, z: -10 };

// ── Saved settings (per browser) ──────────────────────────
const store = {
  load() {
    try { return JSON.parse(localStorage.getItem("time-chamber") || "{}"); } catch { return {}; }
  },
  save(data) {
    try { localStorage.setItem("time-chamber", JSON.stringify(data)); } catch {}
  },
};
const saved = store.load();
const urlView = new URLSearchParams(location.search).get("view");
if (urlView) saved.view = urlView;
if (new URLSearchParams(location.search).has("power")) saved.powered = true;

const state = {
  view: VIEWS.includes(saved.view) ? saved.view : "first",
  wall: { ...WALL_DEFAULT, ...(saved.wall || {}) },
  powered: !!saved.powered,
  fy: DEFAULT_FY,
  player: new THREE.Vector3(START.x, groundAt(START.x, START.z), START.z),
  facing: 0,
  look: { yaw: 0, pitch: 0.4 },                 // desktop camera
  zoom: { third: 5, overview: 48 },
  vrYaw: 0,
  keys: new Set(),
  stick: { x: 0, y: 0 },                        // VR left stick: walk
  fly: 0,                                       // VR right stick up/down
  grab: null,
};
state.layout = saved.layout === "list" ? "list" : "year";
const persist = () => store.save({ view: state.view, wall: state.wall, powered: state.powered, layout: state.layout });

// Day summaries, saved in this browser: { "YYYY-MM-DD": "text" }
const NOTES_KEY = "time-chamber-days";
window.dayNotes = (() => {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); } catch { return {}; }
})();
function saveNotes() {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(window.dayNotes)); return true; } catch { return false; }
}
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

// Real head pose: the THREE camera is driven by WebXR in VR and by this script on desktop
function headPose() {
  const cam = document.getElementById("cam").getObject3D("camera");
  const pos = new THREE.Vector3(), fwd = new THREE.Vector3();
  cam.getWorldPosition(pos);
  cam.getWorldDirection(fwd);
  fwd.setY(0).normalize();
  return { pos, fwd };
}

const els = {};

AFRAME.registerComponent("time-chamber", {
  init() {
    const scene = this.el.sceneEl;
    if (scene.hasLoaded) this.setup(scene);
    else scene.addEventListener("loaded", () => this.setup(scene), { once: true });
  },

  setup(scene) {
    this.ready = true;
    els.scene = scene;
    els.rig = document.getElementById("rig");
    els.cam = document.getElementById("cam");
    els.player = document.getElementById("player");
    els.wall = document.getElementById("wall");
    els.left = document.getElementById("left-hand");
    els.right = document.getElementById("right-hand");

    // Calendar contents
    const q = Number(new URLSearchParams(location.search).get("fy"));
    state.fy = FY_CHOICES.includes(q) ? q : DEFAULT_FY;
    const wall = els.wall.components["calendar-wall"];
    els.wallC = wall;
    wall.layout = state.layout;
    setFY(state.fy);
    applyWall();

    // Calendar controls on the wall itself
    els.wall.addEventListener("wall-scale", (e) => {
      state.wall.scale = clamp(e.detail.scale, WALL_LIMITS.scale);
      applyWall();
    });
    els.wall.addEventListener("wall-resize", (e) => resizeWall(e.detail.factor));
    els.wall.addEventListener("wall-resize-end", persist);
    els.wall.addEventListener("wall-reset", () => { state.wall = { ...WALL_DEFAULT }; applyWall(); persist(); });
    els.wall.addEventListener("layout-changed", (e) => { state.layout = e.detail.layout; persist(); });
    els.wall.addEventListener("day-selected", (e) => openDay(e.detail.key));
    setView(state.view);
    setPowered(state.powered);

    // Desktop: drag to look, wheel to zoom, keys to move
    const canvas = scene.canvas;
    canvas.addEventListener("pointerdown", (e) => {
      pointer.downAt = [e.clientX, e.clientY];
      pointer.dragged = false;
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    });
    window.addEventListener("pointermove", (e) => {
      if (!pointer.downAt) return;
      const dx = e.clientX - pointer.downAt[0], dy = e.clientY - pointer.downAt[1];
      if (Math.hypot(dx, dy) > 6) pointer.dragged = true;
      if (pointer.dragged && !els.wallC.resizing) {
        state.look.yaw -= e.movementX * 0.0045;
        state.look.pitch = Math.max(-1.45, Math.min(1.45, state.look.pitch - e.movementY * 0.0045));
      }
    });
    window.addEventListener("pointerup", () => { pointer.downAt = null; });
    canvas.addEventListener("wheel", (e) => {
      if (state.view === "first") return;
      e.preventDefault();
      const lim = state.view === "third" ? [2.5, 25] : [15, 130];
      state.zoom[state.view] = clamp(state.zoom[state.view] * (1 + e.deltaY * 0.001), lim);
    }, { passive: false });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape") { if (!closeDay()) els.wallC.clearFront(); return; }
      if (e.target.closest && e.target.closest("input, button, select, textarea")) return;
      state.keys.add(e.code);
      if (e.code === "Digit1") setView("first");
      if (e.code === "Digit2") setView("third");
      if (e.code === "Digit3") setView("overview");
      if (e.code === "KeyV") cycleView();
      if (e.code === "KeyF") setPowered(!state.powered);
      if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => state.keys.delete(e.code));
    window.addEventListener("blur", () => state.keys.clear());

    // VR controllers
    els.left.addEventListener("thumbstickmoved", (e) => { state.stick = { x: e.detail.x, y: e.detail.y }; });
    let turned = false;
    els.right.addEventListener("thumbstickmoved", (e) => {
      const { x, y } = e.detail;
      if (!turned && Math.abs(x) > 0.7) { state.vrYaw -= Math.sign(x) * (Math.PI / 6); turned = true; }
      else if (Math.abs(x) < 0.3) turned = false;
      state.fly = Math.abs(y) > 0.25 ? -y : 0;
    });
    els.left.addEventListener("xbuttondown", cycleView);
    els.left.addEventListener("ybuttondown", () => setPowered(!state.powered));
    els.right.addEventListener("abuttondown", () => resizeWall(1.12));
    els.right.addEventListener("bbuttondown", () => resizeWall(1 / 1.12));
    [els.left, els.right].forEach((hand) => {
      hand.addEventListener("gripdown", () => {
        state.grab = { hand, start: hand.object3D.getWorldPosition(new THREE.Vector3()), wall: { ...state.wall } };
      });
      hand.addEventListener("gripup", () => {
        if (state.grab && state.grab.hand === hand) { state.grab = null; persist(); }
      });
    });
  },

  tick(t, dtMs) {
    if (!dtMs || !this.ready) return;
    const dt = Math.min(dtMs / 1000, 0.05);
    const vr = this.el.is("vr-mode");
    const k = state.keys;

    // Input → movement relative to where you're looking
    let ix = 0, iz = 0, iy = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) iz += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) iz -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) ix += 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) ix -= 1;
    if (k.has("KeyE") || k.has("Space")) iy += 1;
    if (k.has("KeyQ") || k.has("KeyC")) iy -= 1;
    if (Math.hypot(state.stick.x, state.stick.y) > 0.15) { ix += state.stick.x; iz -= state.stick.y; }
    iy += state.fly;

    let yaw = state.look.yaw;
    if (vr) { const { fwd } = headPose(); yaw = Math.atan2(-fwd.x, -fwd.z); }
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const dir = fwd.multiplyScalar(iz).add(right.multiplyScalar(ix));
    if (dir.length() > 1) dir.normalize();

    const sprint = k.has("ShiftLeft") || k.has("ShiftRight");
    const speed = (sprint ? 14 : 6) * dir.length();
    const p = state.player;
    p.addScaledVector(dir, (sprint ? 14 : 6) * dt);
    p.y += iy * 7 * dt;
    const ground = groundAt(p.x, p.z);
    p.y = Math.min(80, Math.max(ground, p.y));
    if (dir.length() > 0.1) {
      const target = Math.atan2(-dir.x, -dir.z);
      let d = target - state.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      state.facing += d * (1 - Math.exp(-dt * 12));
    }

    // Fighter
    const avatar = els.player.components["fighter-avatar"];
    els.player.object3D.position.copy(p);
    els.player.object3D.rotation.y = state.facing;
    els.player.object3D.visible = state.view !== "first";
    if (avatar) avatar.animate(dt, speed, p.y > ground + 0.05, ground, t);

    // VR grab-and-drag the calendar (movement is amplified so the giant wall is easy to place)
    if (state.grab) {
      const now = state.grab.hand.object3D.getWorldPosition(new THREE.Vector3());
      const d = now.sub(state.grab.start).multiplyScalar(3);
      state.wall.x = clamp(state.grab.wall.x + d.x, WALL_LIMITS.x);
      state.wall.y = clamp(state.grab.wall.y + d.y, WALL_LIMITS.y);
      state.wall.dist = clamp(state.grab.wall.dist - d.z, WALL_LIMITS.dist);
      applyWall();
    }

    // Camera
    const rig = els.rig.object3D, cam = els.cam.object3D;
    if (vr) {
      cam.position.set(0, 0, 0);
      cam.rotation.set(0, 0, 0);
      rig.rotation.set(0, state.vrYaw, 0);
      const offset = { first: [0, 0, 0], third: [0, 1.0, 4.2], overview: [0, 24, 30] }[state.view];
      const o = new THREE.Vector3(...offset).applyAxisAngle(new THREE.Vector3(0, 1, 0), state.vrYaw);
      rig.position.copy(p).add(o);
    } else {
      rig.rotation.set(0, 0, 0);
      const { yaw: ly, pitch } = state.look;
      const eye = new THREE.Vector3();
      if (state.view === "first") {
        eye.copy(p).add(new THREE.Vector3(0, 1.6, 0));
      } else {
        const target = p.clone().add(new THREE.Vector3(0, 1.4, 0));
        const look = new THREE.Vector3(-Math.sin(ly) * Math.cos(pitch), Math.sin(pitch), -Math.cos(ly) * Math.cos(pitch));
        eye.copy(target).addScaledVector(look, -state.zoom[state.view]);
        eye.y = Math.max(0.4, eye.y);
      }
      rig.position.copy(eye);
      cam.position.set(0, 0, 0);
      cam.rotation.set(pitch, ly, 0);
    }
  },
});

// ── Actions ───────────────────────────────────────────────
function setView(view) {
  state.view = view;
  if (els.wallC) els.wallC.clearFront();
  if (view === "first") state.look.pitch = Math.min(state.look.pitch, 0.4);
  if (view === "third") state.look.pitch = -0.22;
  if (view === "overview") state.look.pitch = -0.75;
  document.querySelectorAll("#views button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
  persist();
}
function cycleView() { setView(VIEWS[(VIEWS.indexOf(state.view) + 1) % VIEWS.length]); }

function setPowered(on) {
  state.powered = on;
  const avatar = els.player && els.player.components["fighter-avatar"];
  if (avatar) avatar.setPowered(on);
  const b = document.getElementById("power");
  b.setAttribute("aria-pressed", String(on));
  b.textContent = on ? "⚡ Powered up" : "⚡ Power up";
  persist();
}

function setFY(fy) {
  state.fy = fy;
  els.wallC.setFY(fy);
  document.querySelectorAll("#fy-buttons button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.fy) === fy)));
  const params = new URLSearchParams(location.search);
  params.set("fy", fy);
  history.replaceState(null, "", `?${params}`);
}

function applyWall() {
  const w = state.wall;
  els.wall.object3D.position.set(w.x, w.y, -w.dist);
  els.wall.object3D.scale.setScalar(w.scale);
}

function resizeWall(factor) {
  state.wall.scale = clamp(state.wall.scale * factor, WALL_LIMITS.scale);
  applyWall();
  persist();
}

// ── Menu wiring ───────────────────────────────────────────
document.getElementById("views").addEventListener("click", (e) => {
  if (e.target.dataset.view) setView(e.target.dataset.view);
});
document.getElementById("fy-buttons").innerHTML = FY_CHOICES
  .map((fy) => `<button type="button" data-fy="${fy}" aria-pressed="false">FY${fy}</button>`).join("");
document.getElementById("fy-buttons").addEventListener("click", (e) => {
  const fy = Number(e.target.dataset.fy);
  if (fy && els.wall) setFY(fy);
});
document.getElementById("power").addEventListener("click", () => setPowered(!state.powered));
document.getElementById("respawn").addEventListener("click", () => {
  state.player.set(START.x, groundAt(START.x, START.z), START.z);
  state.facing = 0;
  state.look.yaw = 0;
  setView(state.view);
});

// ── Day summaries ─────────────────────────────────────────
const dayEl = {
  panel: document.getElementById("day"),
  title: document.getElementById("day-title"),
  events: document.getElementById("day-events"),
  text: document.getElementById("day-text"),
  status: document.getElementById("day-status"),
};
let openKey = null, saveTimer = null;

function openDay(key) {
  const events = eventsByDate()[key] || [];
  if (els.scene.is("vr-mode")) return showDayCard(key, events);
  openKey = key;
  dayEl.title.textContent = formatDay(key);
  dayEl.events.innerHTML = events.map((e) =>
    `<li><span style="background:${e.color || "#2b59c3"}"></span>${e.title.replace(/</g, "&lt;")}</li>`).join("");
  dayEl.events.hidden = !events.length;
  dayEl.text.value = window.dayNotes[key] || "";
  dayEl.status.textContent = window.dayNotes[key] ? "Saved in this browser" : "";
  dayEl.panel.hidden = false;
  dayEl.text.focus();
}

function storeDay() {
  if (!openKey) return;
  const text = dayEl.text.value.trim();
  if (text) window.dayNotes[openKey] = text;
  else delete window.dayNotes[openKey];
  dayEl.status.textContent = saveNotes() ? (text ? "Saved in this browser" : "Summary cleared") : "Couldn't save (browser storage is blocked)";
  els.wallC.render();
}

function closeDay() {
  if (dayEl.panel.hidden) return false;
  clearTimeout(saveTimer);
  storeDay();
  dayEl.panel.hidden = true;
  openKey = null;
  els.wallC.selectedDay = null;
  els.wallC.render();
  return true;
}

dayEl.text.addEventListener("input", () => {
  dayEl.status.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(storeDay, 500);
});
document.getElementById("day-close").addEventListener("click", closeDay);
document.getElementById("day-delete").addEventListener("click", () => {
  dayEl.text.value = "";
  storeDay();
});

// In VR there's no keyboard, so show the summary on a card floating in front of you
let dayCard = null;
function showDayCard(key, events) {
  if (!dayCard) {
    const canvas = makeCanvas(1024, 768), tex = canvasTexture(canvas);
    const el = document.createElement("a-entity");
    el.classList.add("clickable");
    el.addEventListener("loaded", () => el.setObject3D("mesh", new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), basic({ map: tex }))), { once: true });
    el.addEventListener("click", () => { el.object3D.visible = false; el.object3D.scale.setScalar(HIDDEN); });
    els.scene.appendChild(el);
    dayCard = { el, canvas, tex };
  }
  drawDayCard(dayCard.canvas, key, events, window.dayNotes[key]);
  dayCard.tex.needsUpdate = true;
  const { pos, fwd } = headPose();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const at = pos.clone().addScaledVector(fwd, 2.6).addScaledVector(right, 1.1).add(new THREE.Vector3(0, -0.3, 0));
  const o = dayCard.el.object3D;
  o.position.copy(at);
  o.lookAt(pos.x, at.y, pos.z);
  o.scale.setScalar(1);
  o.visible = true;
}

// Move summaries between browsers / devices
document.getElementById("notes-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(window.dayNotes, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "day-summaries.json" });
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById("notes-import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    Object.entries(data).forEach(([k, v]) => { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === "string") window.dayNotes[k] = v; });
    saveNotes();
    els.wallC.render();
    document.getElementById("notes-status").textContent = `Imported ${Object.keys(data).length} days`;
  } catch {
    document.getElementById("notes-status").textContent = "That file isn't a summaries export";
  }
  e.target.value = "";
});

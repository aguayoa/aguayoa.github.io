// Movement, camera views, calendar size/position, and the on-screen menu.

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
const persist = () => store.save({ view: state.view, wall: state.wall, powered: state.powered });
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
    setFY(state.fy);
    applyWall();
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
      if (pointer.dragged) {
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
      if (e.target.closest && e.target.closest("input, button, select")) return;
      state.keys.add(e.code);
      if (e.code === "Digit1") setView("first");
      if (e.code === "Digit2") setView("third");
      if (e.code === "Digit3") setView("overview");
      if (e.code === "KeyV") cycleView();
      if (e.code === "KeyF") setPowered(!state.powered);
      if (e.code === "Escape" && focused) focused.release();
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
  if (focused) focused.release();
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
  els.wall.components["calendar-wall"].render(fy);
  document.querySelectorAll("#fy-buttons button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.fy) === fy)));
  const params = new URLSearchParams(location.search);
  params.set("fy", fy);
  history.replaceState(null, "", `?${params}`);
}

function applyWall() {
  const w = state.wall;
  els.wall.object3D.position.set(w.x, w.y, -w.dist);
  els.wall.object3D.scale.setScalar(w.scale);
  ["scale", "dist", "x", "y"].forEach((key) => {
    const input = document.getElementById(`w-${key}`);
    if (input && document.activeElement !== input) input.value = w[key];
    const out = document.getElementById(`w-${key}-out`);
    if (out) out.textContent = key === "scale" ? `${Math.round(w[key] * 100)}%` : `${w[key].toFixed(1)} m`;
  });
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
["scale", "dist", "x", "y"].forEach((key) => {
  const input = document.getElementById(`w-${key}`);
  [input.min, input.max] = WALL_LIMITS[key];
  input.addEventListener("input", () => {
    state.wall[key] = Number(input.value);
    applyWall();
  });
  input.addEventListener("change", persist);
});
document.getElementById("w-reset").addEventListener("click", () => {
  state.wall = { ...WALL_DEFAULT };
  applyWall();
  persist();
});
document.getElementById("respawn").addEventListener("click", () => {
  state.player.set(START.x, groundAt(START.x, START.z), START.z);
  state.facing = 0;
  state.look.yaw = 0;
  setView(state.view);
});

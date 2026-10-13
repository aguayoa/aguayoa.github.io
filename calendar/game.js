// Movement, camera views, calendar size/position, your data (reminders, to-dos, day summaries), and the menus.

const VIEWS = ["home", "first", "third", "overview"];
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
state.layout = ["year", "list", "reminders", "todo"].includes(saved.layout) ? saved.layout : "year";
const persist = () => store.save({ view: state.view, wall: state.wall, powered: state.powered, layout: state.layout });

// Your data, loaded from the Store (Supabase when signed in, a browser sandbox otherwise)
window.roomData = { reminders: [], todos: [], notes: {} };
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
    els.wall.addEventListener("reminder-bubble", (e) => showReminderBubble(e.detail.key, e.detail.point));
    els.wall.addEventListener("board-action", (e) => boardAction(e.detail.action, e.detail.id));
    els.bag = document.getElementById("toolbag").components["tool-bag"];
    ensureBubble();   // create it now so it's loaded before the first click
    els.bag.el.addEventListener("project-open", (e) => openProjectSheet(e.detail.project));
    els.bag.el.addEventListener("project-new", () => run(async () => {
      const created = await Store.projects.create({
        name: "New project", icon: "📁", status: "planning", category: "", tagline: "",
        link: "", overview: "", focus: [], tasks: [], position: 999,
      });
      await loadData();
      openProjectSheet(created, true);
    }));
    setView(state.view);
    setPowered(state.powered);

    // Account + data
    Store.init().then((s) => {
      Account.mount(document.getElementById("account"));
      showMode(s);
      loadData().then(checkNewReminders);
      Store.onChange((st) => { showMode(st); loadData(); });
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) loadData(); });

    // Desktop: drag to look, wheel to zoom, keys to move
    const canvas = scene.canvas;
    canvas.addEventListener("pointerdown", (e) => {
      pointer.downAt = [e.clientX, e.clientY];
      pointer.last = [e.clientX, e.clientY];
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
      if (e.code === "Escape") {
        if (!sheet.el.hidden) return;                 // the sheet handles its own Escape
        if (!hideBubble() && !els.bag.hideDetail()) els.wallC.clearFront();
        return;
      }
      if (e.target.closest && e.target.closest("input, button, select, textarea")) return;
      state.keys.add(e.code);
      if (e.code === "KeyH") setView("home");
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
    els.player.object3D.visible = state.view !== "first" && state.view !== "home";
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
      const offset = { home: [0, 0, 0], first: [0, 0, 0], third: [0, 1.0, 4.2], overview: [0, 24, 30] }[state.view];
      const o = new THREE.Vector3(...offset).applyAxisAngle(new THREE.Vector3(0, 1, 0), state.vrYaw);
      rig.position.copy(p).add(o);
    } else {
      rig.rotation.set(0, 0, 0);
      const { yaw: ly, pitch } = state.look;
      const eye = new THREE.Vector3();
      if (state.view === "first" || state.view === "home") {
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

    animateBubble(t / 1000);
  },
});

// ── Actions ───────────────────────────────────────────────
function setView(view) {
  const was = state.view;
  state.view = view;
  if (els.wallC) els.wallC.clearFront();
  if (els.bag) {
    if (view === "home") goHome();
    else if (was === "home") els.bag.setHome(false);
  }
  if (view === "first") state.look.pitch = Math.min(state.look.pitch, 0.4);
  if (view === "third") state.look.pitch = -0.22;
  if (view === "overview") state.look.pitch = -0.75;
  document.querySelectorAll("#views button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
  persist();
}
function cycleView() { setView(VIEWS[(VIEWS.indexOf(state.view) + 1) % VIEWS.length]); }

// Home view: stand in front of the tool bag; it opens and your projects fly up toward you
function goHome() {
  const bagObj = els.bag.el.object3D;
  const B = bagObj.position, yaw = bagObj.rotation.y;
  const front = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const P = B.clone().addScaledVector(front, 5.4);
  state.player.set(P.x, groundAt(P.x, P.z), P.z);
  const d = B.clone().sub(P);
  state.look.yaw = state.vrYaw = state.facing = Math.atan2(-d.x, -d.z);
  state.look.pitch = 0.14;
  // wait a moment so the camera is in place before the cards fly to your view
  setTimeout(() => els.bag.setHome(true), 150);
}

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

// ── Data ──────────────────────────────────────────────────
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function loadData() {
  try {
    const [projects, reminders, todos, notes] = await Promise.all([
      Store.projects.list(), Store.reminders.list(), Store.todos.list(), Store.notes.all(),
    ]);
    Object.assign(window.roomData, { reminders, todos, notes });
    els.bag.setProjects(projects);
  } catch (e) {
    console.error(e);
    showBubble("Couldn't load your data", [{ title: e.message, note: true }]);
  }
  els.wallC.render();
}

async function run(task) {
  try { await task(); } catch (e) { showBubble("Something went wrong", [{ title: e.message, note: true }]); }
}
const reloadReminders = async () => { roomData.reminders = await Store.reminders.list(); els.wallC.render(); };
const reloadTodos = async () => { roomData.todos = await Store.todos.list(); els.wallC.render(); };

function showMode(s) {
  document.getElementById("mode-note").textContent = s.signedIn
    ? "Saved to your account, private to you."
    : "Sandbox: changes stay in this browser. Sign in to save to your account.";
}

// Clicks on the Reminders / To-do boards
function boardAction(action, id) {
  const vr = els.scene.is("vr-mode");
  const needsKeyboard = () => showBubble("Add from your phone or computer", [{ title: "There's no keyboard in VR. Add it from the menu outside VR and it shows up here.", note: true }]);
  if (action === "reminder-toggle") run(async () => { const r = roomData.reminders.find((x) => x.id === id); await Store.reminders.update(id, { done: !r.done }); await reloadReminders(); });
  if (action === "reminder-delete") run(async () => { await Store.reminders.remove(id); await reloadReminders(); });
  if (action === "todo-toggle") run(async () => { const t = roomData.todos.find((x) => x.id === id); await Store.todos.update(id, { done: !t.done }); await reloadTodos(); });
  if (action === "todo-delete") run(async () => { await Store.todos.remove(id); await reloadTodos(); });
  if (action === "reminder-new") vr ? needsKeyboard() : openReminderSheet(todayKey());
  if (action === "todo-new") vr ? needsKeyboard() : openTodoSheet();
}

// ── Pop-out sheet ─────────────────────────────────────────
// One full-size window used for the day summary, new reminders and new to-dos.
// It grows out of the spot you clicked.
const sheet = { el: document.getElementById("sheet"), card: document.getElementById("sheet-card"), body: document.getElementById("sheet-body"), onClose: null };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function openSheet(html, onClose) {
  sheet.body.innerHTML = html;
  sheet.onClose = onClose;
  sheet.el.hidden = false;
  state.keys.clear();
  if (reduceMotion) return;
  const r = sheet.card.getBoundingClientRect();
  const [px, py] = pointer.last || [innerWidth / 2, innerHeight / 2];
  sheet.card.animate([
    { transform: `translate(${px - (r.left + r.width / 2)}px, ${py - (r.top + r.height / 2)}px) scale(0.06)`, opacity: 0, borderRadius: "60px" },
    { opacity: 1, offset: 0.35 },
    { transform: "none", opacity: 1, borderRadius: "26px" },
  ], { duration: 460, easing: "cubic-bezier(.2,.9,.25,1.08)" });
  document.getElementById("sheet-backdrop").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
}

async function closeSheet(save = true) {
  if (sheet.el.hidden) return false;
  const fn = sheet.onClose;
  sheet.onClose = null;
  if (fn) await fn(save);
  if (!reduceMotion) {
    await Promise.all([
      sheet.card.animate([{ transform: "none", opacity: 1 }, { transform: "scale(.92)", opacity: 0 }], { duration: 180, easing: "ease-in" }).finished,
      document.getElementById("sheet-backdrop").animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 }).finished,
    ]);
  }
  sheet.el.hidden = true;
  return true;
}
document.getElementById("sheet-backdrop").addEventListener("click", () => closeSheet(true));
sheet.el.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); closeSheet(true); } });
sheet.el.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(true); });

const swatches = (selected) => REMINDER_COLORS.map((c) =>
  `<label class="swatch" style="--c:${c}"><input type="radio" name="color" value="${c}" ${c === selected ? "checked" : ""}><span></span></label>`).join("");

function bubblesHTML(list) {
  if (!list.length) return `<p class="imsg-empty">No reminders for this day.</p>`;
  return list.map((r) => `
    <div class="imsg-row ${r.done ? "done" : ""}">
      <button type="button" class="imsg-bubble" style="--c:${esc(r.color)}" data-toggle-rem="${esc(r.id)}" title="Mark ${r.done ? "not done" : "done"}">${esc(r.title)}</button>
      <div class="imsg-meta">${esc(timeLabel(r.due_time))}${r.done ? " · Done" : ""} · <button type="button" class="link" data-del-rem="${esc(r.id)}">Delete</button></div>
    </div>`).join("");
}

// Entering the room: ring the Reminders button for 15 s if anything is due or new since last time
function checkNewReminders() {
  const KEY = "aware-room-last-visit";
  let last = 0;
  try { last = Number(localStorage.getItem(KEY) || 0); } catch {}
  const today = todayKey();
  const fresh = roomData.reminders.filter((r) =>
    !r.done && (r.due_date <= today || (r.created_at && Date.parse(r.created_at) > last)));
  if (fresh.length) els.wallC.startRinging(fresh.length);
  try { localStorage.setItem(KEY, String(Date.now())); } catch {}
}

// ── Project editor (pop-out) ──────────────────────────────
function openProjectSheet(project, isNew) {
  let editor;
  openSheet(`
    <header class="sh-head">
      <div><p class="sh-kicker">Project</p></div>
      <button type="button" class="sh-x" data-close aria-label="Close">✕</button>
    </header>
    <div id="proj-editor"></div>`, async () => {
    if (editor) await editor.flush();
    await loadData();
  });
  editor = ProjectEditor.mount(document.getElementById("proj-editor"), project, {
    onDelete: async () => { editor = null; await closeSheet(false); },
  });
  document.querySelectorAll("#proj-editor .reveal").forEach((el) => { el.style.opacity = 1; });
  if (isNew) editor.focusName();
}

// ── Day summary ───────────────────────────────────────────
function openDay(key) {
  const events = eventsByDate()[key] || [];
  const dayReminders = () => roomData.reminders.filter((r) => r.due_date === key);
  if (els.scene.is("vr-mode")) {
    const items = [...events.map((e) => ({ title: e.title, note: true })), ...dayReminders()];
    if (roomData.notes[key]) items.unshift({ title: roomData.notes[key], note: true });
    return showBubble(formatDay(key), items.length ? items : [{ title: "No summary yet. Write one outside VR.", note: true }]);
  }

  openSheet(`
    <header class="sh-head">
      <div><p class="sh-kicker">Day summary</p><h2>${esc(formatDay(key))}</h2></div>
      <button type="button" class="sh-x" data-close aria-label="Close">✕</button>
    </header>
    <div class="sh-grid">
      <section class="sh-main">
        ${events.length ? `<ul class="sh-events">${events.map((e) => `<li><span style="background:${esc(e.color || "#2b59c3")}"></span>${esc(e.title)}</li>`).join("")}</ul>` : ""}
        <textarea id="day-text" placeholder="How did today go? Wins, notes, what's next…">${esc(roomData.notes[key] || "")}</textarea>
        <p class="sh-hint"><kbd>Enter</kbd> saves · <kbd>Shift</kbd> + <kbd>Enter</kbd> new line · <kbd>Esc</kbd> closes</p>
      </section>
      <aside class="sh-side">
        <h3>Reminders</h3>
        <div class="imsg" id="day-rems">${bubblesHTML(dayReminders())}</div>
        <form class="rem-form" id="day-rem-form" autocomplete="off">
          <input id="rem-title" placeholder="New reminder for this day…" required>
          <div class="rem-row">
            <input type="time" id="rem-time" aria-label="Time (optional)">
            <div class="swatches">${swatches(REMINDER_COLORS[0])}</div>
          </div>
          <button type="submit" class="send">Add</button>
        </form>
      </aside>
    </div>`, async (save) => {
    if (save) {
      const text = document.getElementById("day-text").value;
      await run(async () => {
        await Store.notes.set(key, text);
        if (text.trim()) roomData.notes[key] = text.trim(); else delete roomData.notes[key];
      });
    }
    els.wallC.selectedDay = null;
    els.wallC.render();
  });

  const text = document.getElementById("day-text");
  text.focus();
  text.setSelectionRange(text.value.length, text.value.length);
  text.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); closeSheet(true); }
  });

  const refreshBubbles = () => { document.getElementById("day-rems").innerHTML = bubblesHTML(dayReminders()); };
  document.getElementById("day-rem-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("rem-title").value.trim();
    if (!title) return;
    run(async () => {
      await Store.reminders.create({
        title, due_date: key,
        due_time: document.getElementById("rem-time").value || null,
        color: (sheet.body.querySelector("input[name=color]:checked") || {}).value || REMINDER_COLORS[0],
        done: false,
      });
      document.getElementById("rem-title").value = "";
      await reloadReminders();
      refreshBubbles();
    });
  });
  document.getElementById("day-rems").addEventListener("click", (e) => {
    const t = e.target.closest("[data-toggle-rem]"), d = e.target.closest("[data-del-rem]");
    if (t) run(async () => { const r = roomData.reminders.find((x) => x.id === t.dataset.toggleRem); await Store.reminders.update(r.id, { done: !r.done }); await reloadReminders(); refreshBubbles(); });
    if (d) run(async () => { await Store.reminders.remove(d.dataset.delRem); await reloadReminders(); refreshBubbles(); });
  });
}

// ── New reminder ──────────────────────────────────────────
function openReminderSheet(day) {
  openSheet(`
    <header class="sh-head">
      <div><p class="sh-kicker">Reminders</p><h2>New reminder</h2></div>
      <button type="button" class="sh-x" data-close aria-label="Close">✕</button>
    </header>
    <form class="rem-form big" id="new-rem" autocomplete="off">
      <input id="nr-title" placeholder="Remind me to…" required>
      <div class="rem-row">
        <input type="date" id="nr-date" value="${day}" required aria-label="Date">
        <input type="time" id="nr-time" aria-label="Time (optional)">
        <div class="swatches">${swatches(REMINDER_COLORS[0])}</div>
      </div>
      <div class="sh-actions">
        <button type="button" class="ghost" data-close>Cancel</button>
        <button type="submit" class="send">Add reminder</button>
      </div>
      <p class="sh-hint"><kbd>Enter</kbd> adds it · it shows as a dot on that day in the calendar</p>
    </form>`, null);
  document.getElementById("nr-title").focus();
  document.getElementById("new-rem").addEventListener("submit", (e) => {
    e.preventDefault();
    run(async () => {
      await Store.reminders.create({
        title: document.getElementById("nr-title").value.trim(),
        due_date: document.getElementById("nr-date").value,
        due_time: document.getElementById("nr-time").value || null,
        color: (sheet.body.querySelector("input[name=color]:checked") || {}).value || REMINDER_COLORS[0],
        done: false,
      });
      await reloadReminders();
      closeSheet(false);
    });
  });
}

// ── New to-dos ────────────────────────────────────────────
function openTodoSheet() {
  let added = 0;
  openSheet(`
    <header class="sh-head">
      <div><p class="sh-kicker">To-do</p><h2>Add to-dos</h2></div>
      <button type="button" class="sh-x" data-close aria-label="Close">✕</button>
    </header>
    <form class="rem-form big" id="new-todo" autocomplete="off">
      <input id="nt-text" placeholder="What needs doing?" required>
      <div class="sh-actions">
        <span class="sh-hint" id="nt-count"><kbd>Enter</kbd> adds it and keeps this open for the next one</span>
        <button type="button" class="send" data-close>Done</button>
      </div>
    </form>`, null);
  const input = document.getElementById("nt-text");
  input.focus();
  document.getElementById("new-todo").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    run(async () => {
      await Store.todos.create({ text, done: false, position: roomData.todos.length });
      await reloadTodos();
      added++;
      document.getElementById("nt-count").textContent = `Added ${added} · Enter adds another`;
    });
  });
}

// ── Floating iMessage bubble (in the room, works in VR) ──
let bubble = null;
function ensureBubble() {
  if (bubble) return bubble;
  const canvas = makeCanvas(1024, 512), tex = canvasTexture(canvas);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), basic({ map: tex, transparent: true }));
  const el = document.createElement("a-entity");
  el.classList.add("clickable");
  el.addEventListener("loaded", () => { el.setObject3D("mesh", mesh); el.object3D.visible = false; el.object3D.scale.setScalar(HIDDEN); }, { once: true });
  el.addEventListener("click", () => { if (!pointer.dragged) hideBubble(); });
  els.scene.appendChild(el);
  bubble = { el, mesh, canvas, tex, anim: null };
  return bubble;
}

function showReminderBubble(key, point) {
  const list = roomData.reminders.filter((r) => r.due_date === key);
  showBubble(`Reminders · ${dayLabel(key)}`, list, point);
}

function showBubble(title, items, point) {
  const b = ensureBubble();
  const aspect = drawReminderPopup(b.canvas, title, items);
  b.tex.dispose();
  b.tex = canvasTexture(b.canvas);
  b.mesh.material.map = b.tex;
  b.mesh.material.needsUpdate = true;
  b.mesh.geometry.dispose();
  b.mesh.geometry = new THREE.PlaneGeometry(1, aspect);

  const cam = els.cam.getObject3D("camera");
  const camPos = cam.getWorldPosition(new THREE.Vector3());
  let at;
  if (point) {
    at = point.clone().add(camPos.clone().sub(point).normalize().multiplyScalar(0.8));
  } else {
    at = camPos.clone().addScaledVector(cam.getWorldDirection(new THREE.Vector3()), 2.4);
  }
  const dist = at.distanceTo(camPos);
  const o = b.el.object3D;
  o.position.copy(at);
  o.lookAt(camPos);
  b.anim = { t0: els.scene.time / 1000, size: Math.max(0.8, dist * 0.6) };
  o.visible = true;
}

function hideBubble() {
  if (!bubble || !bubble.el.object3D.visible) return false;
  bubble.anim = null;
  bubble.el.object3D.visible = false;
  bubble.el.object3D.scale.setScalar(HIDDEN);
  return true;
}

// iMessage-style pop: grows from small with a little overshoot
function animateBubble(sec) {
  if (!bubble || !bubble.anim) return;
  const t = Math.min(1, (sec - bubble.anim.t0) / 0.35);
  const back = 1.70158;
  const e = 1 + (back + 1) * Math.pow(t - 1, 3) + back * Math.pow(t - 1, 2);   // ease-out-back
  bubble.el.object3D.scale.setScalar(Math.max(HIDDEN, bubble.anim.size * e));
  if (t >= 1) bubble.anim = null;
}

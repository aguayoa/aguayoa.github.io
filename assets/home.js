// Homepage: greeting, project grid, zoom-in project editor, visitor list (admin), import/export.

const cfg = window.AWARE_CONFIG || {};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const STATUS = window.STATUS_LABELS;
const pct = (p) => (p.tasks && p.tasks.length ? Math.round((p.tasks.filter((t) => t.done).length / p.tasks.length) * 100) : 0);

let projects = [];
let current = null;          // project open in the zoom view
let currentCard = null;
let editor = null;

// ── Boot ──────────────────────────────────────────────────
(async function boot() {
  $("brand-name").textContent = cfg.appName || "Aware Life";
  $("footer-name").textContent = cfg.appName || "Aware Life";
  $("tagline").textContent = cfg.tagline || "Live aware.";
  document.title = cfg.appName || "Aware Life";
  $("today").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  await Store.init();
  Account.mount($("account"));
  Store.onChange(refresh);
  $("banner-signin").addEventListener("click", Account.openSignIn);
  $("new-project").addEventListener("click", newProject);
  $("export-btn").addEventListener("click", exportAll);
  $("import-file").addEventListener("change", importFile);
  $("zoom-close").addEventListener("click", closeProject);
  $("zoom-backdrop").addEventListener("click", closeProject);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && current) closeProject(); });

  await refresh();
  const deep = new URLSearchParams(location.search).get("project");
  const card = deep && document.querySelector(`.project[data-id="${CSS.escape(deep)}"]`);
  if (card) openProject(deep, card);
})();

async function refresh() {
  const s = Store.state();
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  $("hello").textContent = `${part}, ${s.email ? s.email.split("@")[0] : "there"}`;
  $("sandbox-banner").hidden = s.signedIn;
  $("import-label").hidden = !s.signedIn;
  $("export-btn").hidden = !s.signedIn;
  try {
    projects = await Store.projects.list();
  } catch (e) {
    projects = [];
    console.error(e);
  }
  renderGrid();
  renderDashboard().catch((e) => console.error(e));
  $("admin").hidden = !s.isAdmin;
  if (s.isAdmin) loadVisitors();
}

// ── Grid ──────────────────────────────────────────────────
function cardHTML(p) {
  const v = pct(p);
  return `
    <button type="button" class="card project" data-id="${esc(p.id)}">
      <div class="card-top">
        <span class="card-icon" aria-hidden="true">${esc(p.icon || "📁")}</span>
        <span class="pill ${esc(p.status)}">${esc(STATUS[p.status] || p.status)}</span>
      </div>
      <h2>${esc(p.name)}</h2>
      <p>${esc(p.tagline)}</p>
      <div class="progress"><div class="bar"><span style="width:${v}%"></span></div>${v}%</div>
      <span class="card-cta">Open →</span>
    </button>`;
}

function renderGrid() {
  const grid = $("grid");
  grid.innerHTML = projects.map(cardHTML).join("") +
    `<button type="button" class="card add" id="add-card">+ New project</button>`;
  grid.querySelectorAll(".project").forEach((el) => el.addEventListener("click", () => openProject(el.dataset.id, el)));
  $("add-card").addEventListener("click", newProject);
}

async function newProject() {
  const created = await Store.projects.create({
    name: "New project", icon: "📁", status: "planning", category: "", tagline: "",
    link: "", overview: "", focus: [], tasks: [], position: projects.length,
  });
  await refresh();
  const card = document.querySelector(`.project[data-id="${CSS.escape(created.id)}"]`);
  await openProject(created.id, card);
  editor.focusName();
}

// ── Zoom view ─────────────────────────────────────────────
async function openProject(id, card) {
  const p = projects.find((x) => x.id === id);
  if (!p) return;
  current = p;
  currentCard = card;
  editor = ProjectEditor.mount($("zoom-body"), p, {
    onDelete: async () => { editor = null; card.remove(); await closeProject(); },
  });

  const zoom = $("zoom"), panel = $("zoom-panel");
  zoom.hidden = false;
  document.body.style.overflow = "hidden";
  card.style.visibility = "hidden";
  if (reduceMotion) return;

  // Grow the panel out of the card it came from
  const from = card.getBoundingClientRect(), to = panel.getBoundingClientRect();
  const ease = "cubic-bezier(.18,.9,.22,1.06)";
  panel.animate([
    { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, borderRadius: "14px", filter: "brightness(1.25)" },
    { transform: "none", borderRadius: "22px", filter: "brightness(1)" },
  ], { duration: 560, easing: ease });
  $("zoom-backdrop").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: "ease-out" });
  panel.querySelector(".zoom-glow").animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.35 }, { opacity: 0.25 }], { duration: 1300, easing: "ease-out", fill: "forwards" });
  panel.querySelector(".zoom-shine").animate([{ left: "-60%", opacity: 0.9 }, { left: "130%", opacity: 0 }], { duration: 900, delay: 220, easing: "ease-in-out" });
  panel.querySelectorAll(".reveal").forEach((el, i) => {
    el.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
      { duration: 380, delay: 240 + i * 45, easing: "ease-out", fill: "forwards" });
  });
}

async function closeProject() {
  if (!current) return;
  if (editor) await editor.flush();
  const id = current.id;
  current = null;
  await refresh();

  const zoom = $("zoom"), panel = $("zoom-panel");
  const card = document.querySelector(`.project[data-id="${CSS.escape(id)}"]`);
  const finish = () => {
    zoom.hidden = true;
    document.body.style.overflow = "";
    if (card) card.style.visibility = "";
  };
  if (reduceMotion || !card) {
    if (!reduceMotion) {
      await Promise.all([
        panel.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.94)" }], { duration: 220 }).finished,
        $("zoom-backdrop").animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).finished,
      ]);
    }
    return finish();
  }
  card.style.visibility = "hidden";
  const from = panel.getBoundingClientRect(), to = card.getBoundingClientRect();
  await Promise.all([
    panel.animate([
      { transform: "none", opacity: 1 },
      { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`, opacity: 0.4 },
    ], { duration: 360, easing: "cubic-bezier(.5,0,.75,0)" }).finished,
    $("zoom-backdrop").animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360 }).finished,
  ]);
  finish();
}

// ── Dashboard ─────────────────────────────────────────────
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function renderDashboard() {
  const [reminders, todos, notes] = await Promise.all([Store.reminders.list(), Store.todos.list(), Store.notes.all()]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayK = dayKey(today);
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);

  // activity per day: a written summary + each reminder finished (counted on its day)
  const activity = {};
  Object.keys(notes).forEach((k) => { activity[k] = (activity[k] || 0) + 1; });
  reminders.filter((r) => r.done).forEach((r) => { activity[r.due_date] = (activity[r.due_date] || 0) + 1; });

  // summary streaks
  let current = 0;
  const cursor = new Date(today);
  if (!notes[todayK]) cursor.setDate(cursor.getDate() - 1);   // today isn't over yet
  while (notes[dayKey(cursor)]) { current++; cursor.setDate(cursor.getDate() - 1); }
  let best = 0, run = 0, prev = null;
  Object.keys(notes).sort().forEach((k) => {
    const d = new Date(k + "T00:00:00");
    run = prev && (d - prev) / 86400000 === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  });

  const tasks = projects.flatMap((p) => p.tasks || []);
  const doneTasks = tasks.filter((t) => t.done).length;
  const active = projects.filter((p) => p.status === "active").length;
  const dueSoon = reminders.filter((r) => !r.done && r.due_date >= todayK && r.due_date < dayKey(in7)).length;
  const overdue = reminders.filter((r) => !r.done && r.due_date < todayK).length;
  const openTodos = todos.filter((t) => !t.done).length;

  const tile = (k, v, sub) => `<div class="tile"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(sub)}</div></div>`;
  $("tiles").innerHTML = [
    tile("Active projects", active, `of ${projects.length} total`),
    tile("Steps done", `${tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0}%`, `${doneTasks} of ${tasks.length} steps`),
    tile("Reminders this week", dueSoon, overdue ? `${overdue} overdue` : "none overdue"),
    tile("Open to-dos", openTodos, `${todos.length - openTodos} done`),
    tile("Summary streak", `${current} day${current === 1 ? "" : "s"}`, `best ${best}`),
  ].join("");
  $("dash-mode").textContent = Store.state().signedIn ? "" : "Sample data";

  $("proj-bars").innerHTML = projects.map((p) => {
    const total = (p.tasks || []).length, done = (p.tasks || []).filter((t) => t.done).length, v = pct(p);
    return `<div class="bar-row" data-tip="${esc(`${p.name}: ${done} of ${total} steps done`)}">
      <span class="name">${esc(p.icon || "")} ${esc(p.name)}</span><span class="val">${v}%</span>
      <div class="bar"><span style="width:${v}%"></span></div></div>`;
  }).join("") || `<p class="muted">No projects yet.</p>`;

  // 12 weeks of days, one column per week (Sunday at the top)
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - 7 * 11);
  const cells = [];
  for (let i = 0; i < 84; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = dayKey(d), n = activity[k] || 0;
    const level = n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : 3;
    const label = `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}: ${n ? `${n} activit${n === 1 ? "y" : "ies"}${notes[k] ? " · summary written" : ""}` : "no activity"}`;
    cells.push(`<i data-l="${level}" class="${d > today ? "future" : ""}${k === todayK ? " today" : ""}" role="gridcell" aria-label="${esc(label)}" data-tip="${esc(label)}"></i>`);
  }
  $("heat").innerHTML = cells.join("");
}

// Hover tooltips for dashboard marks
document.addEventListener("pointerover", (e) => {
  const t = e.target.closest("[data-tip]");
  const tip = $("tip");
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip;
  tip.hidden = false;
});
document.addEventListener("pointermove", (e) => {
  const tip = $("tip");
  if (tip.hidden) return;
  const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8);
  tip.style.left = `${x}px`;
  tip.style.top = `${e.clientY + 16}px`;
});

// ── Import / export ───────────────────────────────────────
async function exportAll() {
  const data = await Store.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "aware-life-export.json" });
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importFile(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const count = await Store.importData(JSON.parse(await file.text()));
    await refresh();
    alert(`Imported ${count} item${count === 1 ? "" : "s"}.`);
  } catch (ex) {
    alert(`That file couldn't be imported: ${ex.message}`);
  }
}

// ── Visitors (admin only) ────────────────────────────────
async function loadVisitors() {
  try {
    const rows = await Store.adminVisitors();
    const fmt = (d) => (d ? new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
    $("visitors").innerHTML = rows.map((r) =>
      `<tr><td>${esc(r.email)}</td><td>${fmt(r.joined)}</td><td>${fmt(r.last_visit)}</td><td>${r.visits}</td></tr>`).join("") ||
      `<tr><td colspan="4" class="muted">No visitors yet.</td></tr>`;
    $("visitor-count").textContent = `${rows.length} account${rows.length === 1 ? "" : "s"}`;
  } catch (e) {
    $("visitors").innerHTML = `<tr><td colspan="4" class="muted">Couldn't load visitors: ${esc(e.message)}</td></tr>`;
  }
}

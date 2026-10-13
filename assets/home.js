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
let saveTimer = null;

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
  const name = $("z-name");
  name.focus();
  name.select();
}

// ── Zoom view ─────────────────────────────────────────────
async function openProject(id, card) {
  const p = projects.find((x) => x.id === id);
  if (!p) return;
  current = JSON.parse(JSON.stringify(p));
  currentCard = card;
  renderEditor();

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
  await flushSave();
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

// ── Editor ────────────────────────────────────────────────
function renderEditor() {
  const p = current;
  const statusOptions = Object.entries(STATUS)
    .map(([v, label]) => `<option value="${v}" ${v === p.status ? "selected" : ""}>${label}</option>`).join("");
  $("zoom-body").innerHTML = `
    <div class="z-head reveal">
      <input class="ed ed-icon" id="z-icon" value="${esc(p.icon)}" maxlength="4" aria-label="Icon (emoji)">
      <input class="ed ed-name" id="z-name" value="${esc(p.name)}" aria-label="Project name">
    </div>
    <input class="ed ed-tagline reveal" id="z-tagline" value="${esc(p.tagline)}" placeholder="One-line description" aria-label="Tagline">
    <div class="z-meta reveal">
      <select id="z-status" aria-label="Status">${statusOptions}</select>
      <input id="z-category" value="${esc(p.category)}" placeholder="Category" aria-label="Category">
      <input id="z-link" value="${esc(p.link)}" placeholder="Website (optional)" aria-label="Website">
    </div>

    <div class="z-section reveal">
      <h3>Overview</h3>
      <textarea class="ed" id="z-overview" placeholder="What is this project about?">${esc(p.overview)}</textarea>
    </div>

    <div class="z-section reveal">
      <h3>Current focus</h3>
      <ul class="z-list" id="z-focus">${(p.focus || []).map((f, i) => `
        <li><input class="ed" data-focus="${i}" value="${esc(f)}" aria-label="Focus ${i + 1}">
        <button type="button" class="z-del" data-del-focus="${i}" aria-label="Remove">✕</button></li>`).join("")}
      </ul>
      <button type="button" class="ghost-btn z-add" id="z-add-focus">+ Add focus</button>
    </div>

    <div class="z-section reveal">
      <h3>Next steps · <span id="z-progress">${pct(p)}%</span></h3>
      <div class="progress"><div class="bar"><span id="z-bar" style="width:${pct(p)}%"></span></div></div>
      <ul class="z-list" id="z-tasks">${(p.tasks || []).map((t, i) => `
        <li class="${t.done ? "done" : ""}">
          <input type="checkbox" data-task-done="${i}" ${t.done ? "checked" : ""} aria-label="Done">
          <input class="ed" data-task="${i}" value="${esc(t.text)}" aria-label="Step ${i + 1}">
          <button type="button" class="z-del" data-del-task="${i}" aria-label="Remove">✕</button>
        </li>`).join("")}
      </ul>
      <button type="button" class="ghost-btn z-add" id="z-add-task">+ Add step</button>
    </div>

    <div class="z-foot reveal">
      <button type="button" class="ghost-btn danger" id="z-delete">Delete project</button>
      <span class="z-status" id="z-status-text">${Store.state().signedIn ? "Changes save automatically" : "Sandbox: saved in this browser"}</span>
    </div>`;

  const body = $("zoom-body");
  body.oninput = (e) => { readField(e.target); scheduleSave(); };
  body.onchange = (e) => { if (e.target.matches("select, [type=checkbox]")) { readField(e.target); scheduleSave(); } };
  body.onclick = (e) => {
    const t = e.target;
    if (t.id === "z-add-focus") { current.focus.push(""); rerenderAndFocus(`[data-focus="${current.focus.length - 1}"]`); }
    if (t.id === "z-add-task") { current.tasks.push({ text: "", done: false }); rerenderAndFocus(`[data-task="${current.tasks.length - 1}"]`); }
    if (t.dataset.delFocus) { current.focus.splice(Number(t.dataset.delFocus), 1); rerenderAndFocus(); scheduleSave(); }
    if (t.dataset.delTask) { current.tasks.splice(Number(t.dataset.delTask), 1); rerenderAndFocus(); scheduleSave(); }
    if (t.id === "z-delete") deleteCurrent();
  };
  body.onkeydown = (e) => {
    // Enter in a list item adds the next one
    if (e.key === "Enter" && e.target.matches("[data-task]")) { e.preventDefault(); $("z-add-task").click(); }
    if (e.key === "Enter" && e.target.matches("[data-focus]")) { e.preventDefault(); $("z-add-focus").click(); }
  };
}

function rerenderAndFocus(selector) {
  const scroll = $("zoom-body").scrollTop;
  renderEditor();
  $("zoom-body").querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; });
  $("zoom-body").scrollTop = scroll;
  if (selector) $("zoom-body").querySelector(selector)?.focus();
}

function readField(el) {
  const p = current;
  const map = { "z-icon": "icon", "z-name": "name", "z-tagline": "tagline", "z-status": "status", "z-category": "category", "z-link": "link", "z-overview": "overview" };
  if (map[el.id]) p[map[el.id]] = el.value;
  if (el.dataset.focus !== undefined) p.focus[Number(el.dataset.focus)] = el.value;
  if (el.dataset.task !== undefined) p.tasks[Number(el.dataset.task)].text = el.value;
  if (el.dataset.taskDone !== undefined) {
    p.tasks[Number(el.dataset.taskDone)].done = el.checked;
    el.closest("li").classList.toggle("done", el.checked);
    $("z-progress").textContent = `${pct(p)}%`;
    $("z-bar").style.width = `${pct(p)}%`;
  }
}

function scheduleSave() {
  $("z-status-text").textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 600);
}

async function save() {
  if (!current) return;
  const { id, user_id, created_at, updated_at, position, ...patch } = current;
  patch.focus = patch.focus.map((f) => f.trim()).filter(Boolean);
  patch.tasks = patch.tasks.filter((t) => t.text.trim());
  patch.name = patch.name.trim() || "Untitled project";
  try {
    await Store.projects.update(id, patch);
    $("z-status-text").textContent = Store.state().signedIn ? "Saved" : "Saved in this browser";
  } catch (e) {
    $("z-status-text").textContent = `Couldn't save: ${e.message}`;
  }
}

async function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; await save(); }
}

async function deleteCurrent() {
  if (!confirm(`Delete "${current.name}"? This can't be undone.`)) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  await Store.projects.remove(current.id);
  if (currentCard) currentCard.remove();
  await closeProject();
}

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

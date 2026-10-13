// Shared project editor, used by the homepage zoom view and the Time Chamber.
// ProjectEditor.mount(container, project, { onDelete }) → { flush() }
// Fields look like plain text until clicked; changes save automatically through the Store.

(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (p) => (p.tasks && p.tasks.length ? Math.round((p.tasks.filter((t) => t.done).length / p.tasks.length) * 100) : 0);

  function mount(container, project, { onDelete } = {}) {
    const p = JSON.parse(JSON.stringify(project));
    p.focus = p.focus || [];
    p.tasks = p.tasks || [];
    let timer = null;
    const q = (sel) => container.querySelector(sel);

    function render() {
      const statusOptions = Object.entries(window.STATUS_LABELS)
        .map(([v, label]) => `<option value="${v}" ${v === p.status ? "selected" : ""}>${label}</option>`).join("");
      container.innerHTML = `
        <div class="z-head reveal">
          <input class="ed ed-icon" data-f="icon" value="${esc(p.icon)}" maxlength="4" aria-label="Icon (emoji)">
          <input class="ed ed-name" data-f="name" value="${esc(p.name)}" aria-label="Project name">
        </div>
        <input class="ed ed-tagline reveal" data-f="tagline" value="${esc(p.tagline)}" placeholder="One-line description" aria-label="Tagline">
        <div class="z-meta reveal">
          <select data-f="status" aria-label="Status">${statusOptions}</select>
          <input data-f="category" value="${esc(p.category)}" placeholder="Category" aria-label="Category">
          <input data-f="link" value="${esc(p.link)}" placeholder="Website (optional)" aria-label="Website">
        </div>
        <div class="z-section reveal">
          <h3>Overview</h3>
          <textarea class="ed" data-f="overview" placeholder="What is this project about?">${esc(p.overview)}</textarea>
        </div>
        <div class="z-section reveal">
          <h3>Current focus</h3>
          <ul class="z-list">${p.focus.map((f, i) => `
            <li><input class="ed" data-focus="${i}" value="${esc(f)}" aria-label="Focus ${i + 1}">
            <button type="button" class="z-del" data-del-focus="${i}" aria-label="Remove">✕</button></li>`).join("")}
          </ul>
          <button type="button" class="ghost-btn z-add" data-add="focus">+ Add focus</button>
        </div>
        <div class="z-section reveal">
          <h3>Next steps · <span data-progress>${pct(p)}%</span></h3>
          <div class="progress"><div class="bar"><span data-bar style="width:${pct(p)}%"></span></div></div>
          <ul class="z-list">${p.tasks.map((t, i) => `
            <li class="${t.done ? "done" : ""}">
              <input type="checkbox" data-task-done="${i}" ${t.done ? "checked" : ""} aria-label="Done">
              <input class="ed" data-task="${i}" value="${esc(t.text)}" aria-label="Step ${i + 1}">
              <button type="button" class="z-del" data-del-task="${i}" aria-label="Remove">✕</button>
            </li>`).join("")}
          </ul>
          <button type="button" class="ghost-btn z-add" data-add="task">+ Add step</button>
        </div>
        <div class="z-foot reveal">
          <button type="button" class="ghost-btn danger" data-delete>Delete project</button>
          <span class="z-status" data-status>${Store.state().signedIn ? "Changes save automatically" : "Sandbox: saved in this browser"}</span>
        </div>`;
    }

    function rerender(focusSel) {
      const scroller = container.closest("[data-scroll]") || container;
      const top = scroller.scrollTop;
      render();
      container.querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; });
      scroller.scrollTop = top;
      if (focusSel) q(focusSel)?.focus();
    }

    function read(el) {
      if (el.dataset.f) p[el.dataset.f] = el.value;
      if (el.dataset.focus !== undefined) p.focus[Number(el.dataset.focus)] = el.value;
      if (el.dataset.task !== undefined) p.tasks[Number(el.dataset.task)].text = el.value;
      if (el.dataset.taskDone !== undefined) {
        p.tasks[Number(el.dataset.taskDone)].done = el.checked;
        el.closest("li").classList.toggle("done", el.checked);
        q("[data-progress]").textContent = `${pct(p)}%`;
        q("[data-bar]").style.width = `${pct(p)}%`;
      }
    }

    const setStatus = (t) => { const s = q("[data-status]"); if (s) s.textContent = t; };
    function schedule() {
      setStatus("Saving…");
      clearTimeout(timer);
      timer = setTimeout(save, 600);
    }
    async function save() {
      timer = null;
      const { id, user_id, created_at, updated_at, position, ...patch } = p;
      patch.focus = patch.focus.map((f) => f.trim()).filter(Boolean);
      patch.tasks = patch.tasks.filter((t) => t.text.trim());
      patch.name = (patch.name || "").trim() || "Untitled project";
      try {
        await Store.projects.update(id, patch);
        setStatus(Store.state().signedIn ? "Saved" : "Saved in this browser");
      } catch (e) {
        setStatus(`Couldn't save: ${e.message}`);
      }
    }

    render();
    container.oninput = (e) => { read(e.target); schedule(); };
    container.onchange = (e) => { if (e.target.matches("select, [type=checkbox]")) { read(e.target); schedule(); } };
    container.onclick = async (e) => {
      const t = e.target;
      if (t.dataset.add === "focus") { p.focus.push(""); rerender(`[data-focus="${p.focus.length - 1}"]`); }
      if (t.dataset.add === "task") { p.tasks.push({ text: "", done: false }); rerender(`[data-task="${p.tasks.length - 1}"]`); }
      if (t.dataset.delFocus) { p.focus.splice(Number(t.dataset.delFocus), 1); rerender(); schedule(); }
      if (t.dataset.delTask) { p.tasks.splice(Number(t.dataset.delTask), 1); rerender(); schedule(); }
      if (t.hasAttribute("data-delete")) {
        if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
        clearTimeout(timer);
        timer = null;
        await Store.projects.remove(p.id);
        if (onDelete) onDelete(p.id);
      }
    };
    container.onkeydown = (e) => {
      // Enter in a list item adds the next one
      if (e.key === "Enter" && e.target.matches("[data-task]")) { e.preventDefault(); q('[data-add="task"]').click(); }
      if (e.key === "Enter" && e.target.matches("[data-focus]")) { e.preventDefault(); q('[data-add="focus"]').click(); }
    };

    return {
      async flush() { if (timer) { clearTimeout(timer); await save(); } },
      focusName() { const n = q('[data-f="name"]'); n.focus(); n.select(); },
    };
  }

  window.ProjectEditor = { mount };
})();

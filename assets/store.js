// Aware Life data layer.
// Signed in (Supabase configured): data lives in your Supabase database, protected by row-level security.
// Not signed in: a sandbox in this browser, seeded with sample content.

(function () {
  const cfg = window.AWARE_CONFIG || {};
  const sb = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
    : null;

  let user = null;
  let isAdmin = false;
  const listeners = new Set();
  const cloud = () => !!(sb && user);
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  // ── Browser sandbox ─────────────────────────────────────
  const SANDBOX_KEY = "aware-sandbox-v1";
  const stamp = (row, i = 0) => ({ ...row, id: newId(), position: i, created_at: new Date().toISOString() });
  function seed() {
    return {
      projects: (window.SAMPLE_PROJECTS || []).map(stamp),
      reminders: (window.SAMPLE_REMINDERS || []).map(stamp),
      todos: (window.SAMPLE_TODOS || []).map(stamp),
      notes: {},
    };
  }
  let sandbox;
  try { sandbox = JSON.parse(localStorage.getItem(SANDBOX_KEY)); } catch {}
  if (!sandbox) sandbox = seed();
  const saveSandbox = () => { try { localStorage.setItem(SANDBOX_KEY, JSON.stringify(sandbox)); } catch {} };

  // ── Collections (same API in both modes) ────────────────
  function collection(table, key, sort) {
    const sortRows = (rows) => [...rows].sort(sort);
    return {
      async list() {
        if (!cloud()) return sortRows(sandbox[key]);
        const { data, error } = await sb.from(table).select("*");
        if (error) throw error;
        return sortRows(data);
      },
      async create(row) {
        if (!cloud()) {
          const created = stamp(row, sandbox[key].length);
          sandbox[key].push(created);
          saveSandbox();
          return created;
        }
        const { data, error } = await sb.from(table).insert(row).select().single();
        if (error) throw error;
        return data;
      },
      async update(id, patch) {
        if (!cloud()) {
          const row = sandbox[key].find((r) => r.id === id);
          if (row) Object.assign(row, patch);
          saveSandbox();
          return row;
        }
        const body = table === "projects" ? { ...patch, updated_at: new Date().toISOString() } : patch;
        const { data, error } = await sb.from(table).update(body).eq("id", id).select().single();
        if (error) throw error;
        return data;
      },
      async remove(id) {
        if (!cloud()) {
          sandbox[key] = sandbox[key].filter((r) => r.id !== id);
          saveSandbox();
          return;
        }
        const { error } = await sb.from(table).delete().eq("id", id);
        if (error) throw error;
      },
    };
  }

  const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at).localeCompare(String(b.created_at));
  const byDue = (a, b) => a.due_date.localeCompare(b.due_date) || String(a.due_time || "99").localeCompare(String(b.due_time || "99"));

  const notes = {
    async all() {
      if (!cloud()) return { ...sandbox.notes };
      const { data, error } = await sb.from("day_notes").select("day, body");
      if (error) throw error;
      return Object.fromEntries(data.map((r) => [r.day, r.body]));
    },
    async set(day, body) {
      const text = (body || "").trim();
      if (!cloud()) {
        if (text) sandbox.notes[day] = text; else delete sandbox.notes[day];
        saveSandbox();
        return;
      }
      if (text) {
        const { error } = await sb.from("day_notes").upsert({ day, body: text, updated_at: new Date().toISOString() });
        if (error) throw error;
      } else {
        const { error } = await sb.from("day_notes").delete().eq("day", day);
        if (error) throw error;
      }
    },
  };

  // ── Auth ────────────────────────────────────────────────
  async function refreshAdmin() {
    isAdmin = false;
    if (!cloud()) return;
    const { data } = await sb.from("admins").select("user_id").eq("user_id", user.id);
    isAdmin = !!(data && data.length);
  }
  const snapshot = () => ({
    configured: !!sb,
    signedIn: cloud(),
    email: user ? user.email : null,
    isAdmin,
    mode: cloud() ? "cloud" : "sandbox",
  });
  const emit = () => listeners.forEach((fn) => fn(snapshot()));

  async function logVisit() {
    if (!cloud()) return;
    const key = `aware-visit-${user.id}-${location.pathname}`;
    try {
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < 30 * 60 * 1000) return;   // at most one visit per page per half hour
      sessionStorage.setItem(key, String(Date.now()));
    } catch {}
    await sb.from("visits").insert({ page: location.pathname });
  }

  window.Store = {
    async init() {
      if (sb) {
        const { data } = await sb.auth.getSession();
        user = data.session ? data.session.user : null;
        await refreshAdmin();
        logVisit();
        sb.auth.onAuthStateChange(async (_event, session) => {
          const before = user && user.id;
          user = session ? session.user : null;
          if (before !== (user && user.id)) {
            await refreshAdmin();
            logVisit();
            emit();
          }
        });
      }
      return snapshot();
    },
    state: snapshot,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    async signIn(email) {
      if (!sb) throw new Error("Accounts aren't set up yet.");
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + location.pathname },
      });
      if (error) throw error;
    },
    async signOut() {
      if (sb) await sb.auth.signOut();
    },

    projects: collection("projects", "projects", byPosition),
    reminders: collection("reminders", "reminders", byDue),
    todos: collection("todos", "todos", byPosition),
    notes,

    async adminVisitors() {
      if (!cloud() || !isAdmin) return [];
      const { data, error } = await sb.rpc("admin_visitors");
      if (error) throw error;
      return data;
    },

    // Bring in projects / reminders / to-dos / notes from an exported JSON file
    async importData(json) {
      let count = 0;
      for (const p of json.projects || []) {
        const { id, user_id, created_at, updated_at, ...row } = p;
        await this.projects.create(row);
        count++;
      }
      for (const r of json.reminders || []) {
        const { id, user_id, created_at, ...row } = r;
        await this.reminders.create(row);
        count++;
      }
      for (const t of json.todos || []) {
        const { id, user_id, created_at, ...row } = t;
        await this.todos.create(row);
        count++;
      }
      for (const [day, body] of Object.entries(json.notes || {})) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(day) && typeof body === "string") { await notes.set(day, body); count++; }
      }
      return count;
    },
    async exportData() {
      return {
        projects: await this.projects.list(),
        reminders: await this.reminders.list(),
        todos: await this.todos.list(),
        notes: await notes.all(),
      };
    },

    resetSandbox() {
      sandbox = seed();
      saveSandbox();
    },
  };
})();

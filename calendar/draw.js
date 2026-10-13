// Draws the fiscal-year months and title onto canvases used as textures in the room.

// FY_START_MONTH: 10 = federal fiscal year (FY26 = Oct 2025 – Sep 2026).
//                 Set to 1 to make FY26 = Jan – Dec 2026.
const FY_START_MONTH = 10;
const FY_CHOICES = [26, 27];
const DEFAULT_FY = 26;

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const Q_COLORS = ["#2b59c3", "#1f8a4c", "#b7791f", "#6b46c1"];
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function fiscalMonths(fy) {
  const startYear = FY_START_MONTH === 1 ? 2000 + fy : 2000 + fy - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const offset = FY_START_MONTH - 1 + i;
    return { year: startYear + Math.floor(offset / 12), month: offset % 12, quarter: Math.floor(i / 3) + 1 };
  });
}

function eventsByDate() {
  const map = {};
  (window.EVENTS || []).forEach((e) => (map[e.date] ||= []).push(e));
  return map;
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
  return text + "…";
}

function drawMonth(canvas, { year, month, quarter }, events, notes = {}, selectedKey = null, reminders = {}) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const qc = Q_COLORS[quarter - 1];
  const now = new Date();
  const todayKey = keyOf(now.getFullYear(), now.getMonth(), now.getDate());

  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = qc;
  ctx.fillRect(0, 0, W, 16);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#1b1b1a";
  ctx.font = `700 76px ${FONT}`;
  ctx.fillText(MONTHS[month], 48, 116);
  const mw = ctx.measureText(MONTHS[month]).width;
  ctx.fillStyle = "#8a857a";
  ctx.font = `500 46px ${FONT}`;
  ctx.fillText(String(year), 48 + mw + 22, 116);

  ctx.textAlign = "right";
  ctx.fillStyle = qc;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(`Q${quarter}`, W - 48, 110);

  const x0 = 40, cw = (W - 80) / 7;
  ctx.textAlign = "center";
  ctx.font = `600 30px ${FONT}`;
  ["SUN","MON","TUE","WED","THU","FRI","SAT"].forEach((d, i) => {
    ctx.fillStyle = i === 0 || i === 6 ? "#b0aa9d" : "#6b6b66";
    ctx.fillText(d, x0 + cw * i + cw / 2, 184);
  });
  ctx.fillStyle = "#e6e0d3";
  ctx.fillRect(40, 204, W - 80, 3);

  const top = 216, rh = (H - top - 24) / 6;
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= days; d++) {
    const idx = first + d - 1;
    const c = idx % 7, r = Math.floor(idx / 7);
    const x = x0 + c * cw, y = top + r * rh;
    const key = keyOf(year, month, d);
    const weekend = c === 0 || c === 6;

    ctx.fillStyle = weekend ? "#f6f2e9" : "#fffdf8";
    ctx.fillRect(x + 3, y + 3, cw - 6, rh - 6);
    ctx.strokeStyle = "#ece6da";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, cw - 6, rh - 6);

    ctx.textAlign = "left";
    ctx.font = `600 40px ${FONT}`;
    if (key === todayKey) {
      ctx.fillStyle = "#2b59c3";
      ctx.beginPath();
      ctx.arc(x + 40, y + 40, 29, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(String(d), x + 40, y + 54);
    } else {
      ctx.fillStyle = weekend ? "#a39d90" : "#1b1b1a";
      ctx.fillText(String(d), x + 16, y + 54);
    }

    const dayEvents = (events[key] || []).slice(0, 2);
    dayEvents.forEach((e, i) => {
      const ey = y + 82 + i * 24;
      ctx.fillStyle = e.color || "#2b59c3";
      ctx.beginPath();
      ctx.arc(x + 18, ey - 7, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.font = `600 20px ${FONT}`;
      ctx.fillText(fitText(ctx, e.title, cw - 42), x + 30, ey);
    });

    if (notes[key]) {
      // note marker in the corner + first words of the summary
      ctx.fillStyle = "#b7791f";
      ctx.beginPath();
      ctx.moveTo(x + cw - 4, y + 4);
      ctx.lineTo(x + cw - 30, y + 4);
      ctx.lineTo(x + cw - 4, y + 30);
      ctx.fill();
      if (dayEvents.length < 2) {
        ctx.fillStyle = "#6b6b66";
        ctx.textAlign = "left";
        ctx.font = `italic 500 19px ${FONT}`;
        ctx.fillText(fitText(ctx, notes[key], cw - 26), x + 12, y + 82 + dayEvents.length * 24);
      }
    }

    // reminder dots along the bottom of the day (click them for the iMessage bubble)
    (reminders[key] || []).slice(0, 5).forEach((r, i) => {
      ctx.fillStyle = r.done ? "#c7c7cc" : r.color || "#0a84ff";
      ctx.beginPath();
      ctx.arc(x + 22 + i * 24, y + rh - 20, 9, 0, Math.PI * 2);
      ctx.fill();
    });

    if (key === selectedKey) {
      ctx.strokeStyle = "#2b59c3";
      ctx.lineWidth = 6;
      ctx.strokeRect(x + 5, y + 5, cw - 10, rh - 10);
    }
  }
}

// What's at canvas pixel (cx, cy) of a month panel: { key: "YYYY-MM-DD", inDots } or null.
// inDots is true when the click lands on the reminder-dot strip at the bottom of the day.
const HEADER_BOTTOM = 200;
function cellAt({ year, month }, cx, cy) {
  const x0 = 40, top = 216, cw = (1024 - 80) / 7, rh = (896 - top - 24) / 6;
  if (cy < top || cx < x0 || cx > 1024 - x0) return null;
  const c = Math.floor((cx - x0) / cw), r = Math.floor((cy - top) / rh);
  if (r > 5) return null;
  const d = r * 7 + c - new Date(year, month, 1).getDay() + 1;
  if (d < 1 || d > new Date(year, month + 1, 0).getDate()) return null;
  return { key: keyOf(year, month, d), inDots: cy > top + (r + 1) * rh - 42 };
}
const dayAt = (m, cx, cy) => (cellAt(m, cx, cy) || {}).key || null;

// Month tab for the collapsed "Month list" view
function drawTab(canvas, { year, month, quarter }, selected) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = selected ? "#2b59c3" : "#fffdf8";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = Q_COLORS[quarter - 1];
  ctx.fillRect(0, 0, 18, H);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = selected ? "#ffffff" : "#1b1b1a";
  ctx.font = `700 92px ${FONT}`;
  ctx.fillText(MONTHS[month], 60, H / 2 + 4);
  ctx.textAlign = "right";
  ctx.fillStyle = selected ? "#dbe5ff" : "#8a857a";
  ctx.font = `500 64px ${FONT}`;
  ctx.fillText(`${year} · Q${quarter}`, W - 40, H / 2 + 4);
}

// Toolbar button on the wall
function drawButton(canvas, label, active) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = active ? "#2b59c3" : "#fffdf8";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = active ? "#2b59c3" : "#cfc7b5";
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, W - 10, H - 10);
  ctx.fillStyle = active ? "#ffffff" : "#1b1b1a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(H * 0.42)}px ${FONT}`;
  ctx.fillText(label, W / 2, H / 2 + 4);
}

// Corner handle used to drag-resize the calendar
function drawHandle(canvas) {
  const ctx = canvas.getContext("2d");
  const S = canvas.width;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = "#2b59c3";
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = S * 0.07;
  ctx.lineCap = "round";
  const a = S * 0.3, b = S * 0.7, h = S * 0.14;
  ctx.beginPath();
  ctx.moveTo(a, b); ctx.lineTo(b, a);
  ctx.moveTo(a, b - h); ctx.lineTo(a, b); ctx.lineTo(a + h, b);
  ctx.moveTo(b - h, a); ctx.lineTo(b, a); ctx.lineTo(b, a + h);
  ctx.stroke();
}

function wrapText(ctx, text, maxW) {
  const lines = [];
  String(text).split(/\n/).forEach((para) => {
    let line = "";
    para.split(/\s+/).forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
      else line = test;
    });
    lines.push(line);
  });
  return lines;
}

function formatDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// Read-only day card shown inside VR
function drawDayCard(canvas, key, events, note) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#2b59c3";
  ctx.fillRect(0, 0, W, 14);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#1b1b1a";
  ctx.font = `700 54px ${FONT}`;
  ctx.fillText(formatDay(key), 48, 100);

  let y = 160;
  ctx.font = `600 34px ${FONT}`;
  events.forEach((e) => {
    ctx.fillStyle = e.color || "#2b59c3";
    ctx.beginPath(); ctx.arc(60, y - 11, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(fitText(ctx, e.title, W - 140), 84, y);
    y += 50;
  });
  if (events.length) y += 10;

  ctx.font = `500 34px ${FONT}`;
  ctx.fillStyle = note ? "#1b1b1a" : "#8a857a";
  const lines = wrapText(ctx, note || "No summary yet.", W - 96).slice(0, 11);
  lines.forEach((l) => { ctx.fillText(l, 48, y); y += 46; });

  ctx.fillStyle = "#8a857a";
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText("Click this card to close · edit summaries outside VR", 48, H - 36);
}

function drawTitle(canvas, fy) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const months = fiscalMonths(fy);
  const a = months[0], b = months[11];
  const lastDay = new Date(b.year, b.month + 1, 0).getDate();

  ctx.clearRect(0, 0, W, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#1b1b1a";
  ctx.font = `800 300px ${FONT}`;
  ctx.fillText(`FY${fy}`, W / 2, 310);
  ctx.fillStyle = "#6b6b66";
  ctx.font = `500 84px ${FONT}`;
  ctx.fillText(`${MONTHS_SHORT[a.month]} 1, ${a.year}  –  ${MONTHS_SHORT[b.month]} ${lastDay}, ${b.year}`, W / 2, 460);
}

function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ── Reminders & to-dos ────────────────────────────────────
const IOS = { blue: "#0a84ff", gray: "#e9e9eb", grayText: "#8e8e93", ink: "#1c1c1e" };
const REMINDER_COLORS = ["#0a84ff", "#34c759", "#ff9f0a", "#ff375f", "#bf5af2", "#5ac8fa"];

function todayKey() {
  const d = new Date();
  return keyOf(d.getFullYear(), d.getMonth(), d.getDate());
}

const dateOf = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };

function dayLabel(key) {
  const date = dateOf(key);
  const diff = Math.round((date - dateOf(todayKey())) / 86400000);
  const short = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return diff === 0 ? `Today · ${short}` : diff === 1 ? `Tomorrow · ${short}` : diff === -1 ? `Yesterday · ${short}` : short;
}

function timeLabel(t) {
  if (!t) return "All day";
  const [h, m] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// A message bubble with an iMessage-style tail on the bottom right. Returns its rectangle.
function drawBubble(ctx, text, right, y, maxW, size, color, textColor, strike) {
  ctx.font = `500 ${size}px ${FONT}`;
  const lines = wrapText(ctx, text, maxW - size * 1.3);
  const lh = size * 1.28, padX = size * 0.65, padY = size * 0.45;
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2);
  const h = lines.length * lh + padY * 2;
  const x = right - w;
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, Math.min(size * 0.9, h / 2));
  ctx.fill();
  ctx.beginPath();                                   // tail
  ctx.moveTo(right - size * 0.5, y + h - size * 0.7);
  ctx.quadraticCurveTo(right + size * 0.05, y + h, right + size * 0.35, y + h + size * 0.05);
  ctx.quadraticCurveTo(right - size * 0.35, y + h + size * 0.02, right - size * 0.9, y + h - size * 0.2);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  lines.forEach((l, i) => {
    const ty = y + padY + lh * (i + 0.78);
    ctx.fillText(l, x + padX, ty);
    if (strike) ctx.fillRect(x + padX, ty - size * 0.32, ctx.measureText(l).width, Math.max(2, size / 14));
  });
  return { x, y, w, h };
}

function boardHeader(ctx, W, title, subtitle, buttonLabel, hits, action) {
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, W, ctx.canvas.height);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = IOS.ink;
  ctx.font = `800 110px ${FONT}`;
  ctx.fillText(title, 90, 160);
  ctx.fillStyle = IOS.grayText;
  ctx.font = `500 44px ${FONT}`;
  ctx.fillText(subtitle, 94, 222);
  ctx.font = `700 46px ${FONT}`;
  const bw = ctx.measureText(buttonLabel).width + 80, bx = W - 90 - bw, by = 92;
  ctx.fillStyle = IOS.blue;
  roundRect(ctx, bx, by, bw, 92, 46);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(buttonLabel, bx + bw / 2, by + 62);
  hits.push({ x: bx, y: by, w: bw, h: 92, action });
  ctx.fillStyle = "#ece6da";
  ctx.fillRect(90, 262, W - 180, 4);
}

function drawDeleteDot(ctx, cx, cy, hits, action, id) {
  ctx.fillStyle = "#f2f2f7";
  ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = IOS.grayText;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 10); ctx.lineTo(cx + 10, cy + 10);
  ctx.moveTo(cx + 10, cy - 10); ctx.lineTo(cx - 10, cy + 10);
  ctx.stroke();
  hits.push({ x: cx - 36, y: cy - 36, w: 72, h: 72, action, id });
}

function emptyBoard(ctx, W, H, text) {
  ctx.fillStyle = IOS.grayText;
  ctx.textAlign = "center";
  ctx.font = `500 54px ${FONT}`;
  ctx.fillText(text, W / 2, H / 2);
}

// Wall view: reminders as an iMessage thread, grouped by day. Fills `hits` with clickable areas.
function drawReminderBoard(canvas, reminders, hits) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const upcoming = reminders.filter((r) => !r.done && r.due_date >= todayKey()).length;
  boardHeader(ctx, W, "Reminders", `${upcoming} upcoming · click a bubble to mark it done`, "+ New reminder", hits, "reminder-new");

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const from = keyOf(since.getFullYear(), since.getMonth(), since.getDate());
  const list = reminders.filter((r) => r.due_date >= from);
  if (!list.length) return emptyBoard(ctx, W, H, "No reminders yet. Click “+ New reminder”.");

  const right = W - 300, maxW = 1100;
  let y = 330, lastDay = null, shown = 0;
  for (const r of list) {
    if (y > H - 170) break;
    if (r.due_date !== lastDay) {
      lastDay = r.due_date;
      ctx.fillStyle = IOS.grayText;
      ctx.textAlign = "center";
      ctx.font = `600 36px ${FONT}`;
      ctx.fillText(dayLabel(r.due_date), W / 2, y);
      y += 40;
    }
    const b = drawBubble(ctx, r.title, right, y, maxW, 48, r.done ? IOS.gray : r.color || IOS.blue, r.done ? IOS.grayText : "#fff", r.done);
    hits.push({ x: b.x, y: b.y, w: b.w, h: b.h, action: "reminder-toggle", id: r.id });
    drawDeleteDot(ctx, b.x - 70, b.y + b.h / 2, hits, "reminder-delete", r.id);
    ctx.fillStyle = IOS.grayText;
    ctx.textAlign = "right";
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(`${timeLabel(r.due_time)}${r.done ? " · Done" : ""}`, right, b.y + b.h + 42);
    y = b.y + b.h + 84;
    shown++;
  }
  if (shown < list.length) {
    ctx.fillStyle = IOS.grayText;
    ctx.textAlign = "center";
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(`+ ${list.length - shown} more`, W / 2, H - 50);
  }
}

// Wall view: to-do list with round checkboxes (open items first)
function drawTodoBoard(canvas, todos, hits) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const open = todos.filter((t) => !t.done), done = todos.filter((t) => t.done);
  boardHeader(ctx, W, "To-do", `${open.length} left · ${done.length} done`, "+ New to-do", hits, "todo-new");
  const list = [...open, ...done];
  if (!list.length) return emptyBoard(ctx, W, H, "Nothing to do. Click “+ New to-do”.");

  const x0 = 260, x1 = W - 260, rowH = 100;
  let y = 300, shown = 0;
  for (const t of list) {
    if (y + rowH > H - 80) break;
    const cy = y + rowH / 2;
    ctx.lineWidth = 6;
    ctx.strokeStyle = t.done ? IOS.blue : "#c7c7cc";
    ctx.fillStyle = IOS.blue;
    ctx.beginPath();
    ctx.arc(x0 + 34, cy, 30, 0, Math.PI * 2);
    if (t.done) ctx.fill(); else ctx.stroke();
    if (t.done) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x0 + 20, cy); ctx.lineTo(x0 + 30, cy + 11); ctx.lineTo(x0 + 49, cy - 12); ctx.stroke();
    }
    ctx.fillStyle = t.done ? IOS.grayText : IOS.ink;
    ctx.textAlign = "left";
    ctx.font = `500 52px ${FONT}`;
    const text = fitText(ctx, t.text, x1 - x0 - 220);
    ctx.fillText(text, x0 + 100, cy + 18);
    if (t.done) ctx.fillRect(x0 + 100, cy, ctx.measureText(text).width, 4);
    ctx.fillStyle = "#ece6da";
    ctx.fillRect(x0 + 100, y + rowH - 2, x1 - x0 - 100, 2);
    hits.push({ x: x0, y, w: x1 - x0 - 90, h: rowH, action: "todo-toggle", id: t.id });
    drawDeleteDot(ctx, x1 - 40, cy, hits, "todo-delete", t.id);
    y += rowH;
    shown++;
  }
  if (shown < list.length) {
    ctx.fillStyle = IOS.grayText;
    ctx.textAlign = "center";
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(`+ ${list.length - shown} more`, W / 2, H - 40);
  }
}

let measureCtx;
const measure = () => (measureCtx ||= document.createElement("canvas").getContext("2d"));

// Floating iMessage-style bubble for one day's reminders (or a single gray note).
// Resizes the canvas to fit and returns height / width.
function drawReminderPopup(canvas, title, reminders) {
  const W = 1024, maxW = 760;
  const m = measure();
  m.font = `500 46px ${FONT}`;
  const heights = reminders.map((r) => wrapText(m, r.title, maxW - 60).length * 59 + 42 + 70);
  const H = 130 + heights.reduce((a, b) => a + b, 0) + 30;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  roundRect(ctx, 0, 0, W, H, 60);
  ctx.fill();
  ctx.fillStyle = IOS.grayText;
  ctx.textAlign = "center";
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(title, W / 2, 74);
  let y = 120;
  reminders.forEach((r) => {
    const gray = r.done || r.note;
    const b = drawBubble(ctx, r.title, W - 70, y, maxW, 46, gray ? IOS.gray : r.color || IOS.blue, gray ? IOS.ink : "#fff", r.done);
    ctx.fillStyle = IOS.grayText;
    ctx.textAlign = "right";
    ctx.font = `500 28px ${FONT}`;
    ctx.fillText(r.note ? "" : `${timeLabel(r.due_time)}${r.done ? " · Done" : ""}`, W - 70, b.y + b.h + 40);
    y = b.y + b.h + 70;
  });
  return H / W;
}

// The Reminders toolbar button while it's "ringing": phone handset wiggling, sound waves, count badge
function drawRingButton(canvas, count, t, ringing) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#34c759";
  roundRect(ctx, 6, 6, W - 12, H - 12, H / 2 - 6);
  ctx.fill();

  // handset, tilting back and forth while it rings
  const px = H * 0.62, py = H / 2;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ringing ? Math.sin(t * 40) * 0.35 : 0);
  ctx.font = `${Math.round(H * 0.5)}px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("📞", 0, 4);
  ctx.restore();

  // sound waves pulsing out of the phone
  if (ringing) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const phase = (t * 2.2 + i / 3) % 1;
      ctx.globalAlpha = 1 - phase;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(px, py, H * (0.32 + phase * 0.22), -0.7, 0.7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(H * 0.34)}px ${FONT}`;
  ctx.fillText("Reminders", H * 1.08, H / 2 + 3);

  // red count badge
  const r = H * 0.2, bx = W - r - 14, by = r + 10;
  ctx.fillStyle = "#ff3b30";
  ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = `800 ${Math.round(r * 1.2)}px ${FONT}`;
  ctx.fillText(String(Math.min(count, 99)), bx, by + 2);
}

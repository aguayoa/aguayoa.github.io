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

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
  return text + "…";
}

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const fmtRange = (a, b) => {
  const f = (k) => { const [y, m, d] = k.split("-").map(Number); return `${m}/${d}/${String(y).slice(2)}`; };
  return a === b ? f(a) : `${f(a)} – ${f(b)}`;
};

// Month panel layout (canvas is 1024 × 896)
const CAL = { x0: 40, top: 216, cw: (1024 - 80) / 7, rh: (896 - 216 - 24) / 6, lanes: 2, laneY: 50, laneH: 20, laneGap: 2 };

// Draws one month. `events` are {id, title, start_date, end_date, color} spans; multi-day events become
// bars across the days they cover (2 lanes per week, "+N more" past that). `hits` collects clickable
// event-bar rectangles. `selection` = {start, end} keys highlights a day range being selected.
function drawMonth(canvas, { year, month, quarter }, events = [], notes = {}, selectedKey = null, reminders = {}, hits = null, selection = null) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const qc = Q_COLORS[quarter - 1];
  const now = new Date();
  const todayKey = keyOf(now.getFullYear(), now.getMonth(), now.getDate());
  const { x0, cw, top, rh } = CAL;
  const first = new Date(year, month, 1).getDay();
  const days = daysInMonth(year, month);

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
  ctx.fillText(`${year} · ${days} days`, 48 + mw + 22, 116);

  ctx.textAlign = "right";
  ctx.fillStyle = qc;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(`Q${quarter}`, W - 48, 110);

  ctx.textAlign = "center";
  ctx.font = `600 30px ${FONT}`;
  ["SUN","MON","TUE","WED","THU","FRI","SAT"].forEach((d, i) => {
    ctx.fillStyle = i === 0 || i === 6 ? "#b0aa9d" : "#6b6b66";
    ctx.fillText(d, x0 + cw * i + cw / 2, 184);
  });
  ctx.fillStyle = "#e6e0d3";
  ctx.fillRect(40, 204, W - 80, 3);

  const cellXY = (d) => { const idx = first + d - 1; return { c: idx % 7, r: Math.floor(idx / 7), x: x0 + (idx % 7) * cw, y: top + Math.floor(idx / 7) * rh }; };
  const inSel = (key) => selection && key >= selection.start && key <= selection.end;

  // ── day cells ──
  for (let d = 1; d <= days; d++) {
    const { c, x, y } = cellXY(d);
    const key = keyOf(year, month, d);
    const weekend = c === 0 || c === 6;

    ctx.fillStyle = inSel(key) ? "#dde6fb" : weekend ? "#f6f2e9" : "#fffdf8";
    ctx.fillRect(x + 3, y + 3, cw - 6, rh - 6);
    ctx.strokeStyle = inSel(key) ? "#2b59c3" : "#ece6da";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, cw - 6, rh - 6);

    ctx.textAlign = "left";
    ctx.font = `600 34px ${FONT}`;
    let numRight;
    if (key === todayKey) {
      ctx.fillStyle = "#2b59c3";
      ctx.beginPath();
      ctx.arc(x + 34, y + 27, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(String(d), x + 34, y + 39);
      numRight = x + 58;
    } else {
      ctx.fillStyle = weekend ? "#a39d90" : "#1b1b1a";
      ctx.fillText(String(d), x + 14, y + 39);
      numRight = x + 14 + ctx.measureText(String(d)).width;
    }

    // gold dot = this day has a written summary
    if (notes[key]) {
      ctx.fillStyle = "#b7791f";
      ctx.beginPath();
      ctx.arc(numRight + 13, y + 28, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // reminder dots in the top-right corner (click them for the iMessage bubble)
    const rs = (reminders[key] || []).slice(0, 4);
    rs.forEach((r, i) => {
      ctx.fillStyle = r.done ? "#c7c7cc" : r.color || "#0a84ff";
      ctx.beginPath();
      ctx.arc(x + cw - 16 - i * 20, y + 20, 8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ── event bars ──
  const monthStart = keyOf(year, month, 1), monthEnd = keyOf(year, month, days);
  const spans = events
    .filter((e) => e.start_date <= monthEnd && e.end_date >= monthStart)
    .map((e) => {
      const a = e.start_date < monthStart ? 1 : Number(e.start_date.slice(8));
      const b = e.end_date > monthEnd ? days : Number(e.end_date.slice(8));
      return { e, a, b, len: b - a };
    })
    .sort((p, q) => p.a - q.a || q.len - p.len || String(p.e.title).localeCompare(q.e.title));

  // occupancy[row][lane] = 7 booleans (one per weekday column)
  const occupancy = Array.from({ length: 6 }, () => Array.from({ length: CAL.lanes }, () => Array(7).fill(false)));
  const overflow = {};               // "row,col" → count of events that didn't fit
  const freeLane = (row, c1, c2) => {
    for (let l = 0; l < CAL.lanes; l++) if (!occupancy[row][l].slice(c1, c2 + 1).some(Boolean)) return l;
    return -1;
  };

  spans.forEach(({ e, a, b }) => {
    // one lane for the whole event so it reads as a single bar across weeks
    const segs = [];
    for (let d = a; d <= b;) {
      const { r, c } = cellXY(d);
      const end = Math.min(b, d + (6 - c));
      segs.push({ r, c1: c, c2: cellXY(end).c, startsHere: d === a });
      d = end + 1;
    }
    let lane = -1;
    for (let l = 0; l < CAL.lanes && lane < 0; l++) {
      if (segs.every((s) => !occupancy[s.r][l].slice(s.c1, s.c2 + 1).some(Boolean))) lane = l;
    }
    if (lane < 0) {
      segs.forEach((s) => { for (let c = s.c1; c <= s.c2; c++) overflow[`${s.r},${c}`] = (overflow[`${s.r},${c}`] || 0) + 1; });
      return;
    }
    const color = e.color || "#2b59c3";
    segs.forEach((s) => {
      for (let c = s.c1; c <= s.c2; c++) occupancy[s.r][lane][c] = true;
      const bx = x0 + s.c1 * cw + 6, bw = (s.c2 - s.c1 + 1) * cw - 12;
      const by = top + s.r * rh + CAL.laneY + lane * (CAL.laneH + CAL.laneGap), bh = CAL.laneH;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 5);
      ctx.fill();
      const continuesLeft = !s.startsHere || (e.start_date < monthStart && s === segs[0]);
      if (continuesLeft) { ctx.fillStyle = color; ctx.fillRect(bx - 6, by, 8, bh); }        // runs in from the previous week/month
      if (s === segs[segs.length - 1] && e.end_date > monthEnd) ctx.fillRect(bx + bw - 2, by, 8, bh);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.font = `700 15px ${FONT}`;
      ctx.fillText(fitText(ctx, e.title, bw - 14), bx + 7, by + 15);
      if (hits) hits.push({ x: bx, y: by - 2, w: bw, h: bh + 4, eventId: e.id });
    });
  });

  // third strip of each cell: "+N more" or the first words of the day's summary
  for (let d = 1; d <= days; d++) {
    const { c, r, x, y } = cellXY(d);
    const key = keyOf(year, month, d);
    const sy = y + CAL.laneY + CAL.lanes * (CAL.laneH + CAL.laneGap) + 10;
    ctx.textAlign = "left";
    if (overflow[`${r},${c}`]) {
      ctx.fillStyle = "#6b6b66";
      ctx.font = `700 15px ${FONT}`;
      ctx.fillText(`+${overflow[`${r},${c}`]} more`, x + 10, sy);
    } else if (notes[key]) {
      ctx.fillStyle = "#8a857a";
      ctx.font = `italic 500 15px ${FONT}`;
      ctx.fillText(fitText(ctx, notes[key], cw - 20), x + 10, sy);
    }
    if (key === selectedKey) {
      ctx.strokeStyle = "#2b59c3";
      ctx.lineWidth = 6;
      ctx.strokeRect(x + 5, y + 5, cw - 10, rh - 10);
    }
  }
}

// What's at canvas pixel (cx, cy) of a month panel: { key: "YYYY-MM-DD", inDots } or null.
// inDots is true when the click lands on the reminder dots in the day's top-right corner.
const HEADER_BOTTOM = 200;
function cellAt({ year, month }, cx, cy) {
  const { x0, top, cw, rh } = CAL;
  if (cy < top || cx < x0 || cx > 1024 - x0) return null;
  const c = Math.floor((cx - x0) / cw), r = Math.floor((cy - top) / rh);
  if (r > 5) return null;
  const d = r * 7 + c - new Date(year, month, 1).getDay() + 1;
  if (d < 1 || d > daysInMonth(year, month)) return null;
  const inX = cx - (x0 + c * cw), inY = cy - (top + r * rh);
  return { key: keyOf(year, month, d), inDots: inY < 34 && inX > cw - 84 };
}
const dayAt = (m, cx, cy) => (cellAt(m, cx, cy) || {}).key || null;

// Month tab for the Overview layout: name, year, quarter and how many days it has
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
  ctx.font = `700 82px ${FONT}`;
  ctx.fillText(MONTHS[month], 60, H / 2 + 4);
  ctx.textAlign = "right";
  ctx.fillStyle = selected ? "#dbe5ff" : "#8a857a";
  ctx.font = `500 46px ${FONT}`;
  ctx.fillText(`${daysInMonth(year, month)} days · ${year} · Q${quarter}`, W - 40, H / 2 + 4);
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

// ── Overview: the whole fiscal year, one row per month, every day side by side ──

// Streak boxes at the bottom of every day, one per life area. They fill in from connected sources
// (Strava, etc.); until then they're empty outlines. Clicking one opens the Gravity Room.
const STREAK_AREAS = window.LIFE_AREAS;   // defined in assets/areas.js

const PLAN = { W: 4096, H: 3072, pad: 36, labelW: 340, headH: 210, lanes: 2 };
function plannerGeom() {
  const x0 = PLAN.pad + PLAN.labelW;
  return { x0, y0: PLAN.headH, cw: (PLAN.W - x0 - PLAN.pad) / 31, rh: (PLAN.H - PLAN.headH - PLAN.pad) / 12 };
}

// Draws the year planner. Fills `hits` with clickable areas:
// {type: "event"|"streak"|"dots"|"month"|"day", x, y, w, h, key?, eventId?, area?, index?}
function drawPlanner(canvas, fy, data, hits, selection, selectedKey) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const { x0, y0, cw, rh } = plannerGeom();
  const months = fiscalMonths(fy);
  const today = todayKey();
  const notes = data.notes || {}, streaks = data.streaks || {}, events = data.events || [];
  const reminders = {};
  (data.reminders || []).forEach((r) => (reminders[r.due_date] ||= []).push(r));
  const inSel = (k) => selection && k >= selection.start && k <= selection.end;

  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, W, H);

  // ── header: title, streak legend, day numbers ──
  const a = months[0], b = months[11];
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#1b1b1a";
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText(`FY${fy} Overview`, PLAN.pad, 100);
  const tw = ctx.measureText(`FY${fy} Overview`).width;
  ctx.fillStyle = "#8a857a";
  ctx.font = `500 44px ${FONT}`;
  ctx.fillText(`${MONTHS_SHORT[a.month]} ${a.year} – ${MONTHS_SHORT[b.month]} ${b.year} · ${months.reduce((n, m) => n + daysInMonth(m.year, m.month), 0)} days`, PLAN.pad + tw + 30, 100);

  ctx.textAlign = "right";
  let lx = W - PLAN.pad;
  ctx.font = `600 34px ${FONT}`;
  [...STREAK_AREAS].reverse().forEach((s) => {
    const label = `${s.label} · ${s.source}`;
    ctx.fillStyle = "#4a4a46";
    ctx.fillText(label, lx, 96);
    lx -= ctx.measureText(label).width + 16;
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.roundRect(lx - 30, 70, 30, 30, 6); ctx.fill();
    lx -= 70;
  });
  ctx.fillStyle = "#8a857a";
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText("Streaks:", lx + 20, 96);

  ctx.textAlign = "center";
  ctx.font = `700 34px ${FONT}`;
  for (let d = 1; d <= 31; d++) {
    ctx.fillStyle = "#8a857a";
    ctx.fillText(String(d), x0 + (d - 1) * cw + cw / 2, y0 - 22);
  }
  ctx.fillStyle = "#e6e0d3";
  ctx.fillRect(PLAN.pad, y0 - 6, W - PLAN.pad * 2, 4);

  const laneY = 112, laneH = 30, laneGap = 4;
  const boxSize = Math.floor((cw - 16 - 3 * 5) / 4);

  months.forEach((m, i) => {
    const y = y0 + i * rh;
    const days = daysInMonth(m.year, m.month);
    const qc = Q_COLORS[m.quarter - 1];

    // month label
    ctx.fillStyle = qc;
    ctx.fillRect(PLAN.pad, y + 8, 12, rh - 16);
    ctx.textAlign = "left";
    ctx.fillStyle = "#1b1b1a";
    ctx.font = `800 62px ${FONT}`;
    ctx.fillText(MONTHS[m.month], PLAN.pad + 34, y + rh * 0.46);
    ctx.fillStyle = "#8a857a";
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(`${days} days`, PLAN.pad + 34, y + rh * 0.46 + 48);
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(`${m.year} · Q${m.quarter}`, PLAN.pad + 34, y + rh * 0.46 + 88);
    hits.push({ type: "month", index: i, x: PLAN.pad, y, w: PLAN.labelW, h: rh });

    for (let d = 1; d <= 31; d++) {
      const x = x0 + (d - 1) * cw;
      if (d > days) {                                   // month is shorter: blank, hatched cell
        ctx.fillStyle = "#f1ece2";
        ctx.fillRect(x + 3, y + 3, cw - 6, rh - 6);
        ctx.strokeStyle = "#e6dfd2";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let t = -rh; t < cw; t += 22) { ctx.moveTo(x + 3 + t, y + rh - 3); ctx.lineTo(x + 3 + t + rh, y + 3); }
        ctx.save(); ctx.rect(x + 3, y + 3, cw - 6, rh - 6); ctx.clip(); ctx.stroke(); ctx.restore();
        continue;
      }
      const key = keyOf(m.year, m.month, d);
      const dow = new Date(m.year, m.month, d).getDay();
      const weekend = dow === 0 || dow === 6;

      ctx.fillStyle = inSel(key) ? "#dde6fb" : weekend ? "#f4efe4" : "#fffdf8";
      ctx.fillRect(x + 3, y + 3, cw - 6, rh - 6);
      ctx.strokeStyle = inSel(key) ? "#2b59c3" : "#ebe5d8";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, cw - 6, rh - 6);

      // weekday letter + day number
      ctx.textAlign = "left";
      ctx.fillStyle = weekend ? "#b0aa9d" : "#8a857a";
      ctx.font = `700 22px ${FONT}`;
      ctx.fillText("SMTWTFS"[dow], x + 12, y + 32);
      ctx.font = `700 40px ${FONT}`;
      if (key === today) {
        ctx.fillStyle = "#2b59c3";
        ctx.beginPath(); ctx.arc(x + 30, y + 70, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(String(d), x + 30, y + 84);
      } else {
        ctx.fillStyle = weekend ? "#a39d90" : "#1b1b1a";
        ctx.fillText(String(d), x + 10, y + 84);
      }

      // gold dot = summary written
      if (notes[key]) {
        ctx.fillStyle = "#b7791f";
        ctx.beginPath(); ctx.arc(x + cw - 18, y + 24, 9, 0, Math.PI * 2); ctx.fill();
      }
      // reminder dots (click for the iMessage bubble)
      const rs = (reminders[key] || []).slice(0, 3);
      rs.forEach((r, j) => {
        ctx.fillStyle = r.done ? "#c7c7cc" : r.color || "#0a84ff";
        ctx.beginPath(); ctx.arc(x + cw - 18 - j * 22, y + 62, 9, 0, Math.PI * 2); ctx.fill();
      });
      if (rs.length) hits.push({ type: "dots", key, x: x + cw - 30 - (rs.length - 1) * 22, y: y + 46, w: 24 + (rs.length - 1) * 22 + 8, h: 32 });

      // streak boxes along the bottom
      const by = y + rh - boxSize - 12;
      const future = key > today;
      STREAK_AREAS.forEach((s, j) => {
        const bx = x + 8 + j * (boxSize + 5);
        const done = streaks[key] && streaks[key][s.id];
        ctx.beginPath();
        ctx.roundRect(bx, by, boxSize, boxSize, 5);
        if (done) {
          ctx.fillStyle = s.color;
          ctx.fill();
        } else {
          ctx.globalAlpha = future ? 0.25 : 0.55;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        hits.push({ type: "streak", key, area: s.id, x: bx - 2, y: by - 2, w: boxSize + 4, h: boxSize + 4 });
      });

      hits.push({ type: "day", key, x, y, w: cw, h: rh });
      if (key === selectedKey) {
        ctx.strokeStyle = "#2b59c3";
        ctx.lineWidth = 6;
        ctx.strokeRect(x + 5, y + 5, cw - 10, rh - 10);
      }
    }

    // event bars: straight runs across the row (2 lanes, "+N" past that)
    const start = keyOf(m.year, m.month, 1), end = keyOf(m.year, m.month, days);
    const spans = events
      .filter((e) => e.start_date <= end && e.end_date >= start)
      .map((e) => ({ e, a: e.start_date < start ? 1 : Number(e.start_date.slice(8)), b: e.end_date > end ? days : Number(e.end_date.slice(8)) }))
      .sort((p, q) => p.a - q.a || (q.b - q.a) - (p.b - p.a));
    const lanes = Array.from({ length: PLAN.lanes }, () => Array(32).fill(false));
    const more = Array(32).fill(0);
    spans.forEach(({ e, a, b }) => {
      const lane = lanes.findIndex((l) => !l.slice(a, b + 1).some(Boolean));
      if (lane < 0) { for (let d = a; d <= b; d++) more[d]++; return; }
      for (let d = a; d <= b; d++) lanes[lane][d] = true;
      const bx = x0 + (a - 1) * cw + 6, bw = (b - a + 1) * cw - 12, bY = y + laneY + lane * (laneH + laneGap);
      ctx.fillStyle = e.color || "#2b59c3";
      ctx.beginPath(); ctx.roundRect(bx, bY, bw, laneH, 8); ctx.fill();
      if (e.start_date < start) ctx.fillRect(bx - 6, bY, 14, laneH);   // continues from last month
      if (e.end_date > end) ctx.fillRect(bx + bw - 8, bY, 14, laneH);   // continues into next month
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.font = `700 21px ${FONT}`;
      ctx.fillText(fitText(ctx, e.title, bw - 16), bx + 8, bY + 22);
      hits.push({ type: "event", eventId: e.id, x: bx, y: bY - 2, w: bw, h: laneH + 4 });
    });
    more.forEach((n, d) => {
      if (!n) return;
      ctx.fillStyle = "#6b6b66";
      ctx.textAlign = "left";
      ctx.font = `700 20px ${FONT}`;
      ctx.fillText(`+${n}`, x0 + (d - 1) * cw + 10, y + laneY + PLAN.lanes * (laneH + laneGap) + 22);
    });
  });
}

// Topmost clickable thing at a planner pixel
function plannerHit(hits, px, py) {
  const order = ["event", "streak", "dots", "month", "day"];
  let best = null;
  for (const h of hits) {
    if (px < h.x || px > h.x + h.w || py < h.y || py > h.y + h.h) continue;
    if (!best || order.indexOf(h.type) < order.indexOf(best.type)) best = h;
  }
  return best;
}

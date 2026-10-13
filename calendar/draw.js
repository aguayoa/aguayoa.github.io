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

function drawMonth(canvas, { year, month, quarter }, events, notes = {}, selectedKey = null) {
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

    if (key === selectedKey) {
      ctx.strokeStyle = "#2b59c3";
      ctx.lineWidth = 6;
      ctx.strokeRect(x + 5, y + 5, cw - 10, rh - 10);
    }
  }
}

// Which day (as "YYYY-MM-DD") is at canvas pixel (cx, cy) of a month panel? null if none.
const HEADER_BOTTOM = 200;
function dayAt({ year, month }, cx, cy) {
  const x0 = 40, top = 216, cw = (1024 - 80) / 7, rh = (896 - top - 24) / 6;
  if (cy < top || cx < x0 || cx > 1024 - x0) return null;
  const c = Math.floor((cx - x0) / cw), r = Math.floor((cy - top) / rh);
  if (r > 5) return null;
  const d = r * 7 + c - new Date(year, month, 1).getDay() + 1;
  if (d < 1 || d > new Date(year, month + 1, 0).getDate()) return null;
  return keyOf(year, month, d);
}

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

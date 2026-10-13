// A floating 1960s leather tool bag that holds the projects.
// Click it to open: the frame jaws spread and a card for each project rises out.
// Click a card to bring that project's details up in front of you.
// Home view: the cards fly out larger, in an arc in front of you, trailing sparkles.

const STATUS_COLORS = { active: "#1f8a4c", planning: "#b7791f", talks: "#6b46c1", paused: "#718096", done: "#2b59c3" };
const EMOJI_FONT = "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
const progressOf = (p) => (p.tasks.length ? p.tasks.filter((t) => t.done).length / p.tasks.length : 0);

// ── Drawing ───────────────────────────────────────────────
function drawStatusPill(ctx, status, x, y, size) {
  const label = (window.STATUS_LABELS || {})[status] || status;
  const color = STATUS_COLORS[status] || "#6b6b66";
  ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(label).width + size * 1.2, h = size * 1.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size / 9);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + size * 0.6, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

function drawProgress(ctx, pct, x, y, w, h) {
  ctx.fillStyle = "#ecece6";
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  if (pct > 0) {
    ctx.fillStyle = "#2b59c3";
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * pct), h, h / 2); ctx.fill();
  }
}

function drawProjectCard(canvas, p) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = STATUS_COLORS[p.status] || "#2b59c3";
  ctx.fillRect(0, 0, W, 14);

  ctx.textAlign = "left";
  ctx.font = `86px ${EMOJI_FONT}`;
  ctx.fillText(p.icon, 40, 130);
  drawStatusPill(ctx, p.status, W - 260, 50, 30);

  ctx.fillStyle = "#1b1b1a";
  ctx.font = `800 62px ${FONT}`;
  ctx.fillText(fitText(ctx, p.name, W - 80), 40, 225);
  ctx.fillStyle = "#6b6b66";
  ctx.font = `500 30px ${FONT}`;
  wrapText(ctx, p.tagline, W - 80).slice(0, 2).forEach((l, i) => ctx.fillText(l, 40, 278 + i * 40));

  const pct = progressOf(p);
  drawProgress(ctx, pct, 40, H - 70, W - 180, 18);
  ctx.fillStyle = "#6b6b66";
  ctx.font = `700 30px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(`${Math.round(pct * 100)}%`, W - 40, H - 50);
}

function drawProjectDetail(canvas, p) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height, M = 60;
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = STATUS_COLORS[p.status] || "#2b59c3";
  ctx.fillRect(0, 0, W, 18);

  ctx.textAlign = "left";
  ctx.font = `110px ${EMOJI_FONT}`;
  ctx.fillText(p.icon, M, 160);
  ctx.fillStyle = "#1b1b1a";
  ctx.font = `800 76px ${FONT}`;
  ctx.fillText(fitText(ctx, p.name, W - M * 2 - 150), M + 150, 135);
  ctx.fillStyle = "#6b6b66";
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText(p.category, M + 150, 185);
  let pillX = M;
  pillX += drawStatusPill(ctx, p.status, pillX, 220, 32) + 20;
  if (p.link) {
    ctx.fillStyle = "#2b59c3";
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(p.link.replace(/^https?:\/\//, ""), pillX, 258);
  }

  let y = 340;
  const heading = (t) => {
    ctx.fillStyle = "#8a857a";
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(t.toUpperCase(), M, y);
    y += 50;
  };

  heading("Overview");
  ctx.fillStyle = "#1b1b1a";
  ctx.font = `500 34px ${FONT}`;
  wrapText(ctx, p.overview, W - M * 2).slice(0, 5).forEach((l) => { ctx.fillText(l, M, y); y += 46; });
  y += 30;

  heading("Current focus");
  ctx.font = `500 34px ${FONT}`;
  p.focus.slice(0, 4).forEach((f) => {
    ctx.fillStyle = "#2b59c3";
    ctx.beginPath(); ctx.arc(M + 10, y - 11, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1b1b1a";
    ctx.fillText(fitText(ctx, f, W - M * 2 - 40), M + 34, y);
    y += 48;
  });
  y += 30;

  const done = p.tasks.filter((t) => t.done).length;
  heading(`Next steps · ${done} of ${p.tasks.length} done`);
  drawProgress(ctx, progressOf(p), M, y - 30, W - M * 2, 16);
  y += 30;
  ctx.font = `500 32px ${FONT}`;
  p.tasks.slice(0, 8).forEach((t) => {
    ctx.strokeStyle = t.done ? "#1f8a4c" : "#cfc7b5";
    ctx.fillStyle = "#1f8a4c";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(M, y - 28, 32, 32, 7);
    if (t.done) ctx.fill(); else ctx.stroke();
    if (t.done) {
      ctx.strokeStyle = "#fff";
      ctx.beginPath(); ctx.moveTo(M + 7, y - 12); ctx.lineTo(M + 14, y - 4); ctx.lineTo(M + 26, y - 20); ctx.stroke();
    }
    ctx.fillStyle = t.done ? "#8a857a" : "#1b1b1a";
    ctx.fillText(fitText(ctx, t.text, W - M * 2 - 56), M + 52, y);
    y += 52;
  });

  ctx.fillStyle = "#8a857a";
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText("Click this card to put it back · edit projects on your Aware Life homepage", M, H - 40);
}

function leatherTexture() {
  const c = makeCanvas(512, 512), ctx = c.getContext("2d");
  ctx.fillStyle = "#6e4122";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random();
    ctx.fillStyle = v < 0.5 ? `rgba(40,20,8,${Math.random() * 0.18})` : `rgba(160,110,70,${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  ctx.strokeStyle = "rgba(30,15,5,0.18)";
  for (let i = 0; i < 40; i++) {           // creases from decades of use
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) { x += (Math.random() - 0.5) * 120; y += (Math.random() - 0.5) * 60; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

// ── Component ─────────────────────────────────────────────
AFRAME.registerComponent("tool-bag", {
  schema: { face: { type: "vec3", default: { x: 0, y: 0, z: -10 } } },

  init() {
    this.open = false;
    this.base = this.el.object3D.position.clone();
    this.leather = new THREE.MeshLambertMaterial({ map: leatherTexture() });
    this.darkLeather = lambert("#3d2312");
    this.steel = new THREE.MeshLambertMaterial({ color: "#b9b6ad", emissive: "#202020" });
    this.brass = new THREE.MeshLambertMaterial({ color: "#b8913c", emissive: "#3a2a08" });

    // The bag faces the start point
    const f = this.data.face;
    this.el.object3D.rotation.y = Math.atan2(f.x - this.base.x, f.z - this.base.z);

    this.bag = this.buildBag();
    const bagEl = document.createElement("a-entity");
    bagEl.classList.add("clickable");
    bagEl.addEventListener("loaded", () => bagEl.setObject3D("mesh", this.bag), { once: true });
    bagEl.addEventListener("click", () => { if (!pointer.dragged) this.toggle(); });
    this.el.appendChild(bagEl);
    this.bagEl = bagEl;

    this.cards = [];
    this.openTime = -1;
    this.homeMode = false;
    this.buildShadow();
    this.buildSparkles();
    this.setProjects(window.SAMPLE_PROJECTS || []);
  },

  buildBag() {
    const L = 1.0, W1 = 0.52, W2 = 0.46, H = 0.26, ridge = 0.32;
    const g = new THREE.Group();
    const add = (geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };

    // Body: a trapezoid profile (wider at the bottom) extruded along the bag's length, with rounded edges
    const shape = new THREE.Shape();
    shape.moveTo(-W1 / 2, 0);
    shape.lineTo(W1 / 2, 0);
    shape.lineTo(W2 / 2, H);
    shape.lineTo(-W2 / 2, H);
    shape.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.035, bevelSegments: 5, curveSegments: 4 });
    bodyGeo.translate(0, 0, -L / 2);
    bodyGeo.rotateY(Math.PI / 2);
    add(bodyGeo, this.leather);

    // Dark interior visible when the jaws open
    const inside = add(new THREE.PlaneGeometry(L - 0.04, W2 - 0.04), lambert("#1a0f07"), 0, H + 0.03, 0);
    inside.rotation.x = -Math.PI / 2;

    // Stitched leather welts where the sides fold
    [-1, 1].forEach((side) => {
      const welt = add(new THREE.CylinderGeometry(0.018, 0.018, L + 0.06, 10), this.darkLeather, 0, H + 0.04, side * (W2 / 2 + 0.03));
      welt.rotation.z = Math.PI / 2;
    });

    // Top flaps on hinges at the frame bars; closed they meet at a ridge, open they fold outward
    const s = Math.hypot(W2 / 2, ridge);
    this.closedAngle = Math.atan2(W2 / 2, ridge);
    this.flaps = [-1, 1].map((side) => {
      const hinge = new THREE.Group();
      hinge.position.set(0, H + 0.04, side * (W2 / 2 + 0.03));
      const flap = new THREE.Mesh(new THREE.BoxGeometry(L, s, 0.022), this.leather);
      flap.position.y = s / 2;
      hinge.add(flap);
      // Steel frame jaw along the top edge, with hinge knuckles at the ends
      const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, L + 0.08, 12), this.steel);
      jaw.rotation.z = Math.PI / 2;
      jaw.position.y = s;
      hinge.add(jaw);
      [-1, 1].forEach((end) => {
        const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), this.steel);
        knuckle.position.set(end * (L / 2 + 0.04), s, 0);
        hinge.add(knuckle);
      });

      // Leather handle, standing upright when the bag is closed
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 24, Math.PI), this.darkLeather);
      handle.position.set(0, s, side * 0.012);
      handle.rotation.x = side * this.closedAngle;
      hinge.add(handle);
      [-1, 1].forEach((end) => {
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), this.brass);
        rivet.position.set(end * 0.13, s - 0.01, side * 0.016);
        hinge.add(rivet);
      });

      hinge.rotation.x = -side * this.closedAngle;
      g.add(hinge);
      return { hinge, side };
    });

    // Leather gussets closing the ends; they fold flat when the bag opens
    const gShape = new THREE.Shape();
    gShape.moveTo(-(W2 / 2 + 0.03), 0);
    gShape.lineTo(W2 / 2 + 0.03, 0);
    gShape.lineTo(0, ridge + 0.02);
    gShape.closePath();
    this.gussets = [-1, 1].map((end) => {
      const gm = add(new THREE.ShapeGeometry(gShape), new THREE.MeshLambertMaterial({ map: this.leather.map, side: THREE.DoubleSide }), end * (L / 2 + 0.005), H + 0.04, 0);
      gm.rotation.y = Math.PI / 2;
      return gm;
    });

    // End straps with brass buckles
    [-1, 1].forEach((end) => {
      add(new THREE.BoxGeometry(0.015, H + 0.02, 0.08), this.darkLeather, end * (L / 2 + 0.042), H / 2, 0);
      add(new THREE.BoxGeometry(0.02, 0.06, 0.1), this.brass, end * (L / 2 + 0.05), H * 0.62, 0);
    });

    // Brass feet
    [-1, 1].forEach((x) => [-1, 1].forEach((z) => {
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), this.brass, x * (L / 2 - 0.08), -0.04, z * (W1 / 2 - 0.06));
    }));

    // Brass name plate on the front
    const pc = makeCanvas(512, 128), pctx = pc.getContext("2d");
    pctx.fillStyle = "#c9a24a"; pctx.fillRect(0, 0, 512, 128);
    pctx.strokeStyle = "#8a6a22"; pctx.lineWidth = 8; pctx.strokeRect(6, 6, 500, 116);
    pctx.fillStyle = "#4a3410"; pctx.textAlign = "center"; pctx.textBaseline = "middle";
    pctx.font = `800 64px Georgia, 'Times New Roman', serif`;
    pctx.fillText("PROJECTS", 256, 68);
    const slope = Math.atan2((W1 - W2) / 2, H);
    const plateY = H * 0.55;
    const plateZ = W1 / 2 - ((W1 - W2) / 2) * (plateY / H) + 0.04;
    const plate = add(new THREE.PlaneGeometry(0.34, 0.085), new THREE.MeshLambertMaterial({ map: canvasTexture(pc), emissive: "#2a1e06" }), 0, plateY, plateZ);
    plate.rotation.x = -slope;

    g.position.y = 0.04;
    return g;
  },

  // Replace the cards with a new list of projects
  setProjects(projects) {
    this.cards.forEach((c) => c.el.remove());
    const n = projects.length;
    this.cards = projects.map((p, i) => {
      const canvas = makeCanvas(768, 480), tex = canvasTexture(canvas);
      drawProjectCard(canvas, p);
      const group = new THREE.Group();
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.625), basic({ map: tex }));
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.685), basic({ color: "#6e4122" }));
      back.position.z = -0.01;
      group.add(back, face);

      const el = document.createElement("a-entity");
      el.classList.add("clickable");
      el.addEventListener("loaded", () => {
        el.setObject3D("mesh", group);
        el.object3D.scale.setScalar(HIDDEN);
      }, { once: true });
      el.addEventListener("click", () => { if (!pointer.dragged) this.showDetail(p, el); });
      this.el.appendChild(el);

      // fanned out in an arc above the open bag, tilted toward the middle
      const t = n > 1 ? i / (n - 1) - 0.5 : 0;
      const spread = Math.min(3.4, 0.95 * n);
      const out = {
        pos: new THREE.Vector3(t * spread, 1.05 + (0.25 - Math.abs(t) * 0.5) * 0.6, 0.15 - Math.abs(t) * 0.5),
        rot: -t * 0.7,
        scale: 1,
      };
      // Home view: bigger, wider arc, pulled toward you
      const homeSpread = Math.min(5.6, 1.5 * n);
      const home = {
        pos: new THREE.Vector3(t * homeSpread, 1.35 + (0.25 - Math.abs(t)) * 0.5, 1.5 - Math.abs(t) * 1.4),
        rot: -t * 0.9,
        scale: 1.7,
      };
      const tucked = { pos: new THREE.Vector3(t * 0.6, 0.35, 0), rot: 0, scale: HIDDEN };
      return { el, out, home, tucked, delay: i * 0.09, p };
    });
  },

  setHome(on) {
    this.homeMode = on;
    if (on && !this.open) this.toggle();
    if (!on && this.open) this.toggle();
  },

  // Gold sparkles that trail the cards as they fly
  buildSparkles() {
    const N = 400;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.sparkles = {
      N, next: 0, geo,
      vel: new Float32Array(N * 3),
      life: new Float32Array(N),
      points: new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.07, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      })),
    };
    this.sparkles.points.frustumCulled = false;
    this.el.object3D.add(this.sparkles.points);
  },

  emitSparkle(pos, spread = 0.25) {
    const sp = this.sparkles, i = sp.next;
    sp.next = (i + 1) % sp.N;
    const P = sp.geo.attributes.position.array;
    P[i * 3] = pos.x + (Math.random() - 0.5) * spread;
    P[i * 3 + 1] = pos.y + (Math.random() - 0.5) * spread;
    P[i * 3 + 2] = pos.z + (Math.random() - 0.5) * spread;
    sp.vel[i * 3] = (Math.random() - 0.5) * 0.6;
    sp.vel[i * 3 + 1] = Math.random() * 0.5 + 0.1;
    sp.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    sp.life[i] = 1;
  },

  updateSparkles(step) {
    const sp = this.sparkles;
    const P = sp.geo.attributes.position.array, C = sp.geo.attributes.color.array;
    for (let i = 0; i < sp.N; i++) {
      if (sp.life[i] <= 0) { C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = 0; continue; }
      sp.life[i] -= step * 1.2;
      const a = Math.max(0, sp.life[i]);
      P[i * 3] += sp.vel[i * 3] * step;
      P[i * 3 + 1] += sp.vel[i * 3 + 1] * step;
      P[i * 3 + 2] += sp.vel[i * 3 + 2] * step;
      C[i * 3] = 1 * a; C[i * 3 + 1] = 0.82 * a; C[i * 3 + 2] = 0.35 * a;
    }
    sp.geo.attributes.position.needsUpdate = true;
    sp.geo.attributes.color.needsUpdate = true;
  },

  buildShadow() {
    const sc = makeCanvas(128, 128), sctx = sc.getContext("2d");
    const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, "rgba(40,25,10,0.35)");
    grad.addColorStop(1, "rgba(40,25,10,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.el.object3D.add(this.shadow);
  },

  toggle() {
    this.open = !this.open;
    this.openTime = this.el.sceneEl.time / 1000;
    if (!this.open) this.hideDetail();
  },

  tick(t, dt) {
    const sec = t / 1000, step = Math.min((dt || 16) / 1000, 0.05);
    const k = 1 - Math.exp(-step * 7);
    const o = this.el.object3D;

    // gentle float
    o.position.y = this.base.y + Math.sin(sec * 1.1) * 0.06;
    if (this.bag) this.bag.rotation.z = Math.sin(sec * 0.7) * 0.025;
    this.shadow.position.y = -o.position.y / o.scale.y + 0.02;
    const shadowScale = 1 - Math.sin(sec * 1.1) * 0.05;
    this.shadow.scale.set(shadowScale, shadowScale, 1);

    // jaws
    if (this.flaps) {
      this.flaps.forEach(({ hinge, side }) => {
        const target = this.open ? side * 1.15 : -side * this.closedAngle;
        hinge.rotation.x += (target - hinge.rotation.x) * k;
      });
      this.gussets.forEach((gm) => {
        gm.scale.y += ((this.open ? 0.02 : 1) - gm.scale.y) * k;
      });
    }

    // cards rise out one after another, and drop back in when closing
    const since = sec - this.openTime;
    this.cards.forEach((c) => {
      const co = c.el.object3D;
      if (!c.el.hasLoaded) return;
      const out = this.open && since > 0.25 + c.delay;
      const goal = out ? (this.homeMode ? c.home : c.out) : c.tucked;
      const before = co.position.clone();
      co.position.lerp(goal.pos, k);
      co.rotation.y += (goal.rot - co.rotation.y) * k;
      const s = co.scale.x + (goal.scale - co.scale.x) * k;
      co.scale.setScalar(s);
      co.visible = s > 0.01;
      // sparkle trail while a card is flying
      const speed = before.distanceTo(co.position) / step;
      if (out && speed > 0.4) for (let j = 0; j < (this.homeMode ? 3 : 1); j++) this.emitSparkle(co.position, 0.3 * s);
    });
    this.updateSparkles(step);
    this.animateDetail(sec);
  },

  // ── Project detail card ──────────────────────────────────
  showDetail(p, fromEl) {
    if (!this.detail) {
      const canvas = makeCanvas(1024, 1400), tex = canvasTexture(canvas);
      const el = document.createElement("a-entity");
      el.classList.add("clickable");
      el.addEventListener("loaded", () => el.setObject3D("mesh", new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.19), basic({ map: tex }))), { once: true });
      el.addEventListener("click", () => { if (!pointer.dragged) this.hideDetail(); });
      this.el.sceneEl.appendChild(el);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.25, 64),
        new THREE.MeshBasicMaterial({ color: "#ffd84a", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
      );
      this.el.sceneEl.object3D.add(ring);
      this.detail = { el, canvas, tex, ring };
    }
    drawProjectDetail(this.detail.canvas, p);
    this.detail.tex.needsUpdate = true;

    const cam = document.getElementById("cam").getObject3D("camera");
    const camPos = cam.getWorldPosition(new THREE.Vector3());
    const gaze = cam.getWorldDirection(new THREE.Vector3());
    const at = camPos.clone().addScaledVector(gaze, 2.4);
    const o = this.detail.el.object3D;
    const dummy = new THREE.Object3D();
    dummy.position.copy(at);
    dummy.lookAt(camPos.x, at.y, camPos.z);

    // start from the clicked card (or the bag) and zoom up to your view
    const source = (fromEl || this.bagEl).object3D;
    source.updateMatrixWorld();
    const fromPos = source.getWorldPosition(new THREE.Vector3());
    const fromQuat = source.getWorldQuaternion(new THREE.Quaternion());
    const fromScale = Math.max(0.15, source.getWorldScale(new THREE.Vector3()).x * 0.5);
    this.detailAnim = { t0: this.el.sceneEl.time / 1000, fromPos, fromQuat, fromScale, toPos: at, toQuat: dummy.quaternion.clone() };
    o.position.copy(fromPos);
    o.quaternion.copy(fromQuat);
    o.scale.setScalar(fromScale);
    o.visible = true;
    this.detailOpen = true;
    for (let i = 0; i < 40; i++) this.emitSparkle(this.el.object3D.worldToLocal(fromPos.clone()), 0.6);
  },

  animateDetail(sec) {
    const a = this.detailAnim;
    if (!a || !this.detail) return;
    const t = Math.min(1, (sec - a.t0) / 0.55);
    const e = 1 - Math.pow(1 - t, 3);                  // ease out
    const over = t < 1 ? 1 + Math.sin(t * Math.PI) * 0.06 : 1;   // slight overshoot as it lands
    const o = this.detail.el.object3D;
    o.position.lerpVectors(a.fromPos, a.toPos, e);
    o.quaternion.slerpQuaternions(a.fromQuat, a.toQuat, e);
    o.scale.setScalar((a.fromScale + (1 - a.fromScale) * e) * over);

    // glow ring that bursts behind the card as it arrives
    const ring = this.detail.ring;
    const rt = Math.min(1, Math.max(0, (sec - a.t0 - 0.25) / 0.7));
    ring.visible = rt > 0 && rt < 1;
    ring.position.copy(a.toPos);
    ring.quaternion.copy(a.toQuat);
    ring.translateZ(-0.05);
    ring.scale.setScalar(0.6 + rt * 1.6);
    ring.material.opacity = 0.7 * (1 - rt);
    if (t >= 1 && rt >= 1) this.detailAnim = null;
  },

  hideDetail() {
    if (!this.detailOpen) return false;
    this.detailAnim = null;
    this.detail.ring.visible = false;
    this.detail.el.object3D.visible = false;
    this.detail.el.object3D.scale.setScalar(HIDDEN);
    this.detailOpen = false;
    return true;
  },
});

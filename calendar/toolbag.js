// A floating 1960s leather tool bag that holds the projects.
// Click it to open: the frame jaws spread and a card for each project rises out.
// Click a card to bring that project's details up in front of you.
// Opening sends every project card flying to wherever you're looking, names facing you.
// While closed, the bag shakes now and then as gold fairies spark out of the seam.

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

// Leather patch with stitching and debossed lettering (pressed into the leather, lit from above)
function engravedPatch(text) {
  const W = 1024, H = 272, c = makeCanvas(W, H), ctx = c.getContext("2d");
  ctx.fillStyle = "#5e361b";
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 40); ctx.fill();
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(30,15,5,${Math.random() * 0.2})` : `rgba(150,100,60,${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  // raised edge + stitching
  ctx.strokeStyle = "rgba(25,12,4,0.55)";
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.roundRect(8, 8, W - 16, H - 16, 34); ctx.stroke();
  ctx.strokeStyle = "rgba(230,200,150,0.75)";
  ctx.lineWidth = 6;
  ctx.setLineDash([22, 16]);
  ctx.beginPath(); ctx.roundRect(34, 34, W - 68, H - 68, 22); ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 132px Georgia, 'Times New Roman', serif`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "18px";
  const x = W / 2 + 9, y = H / 2 + 8;
  ctx.fillStyle = "rgba(255,220,170,0.22)";   // light catching the lower lip of the cut
  ctx.fillText(text, x + 3, y + 4);
  ctx.fillStyle = "rgba(18,8,2,0.85)";        // the cut itself
  ctx.fillText(text, x, y);
  ctx.fillStyle = "rgba(0,0,0,0.35)";         // shadow inside the top edge
  ctx.fillText(text, x - 2, y - 3);
  return canvasTexture(c);
}

function glowTexture() {
  const c = makeCanvas(64, 64), ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,236,150,0.9)");
  g.addColorStop(1, "rgba(255,200,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function drawNewCard(canvas) {
  const ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#cfc7b5";
  ctx.lineWidth = 8;
  ctx.setLineDash([26, 18]);
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.setLineDash([]);
  ctx.fillStyle = "#2b59c3";
  ctx.textAlign = "center";
  ctx.font = `300 150px ${FONT}`;
  ctx.fillText("+", W / 2, H / 2 + 20);
  ctx.font = `700 46px ${FONT}`;
  ctx.fillText("New project", W / 2, H / 2 + 110);
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
    this.buildFairies();
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

    // "PROJECTS" stamped into a stitched leather patch on the front
    const slope = Math.atan2((W1 - W2) / 2, H);
    const plateY = H * 0.5;
    const plateZ = W1 / 2 - ((W1 - W2) / 2) * (plateY / H) + 0.052;
    const plate = add(new THREE.PlaneGeometry(0.56, 0.15), new THREE.MeshLambertMaterial({ map: engravedPatch("PROJECTS") }), 0, plateY, plateZ);
    plate.rotation.x = -slope;

    g.position.y = 0.04;
    return g;
  },

  // Replace the cards with a new list of projects (plus a "+ New project" card)
  setProjects(projects) {
    this.cards.forEach((c) => c.el.remove());
    const list = [...projects, null];
    this.cards = list.map((p, i) => {
      const canvas = makeCanvas(768, 480), tex = canvasTexture(canvas);
      if (p) drawProjectCard(canvas, p); else drawNewCard(canvas);
      const group = new THREE.Group();
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.625), basic({ map: tex }));
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.685), basic({ color: p ? "#6e4122" : "#b9b1a0" }));
      back.position.z = -0.01;
      group.add(back, face);

      const el = document.createElement("a-entity");
      el.classList.add("clickable");
      el.addEventListener("loaded", () => {
        el.setObject3D("mesh", group);
        el.object3D.scale.setScalar(HIDDEN);
      }, { once: true });
      el.addEventListener("click", () => {
        if (pointer.dragged) return;
        if (!p) return this.el.emit("project-new");
        // Editing needs a keyboard: outside VR open the editor, in VR show the read-only card
        if (this.el.sceneEl.is("vr-mode")) this.showDetail(p, el);
        else this.el.emit("project-open", { project: p });
      });
      this.el.appendChild(el);
      const t = list.length > 1 ? i / (list.length - 1) - 0.5 : 0;
      const tucked = { pos: new THREE.Vector3(t * 0.6, 0.35, 0), quat: new THREE.Quaternion(), scale: HIDDEN };
      return { el, p, tucked, present: tucked, delay: i * 0.08 };
    });
    if (this.open) this.layoutToViewer();
  },

  // Arrange the cards in rows across your current view, each turned to face you
  layoutToViewer() {
    const cam = document.getElementById("cam").getObject3D("camera");
    const camPos = cam.getWorldPosition(new THREE.Vector3());
    const gaze = cam.getWorldDirection(new THREE.Vector3());
    gaze.y = Math.max(-0.35, Math.min(0.35, gaze.y));
    gaze.normalize();
    const right = new THREE.Vector3().crossVectors(gaze, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, gaze).normalize();

    const n = this.cards.length;
    const cols = n <= 4 ? n : Math.min(4, Math.ceil(n / 2));
    const rows = Math.ceil(n / cols);
    const bag = this.el.object3D;
    bag.updateMatrixWorld();
    const toBag = bag.getWorldPosition(new THREE.Vector3()).distanceTo(camPos);
    const dist = Math.max(1.3, Math.min(3.0, toBag - 0.9));
    const f = dist / 3;                                  // shrink the layout when you're close
    const gapX = 1.32 * f, gapY = 0.98 * f;
    const bagQuatInv = bag.getWorldQuaternion(new THREE.Quaternion()).invert();
    const bagScale = bag.getWorldScale(new THREE.Vector3()).x;

    this.cards.forEach((c, i) => {
      const r = Math.floor(i / cols), col = i % cols;
      const inRow = r === rows - 1 ? n - r * cols : cols;
      const x = (col - (inRow - 1) / 2) * gapX;
      const y = ((rows - 1) / 2 - r) * gapY + 0.05;
      const world = camPos.clone()
        .addScaledVector(gaze, dist - (x * x * 0.08) / f)   // gentle curve toward you at the edges
        .addScaledVector(right, x)
        .addScaledVector(up, y);
      const dummy = new THREE.Object3D();
      dummy.position.copy(world);
      dummy.lookAt(camPos);
      c.present = {
        pos: bag.worldToLocal(world.clone()),
        quat: bagQuatInv.clone().multiply(dummy.quaternion),
        scale: (1.18 * f) / bagScale,
      };
    });
  },

  setHome(on) {
    this.homeMode = on;
    if (on && !this.open) this.toggle();
    if (!on && this.open) this.toggle();
  },

  // Tinker Bell–style fairies that flit around the bag
  buildFairies() {
    const tex = glowTexture();
    this.fairies = [0, 1, 2].map((i) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: "#ffb300", transparent: true, depthWrite: false, fog: false }));
      sprite.scale.setScalar(0.12);
      this.el.object3D.add(sprite);
      return { sprite, phase: i * 2.1, speed: 0.75 + i * 0.3 };
    });
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
        size: 0.08, map: glowTexture(), vertexColors: true, transparent: true, alphaTest: 0.02, depthWrite: false, fog: false,
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
      if (sp.life[i] <= 0) { P[i * 3 + 1] = -999; continue; }
      sp.life[i] -= step * 1.2;
      const a = Math.max(0, sp.life[i]);
      P[i * 3] += sp.vel[i * 3] * step;
      P[i * 3 + 1] += sp.vel[i * 3 + 1] * step;
      P[i * 3 + 2] += sp.vel[i * 3 + 2] * step;
      // gold fading back into the room's cream color
      C[i * 3] = 0.95 + 0.05 * a; C[i * 3 + 1] = 0.93 - 0.2 * a; C[i * 3 + 2] = 0.88 - 0.7 * a;
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
    if (this.open) {
      this.layoutToViewer();
      for (let i = 0; i < 60; i++) this.emitSparkle(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.62, 0), 0.2);
    } else {
      this.hideDetail();
    }
  },

  tick(t, dt) {
    const sec = t / 1000, step = Math.min((dt || 16) / 1000, 0.05);
    const k = 1 - Math.exp(-step * 7);
    const o = this.el.object3D;

    // gentle float, with a rattle every few seconds while closed (something's alive in there)
    o.position.y = this.base.y + Math.sin(sec * 1.1) * 0.06;
    const cycle = sec % 4.2;
    const rattle = !this.open && cycle < 0.9 ? Math.sin((cycle / 0.9) * Math.PI) : 0;
    if (this.bag) {
      this.bag.rotation.z = Math.sin(sec * 0.7) * 0.025 + rattle * Math.sin(sec * 38) * 0.07;
      this.bag.rotation.x = rattle * Math.sin(sec * 31) * 0.04;
      this.bag.position.x = rattle * Math.sin(sec * 45) * 0.012;
    }
    if (rattle > 0.3) for (let j = 0; j < 3; j++) this.emitSparkle(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.64, (Math.random() - 0.5) * 0.06), 0.04);

    this.fairies.forEach((f) => {
      const a = sec * f.speed + f.phase;
      f.sprite.position.set(Math.sin(a * 1.3) * 0.75, 0.6 + Math.sin(a * 2.1) * 0.22 + (this.open ? 0.4 : 0), Math.cos(a) * 0.45 + 0.1);
      f.sprite.scale.setScalar(0.08 + Math.abs(Math.sin(sec * 9 + f.phase)) * 0.06);
      if (Math.random() < 0.35) this.emitSparkle(f.sprite.position, 0.03);
    });
    this.shadow.position.y = -o.position.y / o.scale.y + 0.02;
    const shadowScale = 1 - Math.sin(sec * 1.1) * 0.05;
    this.shadow.scale.set(shadowScale, shadowScale, 1);

    // jaws
    if (this.flaps) {
      this.flaps.forEach(({ hinge, side }) => {
        const target = this.open ? side * 1.15 : -side * (this.closedAngle - rattle * 0.14);
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
      const goal = out ? c.present : c.tucked;
      const before = co.position.clone();
      co.position.lerp(goal.pos, k);
      co.quaternion.slerp(goal.quat, k);
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

// Touch controls shared by the 3D rooms: a thumb joystick + fly buttons (phones/tablets only)
// and two-finger pinch detection (any device with a touch screen).
//
//   const joy = TouchControls.joystick();            // { x, y, fly } — x right, y forward, fly up/down; all -1..1
//   TouchControls.pinch(canvas, { onStart, onChange(ratio), onEnd });
//   TouchControls.pinching()                          // true while two fingers are down

(function () {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const css = `
  .tc-joy { position: fixed; left: 20px; bottom: 84px; width: 128px; height: 128px; z-index: 15; border-radius: 50%;
    background: rgba(255,253,248,.55); border: 2px solid rgba(160,150,130,.45); backdrop-filter: blur(4px); touch-action: none; }
  .tc-knob { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%;
    background: rgba(43,89,195,.85); box-shadow: 0 4px 14px rgba(0,0,0,.25); pointer-events: none; }
  .tc-fly { position: fixed; left: 160px; bottom: 96px; z-index: 15; display: flex; flex-direction: column; gap: 10px; }
  .tc-fly button { width: 48px; height: 48px; border-radius: 50%; border: 2px solid rgba(160,150,130,.45);
    background: rgba(255,253,248,.7); font-size: 1.1rem; color: #1b1b1a; touch-action: none; }
  .tc-fly button:active { background: rgba(43,89,195,.85); color: #fff; }`;

  let pinchState = null;

  function joystick() {
    const state = { x: 0, y: 0, fly: 0 };
    if (!coarse) return state;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const base = document.createElement("div");
    base.className = "tc-joy";
    base.setAttribute("aria-label", "Move");
    base.innerHTML = `<div class="tc-knob"></div>`;
    document.body.appendChild(base);
    const knob = base.firstElementChild;
    let id = null;
    const R = 46;
    const move = (e) => {
      const r = base.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      state.x = dx / R;
      state.y = -dy / R;
    };
    const end = () => { id = null; state.x = state.y = 0; knob.style.transform = ""; };
    base.addEventListener("pointerdown", (e) => { id = e.pointerId; base.setPointerCapture(id); move(e); e.preventDefault(); });
    base.addEventListener("pointermove", (e) => { if (e.pointerId === id) move(e); });
    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);

    const fly = document.createElement("div");
    fly.className = "tc-fly";
    fly.innerHTML = `<button type="button" aria-label="Fly up">▲</button><button type="button" aria-label="Fly down">▼</button>`;
    document.body.appendChild(fly);
    const [up, down] = fly.querySelectorAll("button");
    const hold = (btn, v) => {
      btn.addEventListener("pointerdown", (e) => { state.fly = v; btn.setPointerCapture(e.pointerId); e.preventDefault(); });
      btn.addEventListener("pointerup", () => { state.fly = 0; });
      btn.addEventListener("pointercancel", () => { state.fly = 0; });
    };
    hold(up, 1);
    hold(down, -1);
    return state;
  }

  function pinch(canvas, { onStart, onChange, onEnd }) {
    const pts = new Map();
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { pinchState = { d0: dist() }; if (onStart) onStart(); }
    });
    window.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinchState && pts.size === 2) onChange(dist() / pinchState.d0);
    });
    const up = (e) => {
      if (!pts.delete(e.pointerId)) return;
      if (pinchState && pts.size < 2) { pinchState = null; if (onEnd) onEnd(); }
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  window.TouchControls = { joystick, pinch, pinching: () => !!pinchState, coarse };
})();

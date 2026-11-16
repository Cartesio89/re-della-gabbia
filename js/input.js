// Controls: a digital 8-way stick on the left, three buttons on the right. Keyboard: arrows/WASD + J K L (or Z X C).
export function createInput(stick, knob, buttons) {
  const st = { sx: 0, sy: 0, a: false, b: false, c: false };
  const keys = new Set();
  let touchId = null;

  function setStick(cx, cy) {
    const r = stick.getBoundingClientRect(), dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy);
    if (dist < r.width * 0.14) { st.sx = st.sy = 0; knob.style.transform = "translate(-50%, -50%)"; return; }
    const oct = Math.round(Math.atan2(-dy, dx) / (Math.PI / 4));      // snap to 8 directions
    const ang = oct * Math.PI / 4;
    st.sx = Math.round(Math.cos(ang)); st.sy = Math.round(Math.sin(ang));
    const k = r.width * 0.28;
    knob.style.transform = `translate(calc(-50% + ${Math.cos(ang) * k}px), calc(-50% + ${-Math.sin(ang) * k}px))`;
  }
  stick.addEventListener("pointerdown", (e) => { touchId = e.pointerId; stick.setPointerCapture(e.pointerId); setStick(e.clientX, e.clientY); e.preventDefault(); });
  stick.addEventListener("pointermove", (e) => { if (e.pointerId === touchId) setStick(e.clientX, e.clientY); });
  const up = (e) => { if (e.pointerId === touchId) { touchId = null; st.sx = st.sy = 0; knob.style.transform = "translate(-50%, -50%)"; } };
  stick.addEventListener("pointerup", up); stick.addEventListener("pointercancel", up);

  for (const k of ["a", "b", "c"]) {
    buttons[k].addEventListener("pointerdown", (e) => { st[k] = true; buttons[k].classList.add("on"); e.preventDefault(); });
    const off = () => buttons[k].classList.remove("on");
    buttons[k].addEventListener("pointerup", off); buttons[k].addEventListener("pointercancel", off); buttons[k].addEventListener("pointerleave", off);
  }

  const KEY = { KeyJ: "a", KeyZ: "a", KeyK: "b", KeyX: "b", KeyL: "c", KeyC: "c" };
  const DIR = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1] };
  addEventListener("keydown", (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (KEY[e.code] && !e.repeat) st[KEY[e.code]] = true;
    if (DIR[e.code]) { keys.add(e.code); e.preventDefault(); }
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());

  return {
    // direction on the screen (right, up) and the buttons pressed since the last call
    read() {
      let sx = st.sx, sy = st.sy;
      for (const k of keys) { sx += DIR[k][0]; sy += DIR[k][1]; }
      const out = { sx: Math.sign(sx), sy: Math.sign(sy), a: st.a, b: st.b, c: st.c };
      st.a = st.b = st.c = false;
      return out;
    },
    clear() { st.a = st.b = st.c = false; }
  };
}

// ---- tiny sound effects, synthesised
let ac = null;
function tone(freq, dur, type = "square", vol = 0.06, slide = 0) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
  } catch (e) { /* no audio: play silent */ }
}
export const sfx = {
  kick: () => tone(160, 0.09, "triangle", 0.12, -90),
  wall: () => tone(520, 0.05, "square", 0.03, -200),
  whistle: () => { tone(2100, 0.25, "sine", 0.05); },
  goal: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, "square", 0.06), i * 110)); },
  trick: () => tone(880, 0.12, "sine", 0.06, 500),
  fail: () => tone(200, 0.2, "sawtooth", 0.05, -120),
  tackle: () => tone(110, 0.1, "sawtooth", 0.08, -50),
  coin: () => { tone(990, 0.08, "square", 0.05); setTimeout(() => tone(1320, 0.14, "square", 0.05), 80); }
};

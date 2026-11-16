// Three.js scene: the cage, the six players, the ball and the two cameras (side view on wide screens,
// behind your own goal on tall phones). Reads the match state, never changes it.
import * as THREE from "three";
import { F } from "./engine.js";

const LOOKS = [["#f1c9a5", "#2a1b12"], ["#c98f62", "#101010"], ["#8a5a3c", "#0c0c0c"], ["#f6d7bd", "#b98a3a"], ["#e0b089", "#5a2d16"], ["#6b4530", "#1a1a1a"]];

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const fenceTex = (color) => {
  const t = canvasTex(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64); g.strokeStyle = color; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
};

function buildPlayer(kit, look) {
  const [skin, hair] = LOOKS[look % LOOKS.length];
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const box = (w, h, d, c, x, y, z, parent = body) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); parent.add(m); return m; };
  box(0.3, 0.52, 0.5, kit, 0, 1.12, 0);                       // shirt
  box(0.31, 0.2, 0.51, "#1b1c24", 0, 0.78, 0);                // shorts
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mat(skin)); head.position.set(0, 1.56, 0); body.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hair)); cap.position.set(-0.02, 1.58, 0); body.add(cap);
  const limb = (y, z, len, c, shoe) => {
    const piv = new THREE.Group(); piv.position.set(0, y, z); body.add(piv);
    box(0.15, len, 0.15, c, 0, -len / 2, 0, piv);
    if (shoe) box(0.3, 0.1, 0.16, "#f4f4f4", 0.07, -len - 0.03, 0, piv);
    return piv;
  };
  const legL = limb(0.7, -0.13, 0.62, skin, true), legR = limb(0.7, 0.13, 0.62, skin, true);
  const armL = limb(1.34, -0.32, 0.5, skin), armR = limb(1.34, 0.32, 0.5, skin);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; g.add(shadow);
  return { g, body, legL, legR, armL, armR, shadow };
}

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#1a1f47"); gr.addColorStop(0.55, "#6a3f6e"); gr.addColorStop(1, "#f08a4b"); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(0x5a3a5e, 45, 110);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xffe2c4, 0x2a2440, 1.5));
  const sun = new THREE.DirectionalLight(0xffc58a, 1.6); sun.position.set(-8, 14, 9); scene.add(sun);

  // ground and court
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ color: 0x23222b }));
  asphalt.rotation.x = -Math.PI / 2; asphalt.position.y = -0.02; scene.add(asphalt);
  const courtTex = canvasTex(1024, 608, (g, w, h) => {
    g.fillStyle = "#24507c"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    const sx = w / (F.HL * 2), sz = h / (F.HW * 2);
    g.strokeStyle = "#fff4e2"; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.beginPath(); g.moveTo(w / 2, 6); g.lineTo(w / 2, h - 6); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 2.2 * sx, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#e0703a";
    for (const side of [0, 1]) {
      const x0 = side ? w : 0;
      g.beginPath(); g.ellipse(x0, h / 2, 3.4 * sx, 3.4 * sz, 0, 0, Math.PI * 2); g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; g.stroke();
    }
    g.fillStyle = "#fff4e2"; g.beginPath(); g.arc(w / 2, h / 2, 9, 0, Math.PI * 2); g.fill();
  });
  const court = new THREE.Mesh(new THREE.PlaneGeometry(F.HL * 2, F.HW * 2), new THREE.MeshLambertMaterial({ map: courtTex }));
  court.rotation.x = -Math.PI / 2; scene.add(court);

  // cage walls: wire panels, posts and rails. Each wall remembers which way it faces so the one in front of the camera can fade out.
  const walls = [];
  const wire = fenceTex("#c9ccd6");
  const panel = (w, h, x, y, z, ry, key) => {
    const tex = wire.clone(); tex.needsUpdate = true; tex.repeat.set(w / 0.5, h / 0.5);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.9 }));
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); walls.push({ m, key }); return m;
  };
  const H = F.ROOF, steel = new THREE.MeshLambertMaterial({ color: 0x5c6070 });
  const bar = (w, h, d, x, y, z, key) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steel.clone()); m.material.transparent = true; m.position.set(x, y, z); scene.add(m); if (key) walls.push({ m, key, solid: true }); return m; };
  for (const s of [-1, 1]) {
    panel(F.HL * 2, H, 0, H / 2, s * F.HW, 0, "z" + s);
    bar(F.HL * 2, 0.1, 0.1, 0, H, s * F.HW, "z" + s); bar(F.HL * 2, 0.22, 0.08, 0, 0.11, s * F.HW, "z" + s);
    for (let x = -F.HL; x <= F.HL + 0.01; x += F.HL / 2) bar(0.12, H, 0.12, x, H / 2, s * F.HW, Math.abs(x) > F.HL - 0.1 ? null : "z" + s);
    // end walls, with the hole for the goal
    const wSide = F.HW - F.GW;
    panel(wSide, H, s * F.HL, H / 2, -(F.GW + wSide / 2), Math.PI / 2, "x" + s);
    panel(wSide, H, s * F.HL, H / 2, F.GW + wSide / 2, Math.PI / 2, "x" + s);
    panel(F.GW * 2, H - F.GH, s * F.HL, F.GH + (H - F.GH) / 2, 0, Math.PI / 2, "x" + s);
    bar(0.1, 0.1, F.HW * 2, s * F.HL, H, 0, "x" + s);
    // goal: frame and net
    const frame = new THREE.MeshLambertMaterial({ color: 0xfff4e2 });
    const fb = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frame); m.position.set(x, y, z); scene.add(m); };
    fb(0.12, F.GH, 0.12, s * F.HL, F.GH / 2, -F.GW); fb(0.12, F.GH, 0.12, s * F.HL, F.GH / 2, F.GW); fb(0.12, 0.12, F.GW * 2 + 0.12, s * F.HL, F.GH, 0);
    const net = fenceTex("#ffffff"), nm = (w, h, x, y, z, rx, ry) => {
      const t = net.clone(); t.needsUpdate = true; t.repeat.set(w / 0.25, h / 0.25);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.75 }));
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0); scene.add(m);
    };
    nm(F.GW * 2, F.GH, s * (F.HL + 0.9), F.GH / 2, 0, 0, Math.PI / 2);
    nm(0.9, F.GH, s * (F.HL + 0.45), F.GH / 2, -F.GW, 0, 0); nm(0.9, F.GH, s * (F.HL + 0.45), F.GH / 2, F.GW, 0, 0);
    nm(F.GW * 2, 0.9, s * (F.HL + 0.45), F.GH, 0, Math.PI / 2, Math.PI / 2);
  }

  // neighbourhood: blocks of flats with lit windows, street lamps
  const winTex = (base) => canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 16) for (let x = 6; x < w - 8; x += 14) { g.fillStyle = Math.random() < 0.4 ? "#ffd58a" : "#1c1b26"; g.fillRect(x, y, 8, 10); }
  });
  const blocks = [[-24, -24, 12, 16, 10, "#4a3f52"], [-8, -27, 13, 22, 9, "#56465a"], [9, -26, 12, 14, 9, "#3f3a50"], [25, -23, 11, 19, 10, "#514456"],
    [-30, 4, 9, 13, 14, "#463c4e"], [30, 2, 9, 17, 14, "#4d4055"], [-22, 27, 14, 12, 9, "#3d3648"], [20, 28, 15, 15, 9, "#4a3f52"], [0, 32, 12, 18, 8, "#56465a"]];
  for (const [x, z, w, h, d, c] of blocks) {
    const t = winTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.round(w / 4), Math.round(h / 8));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ map: t })); m.position.set(x, h / 2, z); scene.add(m);
  }
  for (const [x, z] of [[-13, -9], [13, -9], [-13, 9], [13, 9]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 6.5, 8), steel); post.position.set(x, 3.25, z); scene.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9b0 })); lamp.position.set(x * 0.94, 6.5, z * 0.94); scene.add(lamp);
  }

  // ball
  const ballTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = "#fafafa"; g.fillRect(0, 0, w, h); g.fillStyle = "#15151a"; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc((i * 37 + 12) % w, (i * 23 + 10) % h, 7, 0, Math.PI * 2); g.fill(); } });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), new THREE.MeshLambertMaterial({ map: ballTex })); scene.add(ball);
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);

  // markers under the controlled players
  const ring = (color) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.visible = false; scene.add(m); return m; };
  const rings = [ring(0xffffff), ring(0xffffff)];
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); arrow.rotation.x = Math.PI; arrow.visible = false; scene.add(arrow);

  let figs = [], portrait = false, side = 0, camX = 0, mode = "menu", orbit = 0;

  function setTeams(teams) {
    for (const f of figs) scene.remove(f.g);
    figs = [];
    teams.forEach((t) => t.players.slice(0, 3).forEach((p) => { const f = buildPlayer(t.kit, p.look ?? 0); scene.add(f.g); figs.push(f); }));
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; portrait = w / h < 1; camera.fov = portrait ? 58 : 42; camera.updateProjectionMatrix();
  }

  // joystick direction on the screen (right, up) -> direction on the field
  function screenToWorld(sx, sy) {
    if (!portrait) return { dx: sx, dz: -sy };
    const d = side === 0 ? 1 : -1; return { dx: d * sy, dz: d * sx };
  }

  function pose(f, p, m, t) {
    const a = p.act, sp = Math.hypot(p.vx, p.vz);
    let y = 0, tilt = 0, roll = 0, spin = 0, sw = Math.sin(p.run * 2.7) * Math.min(1, sp / 4) * 0.95, arms = -sw * 0.8, lL = sw, lR = -sw;
    if (a) {
      const k = Math.min(1, a.t / a.dur);
      if (a.type === "slide") { tilt = 1.15; y = -0.35; lL = -1.3; lR = -0.9; arms = 1.2; }
      else if (a.type === "tackle") { tilt = -0.35; lR = -1.1 * Math.sin(Math.PI * k); }
      else if (a.type === "down") { tilt = 1.45; y = -0.45; lL = lR = -0.2; }
      else if (a.type === "stun") { roll = Math.sin(t * 22) * 0.22; tilt = 0.18; }
      else if (a.type === "kick") { lR = -1.5 * Math.sin(Math.PI * k); tilt = 0.12; }
      else if (a.type === "trick") {
        const an = a.tr.anim; spin = k * an.spin * Math.PI * 2; y = Math.sin(Math.PI * k) * (an.hop + (an.arc ? 0.12 : 0));
        lL = Math.sin(k * Math.PI * 2 * a.tr.len) * 1.1; lR = -lL; arms = Math.cos(k * Math.PI * 2) * 0.9;
      }
    }
    if (m.phase === "goal" && p.team === m.lastScorer) { y = Math.abs(Math.sin(t * 7 + p.i)) * 0.35; arms = 2.7; }
    f.g.position.set(p.x, 0, p.z); f.g.rotation.y = -p.face - spin;
    f.body.position.y = y; f.body.rotation.z = tilt; f.body.rotation.x = roll;
    f.legL.rotation.z = lL; f.legR.rotation.z = lR; f.armL.rotation.z = arms; f.armR.rotation.z = -arms;
    if (m.phase === "goal" && p.team === m.lastScorer) f.armL.rotation.z = f.armR.rotation.z = 2.7;
    f.shadow.scale.setScalar(1 - Math.min(0.4, y));
  }

  function sync(m, dt, t, me) {
    side = me ?? 0;
    for (const p of m.players) if (figs[p.i]) pose(figs[p.i], p, m, t);
    const b = m.ball; let bx = b.x, by = b.y, bz = b.z;
    if (b.owner >= 0) {
      const p = m.players[b.owner], a = p.act;
      if (a && a.type === "trick") {
        const k = Math.min(1, a.t / a.dur), an = a.tr.anim;
        by += Math.sin(Math.PI * k) * an.arc;
        if (an.orbit) { const ang = -p.face + k * Math.PI * 2 * an.orbit; bx = p.x + Math.cos(ang) * 0.55; bz = p.z - Math.sin(ang) * 0.55; by += 0.45; }
      }
    }
    ball.position.set(bx, by + 0.115, bz); ball.rotation.z = -b.spin; ball.rotation.x = b.spin * 0.3;
    ballShadow.position.set(bx, 0.02, bz); ballShadow.scale.setScalar(Math.max(0.4, 1 - by * 0.15));
    for (const team of [0, 1]) {
      const r = rings[team]; r.visible = m.human[team] && (me === undefined || me === team);
      if (r.visible) {
        const p = m.players[m.ctrl[team]]; r.position.x = p.x; r.position.z = p.z; r.scale.setScalar(1 + Math.sin(t * 6) * 0.06);
        arrow.visible = true; arrow.position.set(p.x, 2.15 + Math.sin(t * 5) * 0.06, p.z);
      }
    }
    // camera
    const d = side === 0 ? 1 : -1;
    if (portrait) {
      camX += (b.x * 0.75 - camX) * Math.min(1, dt * 3);
      camera.position.set(camX - d * 13, 12.5, 0); camera.lookAt(camX - d * 1.2, 0, 0);
    } else {
      camX += (b.x * 0.72 - camX) * Math.min(1, dt * 3);
      camera.position.set(camX, 9.6, F.HW + 9.2); camera.lookAt(camX, 0.5, 0.2);
    }
    fade(portrait ? "x" + -d : "z1");
  }

  function fade(key) { for (const w of walls) { const hide = w.key === key; w.m.material.opacity = hide ? (w.solid ? 0.12 : 0.1) : (w.solid ? 1 : 0.9); } }

  // menu backdrop: slow orbit around the empty cage, with the line-up standing at the centre
  function showcase(dt, t) {
    orbit += dt * 0.12;
    const r = portrait ? 30 : 23;
    camera.position.set(Math.cos(orbit) * r, 9.5, Math.sin(orbit) * r); camera.lookAt(0, 1.2, 0);
    fade(null); for (const w of walls) if (!w.solid) w.m.material.opacity = 0.55;
    figs.forEach((f, i) => {
      f.g.position.set((i - (figs.length - 1) / 2) * 1.4, 0, 0); f.g.rotation.y = -orbit + Math.PI + 1.2;
      f.body.position.y = Math.abs(Math.sin(t * 2 + i)) * 0.05; f.body.rotation.set(0, 0, 0);
      f.legL.rotation.z = f.legR.rotation.z = 0; f.armL.rotation.z = Math.sin(t * 2 + i) * 0.1; f.armR.rotation.z = -f.armL.rotation.z;
    });
    ball.position.set(0, 0.115 + Math.abs(Math.sin(t * 3)) * 0.6, 1); ballShadow.position.set(0, 0.02, 1);
    rings.forEach((r) => { r.visible = false; }); arrow.visible = false;
  }

  return {
    setTeams, resize, sync, showcase, screenToWorld,
    render: () => renderer.render(scene, camera),
    get portrait() { return portrait; }, setMode: (v) => { mode = v; }, get mode() { return mode; }
  };
}

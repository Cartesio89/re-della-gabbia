// Live match between two phones. The host runs the real simulation; the guest sends its controls and
// draws the snapshots it receives (moving things forward by their speed between one snapshot and the next).
import { openChannel } from "./net.js";
import { trickFor } from "./data.js";

const ACT = ["", "tackle", "slide", "down", "stun", "trick", "kick"];
const r2 = (v) => Math.round(v * 100) / 100;

export function encode(m, events) {
  return {
    p: m.players.map((p) => [r2(p.x), r2(p.z), r2(p.face), r2(p.vx), r2(p.vz), p.act ? ACT.indexOf(p.act.type) : 0, p.act ? r2(p.act.t) : 0, p.act ? r2(p.act.dur) : 0, p.act && p.act.tr ? p.act.tr.key : ""]),
    b: [r2(m.ball.x), r2(m.ball.y), r2(m.ball.z), r2(m.ball.vx), r2(m.ball.vy), r2(m.ball.vz), m.ball.owner],
    s: m.score, c: r2(m.clock), ph: m.phase, ls: m.lastScorer, ct: m.ctrl, g: m.golden ? 1 : 0,
    tk: [m.trick[1].on ? 1 : 0, m.trick[1].seq.join("")], st: m.tricks, e: events
  };
}

export function ghostMatch(teams) {
  const m = {
    t: 0, clock: 120, golden: false, score: [0, 0], phase: "kickoff", lastScorer: -1, teams, human: [true, true], ctrl: [0, 3],
    trick: [{ on: false, seq: [] }, { on: false, seq: [] }], tricks: [0, 0], style: [0, 0],
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, spin: 0 }, players: [], events: []
  };
  teams.forEach((t, team) => t.players.slice(0, 3).forEach((pl, slot) => m.players.push({ i: team * 3 + slot, team, slot, ...pl, x: 0, z: 0, vx: 0, vz: 0, face: 0, run: 0, act: null })));
  return m;
}

export function applySnapshot(m, s) {
  s.p.forEach((a, i) => {
    const p = m.players[i];
    p.x = a[0]; p.z = a[1]; p.face = a[2]; p.vx = a[3]; p.vz = a[4];
    if (!a[5]) p.act = null;
    else {
      const type = ACT[a[5]];
      if (!p.act || p.act.type !== type || (a[8] && (!p.act.tr || p.act.tr.key !== a[8]))) p.act = { type, t: a[6], dur: a[7], tr: a[8] ? trickFor(a[8].split("")) : null };
      else { p.act.t = a[6]; p.act.dur = a[7]; }
    }
  });
  const b = m.ball; [b.x, b.y, b.z, b.vx, b.vy, b.vz, b.owner] = s.b;
  m.score = s.s; m.clock = s.c; m.phase = s.ph; m.lastScorer = s.ls; m.ctrl = s.ct; m.golden = !!s.g; m.tricks = s.st;
  m.trick[1].on = !!s.tk[0]; m.trick[1].seq = s.tk[1].split("").filter(Boolean);
  for (const e of s.e || []) m.events.push(e);
}

export function extrapolate(m, dt) {
  m.t += dt;
  for (const p of m.players) {
    p.x += p.vx * dt; p.z += p.vz * dt; p.run += Math.hypot(p.vx, p.vz) * dt;
    if (p.act) p.act.t = Math.min(p.act.dur, p.act.t + dt);
  }
  const b = m.ball;
  if (b.owner >= 0) { const p = m.players[b.owner]; b.x = p.x + Math.cos(p.face) * 0.55; b.z = p.z + Math.sin(p.face) * 0.55; b.y = 0; }
  else { b.x += b.vx * dt; b.z += b.vz * dt; b.y = Math.max(0, b.y + b.vy * dt); b.vy -= 22 * dt; }
  b.spin += Math.hypot(b.vx, b.vz) * dt * 4;
}

export const roomCode = () => Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join("");

// Opens the room and resolves the handshake. `me` = { name, team }. Calls back with the opponent when both are in.
export async function openRoom(code, role, me, onReady, onGone) {
  const ch = await openChannel("room-" + code.toUpperCase(), role + "-" + me.name);
  let peer = null, started = false, helloTimer = null;
  const room = { ch, role, peer: null, close() { clearInterval(helloTimer); ch.close(); } };
  if (role === "host") {
    ch.on("hello", (msg) => {
      if (!peer) { peer = { name: msg.name, team: msg.team }; room.peer = peer; }
      ch.send("start", { name: me.name, team: me.team });
      if (!started) { started = true; onReady(peer, room); }
    });
  } else {
    ch.on("start", (msg) => {
      if (started) return;
      started = true; clearInterval(helloTimer); peer = { name: msg.name, team: msg.team }; room.peer = peer; onReady(peer, room);
    });
  }
  ch.onPresence((list) => {
    if (started && peer && !list.some((x) => x.name === peer.name)) onGone();
  });
  const ok = await ch.subscribe();
  if (!ok) { ch.close(); return null; }
  ch.track({ name: me.name, role });
  if (role === "guest") {
    const hello = () => ch.send("hello", { name: me.name, team: me.team });
    hello(); helloTimer = setInterval(hello, 1000);
  }
  return room;
}

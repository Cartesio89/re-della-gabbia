// Match simulation, with no rendering and no DOM: the same code runs in the browser and in the Node tests.
// Field on the x/z plane, team 0 attacks +x, team 1 attacks -x. The cage is closed: the ball bounces on every wall.
import { trickFor, MATCH_SECONDS } from "./data.js";

export const F = { HL: 11, HW: 6.5, GW: 1.25, GH: 1.7, ROOF: 4.2 };
const PR = 0.38;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hyp = Math.hypot;
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.5 * 0.577;
export const dirOf = (team) => (team === 0 ? 1 : -1);
const SYM = { a: "T", b: "P", c: "N" };

export function createMatch(cfg) {
  const m = {
    t: 0, clock: cfg.seconds ?? MATCH_SECONDS, golden: false, allowGolden: !!cfg.golden,
    score: [0, 0], phase: "kickoff", phaseT: 1.6, lastScorer: -1,
    teams: cfg.teams.map((t) => ({ name: t.name, ai: t.ai ?? 0.55, kit: t.kit, human: !!t.human })),
    human: cfg.teams.map((t) => !!t.human),
    ctrl: [0, 3], switchT: [0, 0],
    trick: [{ on: false, seq: [], timer: 0 }, { on: false, seq: [], timer: 0 }],
    style: [0, 0], tricks: [0, 0],
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, lastTeam: 0, passTo: -1, noPick: -1, noPickT: 0, spin: 0 },
    players: [], events: []
  };
  cfg.teams.forEach((t, team) => t.players.slice(0, 3).forEach((pl, slot) => m.players.push({
    i: team * 3 + slot, team, slot, name: pl.name, num: pl.num ?? slot + 1, look: pl.look ?? 0,
    prec: pl.prec, vel: pl.vel, skill: pl.skill,
    x: 0, z: 0, vx: 0, vz: 0, face: team === 0 ? 0 : Math.PI, run: 0, act: null, cool: 0, think: Math.random() * 0.3, invuln: 0
  })));
  kickoff(m, Math.random() < 0.5 ? 0 : 1);
  return m;
}

function ev(m, type, data) { m.events.push({ type, ...data }); }

function kickoff(m, team) {
  const spots = [[-1.4, 0], [-4.8, -3], [-6.8, 2.6]];
  for (const p of m.players) {
    const d = dirOf(p.team), s = spots[p.slot];
    p.x = s[0] * d; p.z = s[1] * d; p.vx = p.vz = 0; p.face = d > 0 ? 0 : Math.PI; p.act = null; p.cool = 0; p.invuln = 0;
  }
  const k = m.players[team * 3];
  k.x = -0.55 * dirOf(team); k.z = 0;
  const b = m.ball;
  Object.assign(b, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: k.i, lastTeam: team, passTo: -1, noPick: -1, noPickT: 0 });
  m.ctrl = [0, 3]; m.ctrl[team] = k.i;
  m.trick.forEach((t) => { t.on = false; t.seq = []; });
  m.phase = "kickoff"; m.phaseT = 1.3;
}

const maxSpeed = (p) => 4.6 + 2.5 * p.vel / 99;
const busy = (p) => p.act && (p.act.type === "tackle" || p.act.type === "slide" || p.act.type === "down" || p.act.type === "stun" || p.act.type === "trick");
const out = (p) => p.act && (p.act.type === "down" || p.act.type === "stun");

function loseBall(m, p, vx, vz, vy = 0) {
  const b = m.ball;
  b.owner = -1; b.vx = vx; b.vz = vz; b.vy = vy; b.passTo = -1; b.noPick = p.i; b.noPickT = 0.4; b.lastTeam = p.team;
  m.trick[p.team].on = false;
}

function shoot(m, p, aimZ) {
  const b = m.ball, d = dirOf(p.team);
  const tx = d * F.HL, tz = aimZ ?? (Math.random() - 0.5) * 1.5;
  const ang = Math.atan2(tz - b.z, tx - b.x) + gauss() * (0.045 + (1 - p.prec / 99) * 0.16);
  const sp = 15 + 5 * (p.prec + p.vel) / 198;
  p.face = ang; p.act = { type: "kick", t: 0, dur: 0.28 };
  loseBall(m, p, Math.cos(ang) * sp, Math.sin(ang) * sp, 1.2 + Math.random() * 2.6);
  ev(m, "shot", { team: p.team });
}

function pass(m, p, mate) {
  const b = m.ball;
  const tx = mate.x + mate.vx * 0.3, tz = mate.z + mate.vz * 0.3;
  const dist = hyp(tx - b.x, tz - b.z);
  const ang = Math.atan2(tz - b.z, tx - b.x) + gauss() * (0.02 + (1 - p.prec / 99) * 0.12);
  const sp = clamp(7 + dist * 1.15, 8, 17);
  p.face = ang; p.act = { type: "kick", t: 0, dur: 0.22 };
  loseBall(m, p, Math.cos(ang) * sp, Math.sin(ang) * sp, dist > 7 ? 2.5 : 0.4);
  b.passTo = mate.i;
  if (m.human[p.team]) { m.ctrl[p.team] = mate.i; m.switchT[p.team] = 0.6; }
  ev(m, "pass", { team: p.team });
}

function startTrick(m, p, seq) {
  const tr = trickFor(seq), b = m.ball;
  const ok = Math.random() < clamp(0.5 + p.skill / 100 * 0.75 - 0.11 * tr.len, 0.08, 0.97);
  const dx = Math.cos(p.face), dz = Math.sin(p.face);
  if (!ok) {
    loseBall(m, p, dx * 3 + (Math.random() - 0.5) * 3, dz * 3 + (Math.random() - 0.5) * 3, 1.5);
    p.act = { type: "stun", t: 0, dur: 0.45 };
    ev(m, "trick", { team: p.team, name: tr.name, kind: tr.kind, ok: false, beaten: 0, key: tr.key });
    return;
  }
  // side-step away from the nearest defender in front
  let side = Math.random() < 0.5 ? 1 : -1, best = 1e9, beaten = 0;
  for (const o of m.players) {
    if (o.team === p.team || out(o)) continue;
    const rx = o.x - p.x, rz = o.z - p.z, dist = hyp(rx, rz);
    if (dist < best && rx * dx + rz * dz > -0.3) { best = dist; side = (rx * -dz + rz * dx) > 0 ? -1 : 1; }
    if (tr.kind === "dribble" && dist < 1.3 + 0.25 * tr.len && rx * dx + rz * dz > -0.3 * dist) {
      o.act = { type: "stun", t: 0, dur: (0.35 + 0.1 * tr.len) * (1.2 - o.skill / 140) }; o.vx *= 0.2; o.vz *= 0.2; beaten++;
    }
  }
  p.act = { type: "trick", t: 0, dur: tr.dur, tr, dx, dz, side };
  if (tr.kind === "dribble") p.invuln = tr.dur + 0.1;
  m.tricks[p.team]++; m.style[p.team] += tr.kind === "show" ? tr.len * 3 : tr.len + beaten * 2;
  ev(m, "trick", { team: p.team, name: tr.name, kind: tr.kind, ok: true, beaten, key: tr.key });
}

function startTackle(p, slide) {
  p.act = { type: slide ? "slide" : "tackle", t: 0, dur: slide ? 0.55 : 0.3, hit: false };
  const sp = slide ? 10 : 7.5;
  p.vx = Math.cos(p.face) * sp; p.vz = Math.sin(p.face) * sp;
}

function resolveTackle(m, p) {
  const a = p.act, b = m.ball, slide = a.type === "slide";
  if (a.hit) return;
  if (b.owner < 0) {
    if (slide && b.y < 0.6 && hyp(b.x - p.x, b.z - p.z) < 0.75) {
      a.hit = true; b.vx = Math.cos(p.face) * 9; b.vz = Math.sin(p.face) * 9; b.vy = 1; b.lastTeam = p.team; b.passTo = -1; b.noPick = p.i; b.noPickT = 0.5;
      ev(m, "tackle", { team: p.team, ok: true });
    }
    return;
  }
  const c = m.players[b.owner];
  if (c.team === p.team || hyp(c.x - p.x, c.z - p.z) > (slide ? 1.2 : 1.0)) return;
  a.hit = true;
  if (c.invuln > 0) { p.act = { type: "stun", t: 0, dur: 0.5 }; ev(m, "tackle", { team: p.team, ok: false }); return; }
  const behind = Math.cos(c.face) * (p.x - c.x) + Math.sin(c.face) * (p.z - c.z) < 0;
  const prob = clamp(0.45 + (p.vel + p.skill) / 200 * 0.4 - c.skill / 100 * 0.45 + (behind ? 0.1 : 0) + (slide ? 0.2 : 0), 0.15, 0.92);
  if (Math.random() < prob) {
    if (slide) {
      loseBall(m, c, Math.cos(p.face) * 7, Math.sin(p.face) * 7, 1); m.ball.noPick = c.i; m.ball.lastTeam = p.team;
      c.act = { type: "down", t: 0, dur: 0.7 };
    } else {
      m.trick[c.team].on = false; c.act = { type: "stun", t: 0, dur: 0.35 };
      b.owner = p.i; b.lastTeam = p.team; p.act = null;
      if (m.human[p.team]) m.ctrl[p.team] = p.i;
    }
    ev(m, "tackle", { team: p.team, ok: true });
  } else {
    if (!slide) p.act = { type: "stun", t: 0, dur: 0.4 };
    ev(m, "tackle", { team: p.team, ok: false });
  }
}

// ---- computer players
function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
  const t = clamp(((px - ax) * vx + (pz - az) * vz) / l2, 0, 1);
  return hyp(px - ax - vx * t, pz - az - vz * t);
}
function laneClear(m, team, ax, az, bx, bz, r, skip) {
  for (const o of m.players) if (o.team !== team && !out(o) && o !== skip && segDist(o.x, o.z, ax, az, bx, bz) < r) return false;
  return true;
}
function bestAim(m, p) {
  const gx = dirOf(p.team) * F.HL; let best = null, bd = -1;
  for (const z of [0, -0.8, 0.8]) {
    let dmin = 9;
    for (const o of m.players) if (o.team !== p.team && !out(o)) dmin = Math.min(dmin, segDist(o.x, o.z, p.x, p.z, gx, z));
    if (dmin > bd) { bd = dmin; best = z; }
  }
  return { z: best, clear: bd };
}
function openMate(m, p) {
  const d = dirOf(p.team); let best = null, bs = -1e9;
  for (const q of m.players) {
    if (q.team !== p.team || q === p || out(q)) continue;
    if (!laneClear(m, p.team, p.x, p.z, q.x, q.z, 0.9)) continue;
    let near = 9; for (const o of m.players) if (o.team !== p.team) near = Math.min(near, hyp(o.x - q.x, o.z - q.z));
    if (near < 1.2) continue;
    const s = d * (q.x - p.x) + near * 0.5;
    if (s > bs) { bs = s; best = q; }
  }
  return best ? { mate: best, gain: d * (best.x - p.x) } : null;
}

function aiTeam(m, team, dt, intents) {
  const d = dirOf(team), b = m.ball, lvl = m.teams[team].ai;
  const mates = m.players.filter((p) => p.team === team), opps = m.players.filter((p) => p.team !== team);
  const hi = m.human[team] ? m.ctrl[team] : -1;
  const ogx = -d * F.HL, gx = d * F.HL;
  const go = (p, x, z, extra) => { intents[p.i] = { tx: clamp(x, -F.HL + 0.6, F.HL - 0.6), tz: clamp(z, -F.HW + 0.6, F.HW - 0.6), ...extra }; };
  const owner = b.owner >= 0 ? m.players[b.owner] : null;
  const react = 0.42 - 0.27 * lvl;

  if (owner && owner.team === team) {
    if (owner.i !== hi && !busy(owner)) {
      const p = owner, dg = hyp(gx - p.x, p.z);
      let dn = 9, steer = 0;
      for (const o of opps) {
        if (out(o)) continue;
        const dist = hyp(o.x - p.x, o.z - p.z); dn = Math.min(dn, dist);
        if (d * (o.x - p.x) > -0.5 && dist < 3.5) steer += (p.z - o.z >= 0 ? 1 : -1) * (3.5 - dist) / 3.5 * 3;
      }
      if (Math.abs(p.z) > F.HW - 1.5) steer -= Math.sign(p.z) * 2.5;
      const it = { tx: gx - d * 1.2, tz: clamp(p.z * 0.4 + steer, -F.HW + 0.8, F.HW - 0.8) };
      if (d * (gx - p.x) > 2.5) it.tx = p.x + d * 4, it.tz = clamp(p.z + steer - p.z * 0.25, -F.HW + 0.8, F.HW - 0.8);
      p.think -= dt;
      if (p.think <= 0) {
        p.think = react * (0.7 + Math.random() * 0.6);
        const aim = bestAim(m, p), range = 4.2 + 2.3 * p.prec / 99, r = Math.random();
        if ((dg < 3.2 || (dg < range && aim.clear > 0.75 + 0.5 * m.teams[1 - p.team].ai)) && r < 0.4 + 0.25 * lvl) it.act = "shoot", it.aimZ = aim.z + (Math.random() - 0.5) * 0.6;
        else if (dn < 1.6) {
          const om = openMate(m, p);
          if (om && r < 0.42) it.act = "pass", it.mate = om.mate;
          else if (r < 0.52 + p.skill / 500 && p.cool <= 0) {
            p.cool = 2.2;
            const len = 1 + Math.floor(Math.random() * Math.min(4, 1 + Math.floor(p.skill / 28)));
            it.act = "trick"; it.seq = Array.from({ length: len }, () => (Math.random() < 0.5 ? "T" : "P"));
          }
        } else { const om = openMate(m, p); if (om && om.gain > 2.5 && r < 0.2) it.act = "pass", it.mate = om.mate; }
      }
      intents[p.i] = it;
    }
    const rest = mates.filter((p) => p !== owner && p.i !== hi).sort((a, c) => d * (c.x - a.x));
    const deep = d * owner.x > F.HL - 4.5;
    const sz = owner.z > 0 ? -1 : 1;
    const spotF = deep ? [d * (F.HL - 3.2), sz * 2.4] : [owner.x + d * 5.5, sz * 3.4];
    const spotB = [owner.x - d * 4, owner.z * 0.3 - sz * 1.2];
    if (rest[0]) go(rest[0], spotF[0], spotF[1]);
    if (rest[1]) go(rest[1], spotB[0], spotB[1]);
    if (rest.length === 1 && hi >= 0 && d * (m.players[hi].x - owner.x) > 1) go(rest[0], spotB[0], spotB[1]);
    return;
  }

  const bx = b.x + b.vx * 0.25, bz = b.z + b.vz * 0.25;
  let pool = mates.filter((p) => p.i !== hi && !out(p)).sort((a, c) => hyp(a.x - bx, a.z - bz) - hyp(c.x - bx, c.z - bz));
  const keeperSpot = () => {
    const vx = b.x - ogx, vz = b.z, l = hyp(vx, vz) || 1, r = Math.min(1.5, l * 0.5);
    return [ogx + vx / l * r, clamp(vz / l * r, -F.GW, F.GW)];
  };

  if (owner) {
    // defending: one presses, one protects the goal, one marks
    let presser = null;
    if (hi < 0 && pool.length) presser = pool.shift();
    else if (hi >= 0 && pool.length && hyp(m.players[hi].x - b.x, m.players[hi].z - b.z) > 3) presser = pool.shift();
    pool.sort((a, c) => Math.abs(a.x - ogx) - Math.abs(c.x - ogx));
    const keeper = pool.shift(), marker = pool.shift();
    if (presser) {
      const c = owner, dist = hyp(c.x - presser.x, c.z - presser.z);
      const it = { tx: c.x + c.vx * 0.15 - d * 0.3, tz: c.z + c.vz * 0.15 };
      presser.think -= dt;
      if (presser.think <= 0 && presser.cool <= 0) {
        presser.think = react * (0.7 + Math.random() * 0.6);
        if (dist < 1.15 && Math.random() < 0.45 + 0.45 * lvl) it.act = "tackle";
        else if (dist > 1.3 && dist < 2.1 && Math.random() < 0.08 + 0.1 * lvl) it.act = "slide";
      }
      intents[presser.i] = it;
    }
    if (keeper) { const k = keeperSpot(); go(keeper, k[0], k[1]); }
    if (marker) {
      let t = null, td = 1e9;
      for (const o of opps) if (o !== owner) { const q = Math.abs(o.x - ogx); if (q < td) { td = q; t = o; } }
      if (t) go(marker, t.x + (b.x - t.x) * 0.3 - d * 0.6, t.z + (b.z - t.z) * 0.3);
    }
    return;
  }

  // loose ball
  const humanDist = hi >= 0 ? hyp(m.players[hi].x - bx, m.players[hi].z - bz) : 1e9;
  if (pool.length && (hi < 0 || hyp(pool[0].x - bx, pool[0].z - bz) < humanDist - 0.8 || humanDist > 6)) {
    const c = pool.shift(); go(c, bx, bz);
  }
  pool.sort((a, c) => Math.abs(a.x - ogx) - Math.abs(c.x - ogx));
  const keeper = pool.shift(), other = pool.shift();
  // a shot is coming: the last man goes to the point where it will cross the line
  if (keeper && d * b.vx < -6 && Math.abs(b.x - ogx) < 9) {
    const tt = (ogx + d * 0.7 - b.x) / b.vx, cz = b.z + b.vz * tt;
    if (tt > 0 && Math.abs(cz) < F.GW + 0.8) { go(keeper, ogx + d * 0.7, cz); if (other) go(other, b.x - d * 2, b.z > 0 ? -2.5 : 2.5); return; }
  }
  const attacking = b.lastTeam === team && d * b.x > -2;
  if (keeper) { if (attacking) go(keeper, b.x - d * 5, b.z * 0.3); else { const k = keeperSpot(); go(keeper, k[0], k[1]); } }
  if (other) go(other, b.x + d * (attacking ? 4 : -2), b.z > 0 ? -2.5 : 2.5);
}

// ---- human input: { dx, dz, a, b, c } with a/b/c true only on the frame they are pressed
function humanTeam(m, team, inp, dt, intents) {
  const b = m.ball, tk = m.trick[team];
  // which player the human controls
  if (b.owner >= 0 && m.players[b.owner].team === team) m.ctrl[team] = b.owner;
  else {
    m.switchT[team] -= dt;
    if (m.switchT[team] <= 0 && b.passTo < 0) {
      m.switchT[team] = 0.35;
      const cur = m.players[m.ctrl[team]]; let best = cur, bd = hyp(cur.x - b.x, cur.z - b.z) - 1.5 - (out(cur) ? -9 : 0);
      for (const p of m.players) if (p.team === team && !out(p)) { const dd = hyp(p.x - b.x, p.z - b.z); if (dd < bd) { bd = dd; best = p; } }
      m.ctrl[team] = best.i;
    }
  }
  const p = m.players[m.ctrl[team]];
  const mag = hyp(inp.dx, inp.dz);
  const it = mag > 0.1 ? { dirx: inp.dx / mag, dirz: inp.dz / mag } : { stop: true };
  intents[p.i] = it;
  const has = b.owner === p.i;
  if (!has) { tk.on = false; tk.seq = []; }
  if (busy(p) || m.phase !== "play") return;
  if (has) {
    if (tk.on) {
      for (const k of ["a", "b", "c"]) if (inp[k] && tk.seq.length < 4) { tk.seq.push(SYM[k]); tk.timer = 0.5; }
      tk.timer -= dt;
      if (tk.seq.length === 4 || (tk.timer <= 0 && tk.seq.length)) { it.act = "trick"; it.seq = tk.seq.slice(); tk.on = false; tk.seq = []; }
      else if (tk.timer <= 0) tk.on = false;
    } else if (inp.c) { tk.on = true; tk.seq = []; tk.timer = 1.1; ev(m, "trickStart", { team }); }
    else if (inp.a) { it.act = "shoot"; it.aimZ = Math.abs(inp.dz) > 0.3 ? Math.sign(inp.dz) * (F.GW - 0.35) : undefined; }
    else if (inp.b) {
      let best = null, bs = -1e9;
      for (const q of m.players) {
        if (q.team !== team || q === p) continue;
        const rx = q.x - p.x, rz = q.z - p.z, dist = hyp(rx, rz) || 1;
        const s = mag > 0.1 ? (rx * it.dirx + rz * it.dirz) / dist * 10 - dist * 0.15 : -dist;
        if (s > bs) { bs = s; best = q; }
      }
      if (best) { it.act = "pass"; it.mate = best; }
    }
  } else if (p.cool <= 0) {
    if (inp.a) it.act = "slide";
    else if (inp.b) {
      const dist = hyp(p.x - b.x, p.z - b.z);
      if (dist > 4) { m.switchT[team] = 0; } else it.act = "tackle";
    }
  }
}

export function step(m, dt, inputs) {
  if (m.phase === "end") return;
  m.t += dt;
  const b = m.ball;
  if (m.phase === "kickoff") {
    m.phaseT -= dt;
    if (m.phaseT <= 0) { m.phase = "play"; ev(m, "whistle", {}); }
    return;
  }
  if (m.phase === "goal") {
    m.phaseT -= dt;
    moveBall(m, dt, false);
    for (const p of m.players) { p.vx *= 0.9; p.vz *= 0.9; p.x += p.vx * dt; p.z += p.vz * dt; tickAct(m, p, dt); }
    if (m.phaseT <= 0) {
      if (m.golden || m.clock <= 0) { m.phase = "end"; ev(m, "end", {}); }
      else { kickoff(m, 1 - m.lastScorer); }
    }
    return;
  }
  m.clock -= dt;
  if (m.clock <= 0) {
    m.clock = 0;
    if (m.allowGolden && m.score[0] === m.score[1]) { if (!m.golden) { m.golden = true; ev(m, "golden", {}); } }
    else { m.phase = "end"; ev(m, "end", {}); return; }
  }

  const intents = {};
  for (const team of [0, 1]) {
    aiTeam(m, team, dt, intents);
    if (m.human[team]) humanTeam(m, team, inputs[team] || { dx: 0, dz: 0 }, dt, intents);
  }

  for (const p of m.players) {
    p.cool -= dt; p.invuln -= dt;
    const it = intents[p.i] || { stop: true };
    const ms = maxSpeed(p) * (m.human[p.team] && m.ctrl[p.team] === p.i ? 1 : 0.86 + 0.14 * m.teams[p.team].ai);
    if (busy(p)) {
      const a = p.act;
      if (a.type === "trick") {
        const k = a.t / a.dur, fw = ms * (0.8 + 0.25 * a.tr.anim.fwd), lat = a.side * a.tr.anim.side * (Math.PI / 2) / a.dur * Math.cos(Math.PI / 2 * k);
        p.vx = a.dx * fw - a.dz * lat; p.vz = a.dz * fw + a.dx * lat;
      } else if (a.type === "tackle" || a.type === "slide") { const f = a.type === "slide" ? 0.965 : 0.94; p.vx *= f; p.vz *= f; resolveTackle(m, p); }
      else { p.vx *= 0.85; p.vz *= 0.85; }
    } else {
      // act first, then move
      if (it.act && m.phase === "play") {
        if (b.owner === p.i) {
          if (it.act === "shoot") shoot(m, p, it.aimZ);
          else if (it.act === "pass" && it.mate) pass(m, p, it.mate);
          else if (it.act === "trick") startTrick(m, p, it.seq);
        } else if (p.cool <= 0 && (it.act === "tackle" || it.act === "slide")) {
          if (it.tx !== undefined) p.face = Math.atan2(b.z - p.z, b.x - p.x);
          startTackle(p, it.act === "slide"); p.cool = it.act === "slide" ? 1.2 : 0.7;
        }
      }
      if (!busy(p)) {
        let wx = 0, wz = 0;
        if (it.dirx !== undefined) { wx = it.dirx; wz = it.dirz; }
        else if (it.tx !== undefined) { const rx = it.tx - p.x, rz = it.tz - p.z, l = hyp(rx, rz); if (l > 0.25) { const s = Math.min(1, l / 1.2); wx = rx / l * s; wz = rz / l * s; } }
        const sp = ms * (b.owner === p.i ? 0.92 : 1);
        const acc = 24 * (0.7 + p.vel / 200) * dt;
        const ex = wx * sp - p.vx, ez = wz * sp - p.vz, el = hyp(ex, ez);
        if (el <= acc) { p.vx = wx * sp; p.vz = wz * sp; } else { p.vx += ex / el * acc; p.vz += ez / el * acc; }
        const v = hyp(p.vx, p.vz);
        if (v > 0.6) { let da = Math.atan2(p.vz, p.vx) - p.face; da = Math.atan2(Math.sin(da), Math.cos(da)); p.face += da * Math.min(1, 14 * dt); }
      }
    }
    p.x += p.vx * dt; p.z += p.vz * dt;
    p.x = clamp(p.x, -F.HL + PR, F.HL - PR); p.z = clamp(p.z, -F.HW + PR, F.HW - PR);
    p.run += hyp(p.vx, p.vz) * dt;
    tickAct(m, p, dt);
  }

  // players push each other apart
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    const p = m.players[i], q = m.players[j], rx = q.x - p.x, rz = q.z - p.z, l = hyp(rx, rz);
    if (l < PR * 2 && l > 1e-4) { const k = (PR * 2 - l) / 2 / l; p.x -= rx * k; p.z -= rz * k; q.x += rx * k; q.z += rz * k; }
  }
  moveBall(m, dt, true);
}

function tickAct(m, p, dt) {
  const a = p.act; if (!a) return;
  a.t += dt;
  if (a.t >= a.dur) p.act = a.type === "slide" ? { type: "down", t: 0, dur: a.hit ? 0.4 : 0.65 } : null;
}

function moveBall(m, dt, live) {
  const b = m.ball;
  if (b.owner >= 0) {
    const p = m.players[b.owner];
    b.x = clamp(p.x + Math.cos(p.face) * 0.55, -F.HL + 0.12, F.HL - 0.12); b.z = clamp(p.z + Math.sin(p.face) * 0.55, -F.HW + 0.12, F.HW - 0.12);
    b.y = 0; b.vx = p.vx; b.vz = p.vz; b.vy = 0; b.spin += hyp(p.vx, p.vz) * dt * 4;
    return;
  }
  b.noPickT -= dt; if (b.noPickT <= 0) b.noPick = -1;
  b.vy -= 22 * dt; b.y += b.vy * dt;
  if (b.y <= 0) { b.y = 0; b.vy = Math.abs(b.vy) > 1.6 ? -b.vy * 0.5 : 0; const f = Math.exp(-1.1 * dt); b.vx *= f; b.vz *= f; }
  if (b.y > F.ROOF) { b.y = F.ROOF; b.vy = -Math.abs(b.vy) * 0.5; }
  b.x += b.vx * dt; b.z += b.vz * dt; b.spin += hyp(b.vx, b.vz) * dt * 4;
  if (Math.abs(b.z) > F.HW - 0.12) { b.z = Math.sign(b.z) * (F.HW - 0.12); b.vz *= -0.72; b.vx *= 0.9; if (live && Math.abs(b.vz) > 2) ev(m, "wall", {}); }
  if (Math.abs(b.x) > F.HL - 0.12) {
    const side = Math.sign(b.x);
    if (live && Math.abs(b.z) < F.GW && b.y < F.GH) {
      const team = side > 0 ? 0 : 1;
      m.score[team]++; m.lastScorer = team; m.phase = "goal"; m.phaseT = 2.3;
      b.vx *= 0.25; b.vz *= 0.25; b.passTo = -1; m.trick.forEach((t) => { t.on = false; });
      ev(m, "goal", { team });
      return;
    }
    const inMouth = !live && Math.abs(b.z) < F.GW && b.y < F.GH;
    if (inMouth) { if (Math.abs(b.x) > F.HL + 0.8) { b.x = side * (F.HL + 0.8); b.vx = 0; b.vz *= 0.5; } }
    else { b.x = side * (F.HL - 0.12); b.vx *= -0.72; b.vz *= 0.9; if (live && Math.abs(b.vx) > 2) ev(m, "wall", {}); }
  }
  if (!live || b.y > 1.25) return;
  // who gets to the ball
  let best = null, bd = 1e9;
  for (const p of m.players) {
    if (p.i === b.noPick || out(p) || (p.act && p.act.type === "slide")) continue;
    const dd = hyp(p.x - b.x, p.z - b.z);
    if (dd < 0.58 + 0.4 * (p.vel + p.skill) / 198 && dd < bd) { bd = dd; best = p; }
  }
  if (!best) return;
  const sp = hyp(b.vx, b.vz), p = best;
  if (b.passTo === p.i || sp < 12.5 || Math.random() < 0.15 + p.skill / 300) {
    const changed = b.lastTeam !== p.team;
    b.owner = p.i; b.lastTeam = p.team; b.passTo = -1;
    if (changed) m.trick[1 - p.team].on = false;
    if (m.human[p.team]) m.ctrl[p.team] = p.i;
    if (p.act && p.act.type === "tackle") p.act = null;
    ev(m, "control", { team: p.team });
  } else {
    const rx = b.x - p.x, rz = b.z - p.z, l = hyp(rx, rz) || 1, a = Math.atan2(rz, rx) + (Math.random() - 0.5) * 1.2;
    b.x = p.x + rx / l * 0.65; b.z = p.z + rz / l * 0.65;
    b.vx = Math.cos(a) * sp * 0.35; b.vz = Math.sin(a) * sp * 0.35; b.vy = 2 + Math.random() * 2;
    b.noPick = p.i; b.noPickT = 0.3; b.passTo = -1; b.lastTeam = p.team;
    ev(m, "block", { team: p.team });
  }
}

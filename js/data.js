// Rules and numbers of the game. CATALOG is mirrored on the server by `gabbia__catalog()`:
// run `node tools/gen-catalog.mjs` after changing it and re-apply the printed SQL.

export const CATALOG = {
  train: { step: 3, cap: 90 },
  roster: { min: 3, max: 6 },
  startCoins: 150,
  shoes: {
    tela:     { name: "Tela da cortile",  price: 120,  prec: 0, vel: 2, skill: 0 },
    suola:    { name: "Suola liscia",     price: 250,  prec: 0, vel: 0, skill: 4 },
    punta:    { name: "Punta dura",       price: 250,  prec: 4, vel: 0, skill: 0 },
    lampo:    { name: "Lampo",            price: 600,  prec: 0, vel: 7, skill: 0 },
    mirino:   { name: "Mirino",           price: 600,  prec: 7, vel: 0, skill: 0 },
    giocol:   { name: "Giocoliere",       price: 600,  prec: 0, vel: 0, skill: 7 },
    pro:      { name: "Gabbia Pro",       price: 1500, prec: 5, vel: 5, skill: 5 },
    re:       { name: "Re della Gabbia",  price: 4000, prec: 9, vel: 9, skill: 9 }
  },
  market: {
    m01: { name: "Molla",     prec: 30, vel: 44, skill: 30 },
    m02: { name: "Piombo",    prec: 46, vel: 28, skill: 30 },
    m03: { name: "Fumo",      prec: 30, vel: 32, skill: 46 },
    m04: { name: "Vento",     prec: 36, vel: 58, skill: 38 },
    m05: { name: "Bisturi",   prec: 60, vel: 36, skill: 38 },
    m06: { name: "Ginga",     prec: 36, vel: 40, skill: 60 },
    m07: { name: "Trottola",  prec: 44, vel: 50, skill: 52 },
    m08: { name: "Saetta",    prec: 46, vel: 72, skill: 48 },
    m09: { name: "Cecchino",  prec: 74, vel: 46, skill: 48 },
    m10: { name: "Seta",      prec: 48, vel: 48, skill: 74 },
    m11: { name: "Graffio",   prec: 60, vel: 62, skill: 58 },
    m12: { name: "Razzo",     prec: 58, vel: 84, skill: 60 },
    m13: { name: "Compasso",  prec: 86, vel: 58, skill: 62 },
    m14: { name: "Mago",      prec: 60, vel: 62, skill: 86 },
    m15: { name: "Tempesta",  prec: 76, vel: 78, skill: 74 },
    m16: { name: "Sovrano",   prec: 88, vel: 86, skill: 88 }
  },
  tours: [
    { id: "cortile",   name: "Torneo del Cortile",  level: 26, prize: 300 },
    { id: "quartiere", name: "Coppa del Quartiere", level: 42, prize: 800 },
    { id: "citta",     name: "Trofeo della Città",  level: 60, prize: 1800 },
    { id: "re",        name: "Re della Gabbia",     level: 78, prize: 4000 }
  ],
  divs: [
    { name: "Serie C di strada", level: 28, prize: 600,  teams: ["Bar Sport", "Muretto FC", "Lampioni", "Ponte Rotto", "Scalinata"] },
    { name: "Serie B di strada", level: 48, prize: 1500, teams: ["Officina 9", "Capolinea", "Mercato Vecchio", "Torre Nord", "Sottopasso"] },
    { name: "Serie A di strada", level: 68, prize: 3500, teams: ["Cemento Armato", "Notturni", "Gasometro", "Lungofiume", "Stazione Est"] }
  ],
  leagueOffs: [5, 2, 0, -3, -6],
  // league calendar for 6 teams: index 0 is the human club
  schedule: [
    [[0, 5], [1, 4], [2, 3]],
    [[0, 4], [5, 3], [1, 2]],
    [[0, 3], [4, 2], [5, 1]],
    [[0, 2], [3, 1], [4, 5]],
    [[0, 1], [2, 5], [3, 4]]
  ],
  // coins for [win, draw, loss]
  rewards: { friendly: [30, 15, 8], tour: [60, 0, 15], league: [60, 25, 12], friend: [50, 20, 10], live: [50, 20, 10] },
  goalCoin: 4, trickCoin: 1, trickCap: 40,
  names: ["Tano", "Gigi", "Nino", "Pippo", "Ciccio", "Lele", "Dado", "Mimmo", "Totò", "Bebo", "Rino", "Zeno", "Elio", "Ivo", "Nando", "Pino", "Duccio", "Vanni", "Geppo", "Lillo"]
};

export const STATS = ["prec", "vel", "skill"];
export const STAT_LABEL = { prec: "Precisione", vel: "Velocità", skill: "Skill" };
export const POS_LABEL = ["Quarti di finale", "Semifinale", "Finale"];
export const MATCH_SECONDS = 120;
export const TOUR_TEAMS = ["I Ragazzi del Muretto", "Asfalto United", "Rete Bucata", "Gli Scalzi", "Curva Sud Cortile", "Borgata Stellare", "Punta e Tacco", "Senza Arbitro", "Catenaccio 3", "Luci Spente", "Ultimo Piano", "Saracinesca"];

export const trainCost = (cur) => 15 + Math.floor(cur * cur / 20);
export const playerValue = (p) => Math.floor(Math.pow(p.prec + p.vel + p.skill, 2) / 18);
export const sellPrice = (p) => Math.floor(playerValue(p) / 2);
export function effStats(p) {
  const s = p.shoe && CATALOG.shoes[p.shoe];
  const f = (k) => Math.min(99, p[k] + (s ? s[k] : 0));
  return { prec: f("prec"), vel: f("vel"), skill: f("skill") };
}
export const overall = (p) => { const e = effStats(p); return Math.round((e.prec + e.vel + e.skill) / 3); };

// ---- deterministic generator for computer-controlled teams
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) {
  let a = typeof seed === "string" ? hash(seed) : seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const KITS = ["#e2382c", "#2f7fe0", "#27b36a", "#b455e0", "#f0f0f0", "#19c2c2", "#e06a1f", "#d4d130"];
export const MY_KIT = "#ffb23e";
export function kitFor(name, avoid) {
  let i = hash(name) % KITS.length;
  if (KITS[i] === avoid) i = (i + 1) % KITS.length;
  return KITS[i];
}
export function makeTeam(name, level) {
  const r = rng("team:" + name + ":" + level);
  const players = [];
  for (let i = 0; i < 3; i++) {
    const st = {};
    for (const k of STATS) st[k] = Math.max(8, Math.min(99, Math.round(level + (r() - 0.5) * 16)));
    players.push({ name: CATALOG.names[Math.floor(r() * CATALOG.names.length)], num: 2 + Math.floor(r() * 97), look: Math.floor(r() * 6), ...st });
  }
  return { name, players, ai: Math.max(0.1, Math.min(1, (level - 12) / 75)), kit: kitFor(name, MY_KIT) };
}
export function tourOpponent(tour, round, clubName) {
  const r = rng("tour:" + tour.id + ":" + clubName);
  const pool = TOUR_TEAMS.slice();
  let name = pool[0];
  for (let i = 0; i <= round; i++) name = pool.splice(Math.floor(r() * pool.length), 1)[0];
  return makeTeam(name, tour.level + round * 4);
}
export function leagueOpponent(div, idx) {
  const d = CATALOG.divs[div];
  return makeTeam(d.teams[idx - 1], d.level + CATALOG.leagueOffs[idx - 1]);
}

// ---- tricks ("numeri"): after the trick button, a sequence of 1-4 presses of T (tiro), P (passaggio), N (numeri).
// Sequences ending in N are pure show (style points only); the others try to beat the nearest defenders.
const NAMED = {
  T: "Finta di tiro", P: "Suola", TT: "Sterzata", TP: "Doppio passo", PT: "Taglio dentro", PP: "Croqueta",
  TPT: "Elastico", PTP: "Veronica", PPT: "Tunnel", TTP: "Bicicletta", TPP: "Finta e fuga", PTT: "Tacco a seguire",
  TTT: "Tripla finta", PPP: "Tre suole", NT: "Alzata e via", NP: "Tocco sotto",
  TPTP: "Elastico doppio", PTPT: "Ruleta", PPTT: "Sombrero", TTPP: "Arcobaleno", PPPT: "Tunnel di suola",
  TPPT: "Serpentina", PTTP: "Giravolta", NNTP: "Pallonetto del re", TNPT: "Colpo dello scorpione", PNTP: "Trivela di strada",
  N: "Palleggio", TN: "Alzata", PN: "Giro del mondo", NN: "Testa e spalla", TPN: "Stop sulla nuca", PTN: "Giro del mondo doppio",
  NNN: "Pioggia di palleggi", TTN: "Tacco volante", PPN: "Suola e alzata", NNNN: "Show totale", TPTN: "Elastico e nuca", PNPN: "Giostra"
};
const PART = { T: "Finta", P: "Suola", N: "Tocco" };
const SPECIAL = {
  PTP: { spin: 1 }, PTPT: { spin: 1.5 }, PTTP: { spin: 1 }, PPTT: { arc: 2.6 }, TTPP: { arc: 2.2 }, NNTP: { arc: 3 },
  PPT: { side: 0 }, PPPT: { side: 0 }, PN: { orbit: 1 }, PTN: { orbit: 2 }, PNPN: { orbit: 2, spin: 1 }, TPN: { arc: 1.6 }, TPTN: { arc: 1.6 }
};
export function trickFor(seq) {
  const key = seq.join(""), len = seq.length;
  const kind = seq[len - 1] === "N" ? "show" : "dribble";
  const count = (c) => seq.filter((s) => s === c).length;
  const anim = { fwd: 0.6 + 0.35 * count("T"), side: 0.55 * count("P"), spin: 0.5 * count("N") * (kind === "show" ? 0 : 1), hop: 0.25 * count("N"), arc: kind === "show" ? 0.9 + 0.35 * len : 0, orbit: 0, ...(SPECIAL[key] || {}) };
  return { key, len, kind, name: NAMED[key] || "Combo " + seq.map((s) => PART[s]).join("·"), anim, dur: 0.42 + 0.1 * len };
}
export function allTricks() {
  const out = [], sym = ["T", "P", "N"];
  const rec = (seq) => { if (seq.length) out.push(trickFor(seq)); if (seq.length < 4) for (const s of sym) rec([...seq, s]); };
  rec([]);
  return out.sort((a, b) => a.len - b.len || a.key.localeCompare(b.key));
}

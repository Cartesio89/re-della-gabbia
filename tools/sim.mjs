// Headless balance check: computer vs computer, and a random "human" to shake out crashes.
import { createMatch, step } from "../js/engine.js";
import { makeTeam, allTricks } from "../js/data.js";
function play(la, lb, human) {
  const A = makeTeam("A" + Math.random(), la), B = makeTeam("B" + Math.random(), lb);
  if (human) A.human = true;
  const m = createMatch({ teams: [A, B], seconds: 120, golden: false });
  const st = { tricks: 0, fail: 0, tack: 0, shots: 0 };
  let guard = 0;
  while (m.phase !== "end" && guard++ < 60 * 400) {
    const inp = human ? { dx: Math.random() < 0.7 ? 1 : 0, dz: Math.round(Math.random() * 2 - 1), a: Math.random() < 0.02, b: Math.random() < 0.03, c: Math.random() < 0.05 } : null;
    step(m, 1 / 60, { 0: inp });
    for (const e of m.events) { if (e.type === "trick") e.ok ? st.tricks++ : st.fail++; if (e.type === "tackle" && e.ok) st.tack++; if (e.type === "shot") st.shots++; }
    m.events.length = 0;
    for (const p of m.players) if (!isFinite(p.x) || !isFinite(p.z)) throw new Error("NaN player");
    if (!isFinite(m.ball.x)) throw new Error("NaN ball");
  }
  return { score: m.score, ...st };
}
function batch(la, lb, n, human) {
  let ga = 0, gb = 0, w = 0, d = 0, l = 0, tr = 0, fl = 0, tk = 0, sh = 0;
  for (let i = 0; i < n; i++) { const r = play(la, lb, human); ga += r.score[0]; gb += r.score[1]; r.score[0] > r.score[1] ? w++ : r.score[0] === r.score[1] ? d++ : l++; tr += r.tricks; fl += r.fail; tk += r.tack; sh += r.shots; }
  console.log(`${human ? "rnd-human" : "ai"} ${la} vs ${lb}: goals ${(ga / n).toFixed(1)}-${(gb / n).toFixed(1)}  W/D/L ${w}/${d}/${l}  shots ${(sh / n).toFixed(1)} tricks ok ${(tr / n).toFixed(1)} fail ${(fl / n).toFixed(1)} tackles ${(tk / n).toFixed(1)}`);
}
const n = +process.argv[2] || 30;
batch(28, 28, n); batch(50, 50, n); batch(80, 80, n); batch(28, 45, n); batch(60, 40, n); batch(30, 30, n, true);
const all = allTricks(); console.log("tricks", all.length, "dribble", all.filter(t => t.kind === "dribble").length, "show", all.filter(t => t.kind === "show").length, "named", all.filter(t => !t.name.startsWith("Combo")).length);

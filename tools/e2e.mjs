// Browser test with a fake server (the sandbox cannot reach Supabase): account, shop screens, a full match, result.
import { chromium } from "playwright";
import http from "http"; import fs from "fs"; import path from "path";
const root = path.resolve(import.meta.dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/json" };
const srv = http.createServer((q, s) => { let p = q.url.split("?")[0]; if (p === "/") p = "/index.html"; const f = path.join(root, p); if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { "Content-Type": types[path.extname(f)] || "text/plain" }); s.end(fs.readFileSync(f)); }).listen(8123);
const mk = (name) => ({ name, coins: 150, roster: [1, 2, 3].map((i) => ({ id: "p" + i, name: "Tizio" + i, prec: 25, vel: 26, skill: 27, shoe: null, num: i + 3, look: i })), lineup: ["p1", "p2", "p3"], progress: { tours: [], tour: null, div: 0, league: null }, stats: { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, tricks: 0, friend_p: 0, friend_w: 0, cups: 0, titles: 0 }, points: 0 });
const profiles = {}; const calls = [];
function fake(fn, a) {
  calls.push(fn);
  const p = profiles[a.p_token];
  if (fn === "gabbia_register" || fn === "gabbia_login") { profiles["tok-" + a.p_name] = profiles["tok-" + a.p_name] || mk(a.p_name); return { token: "tok-" + a.p_name, profile: profiles["tok-" + a.p_name] }; }
  if (fn === "gabbia_profile") return p ? { profile: p } : { error: "no_session" };
  if (fn === "gabbia_train") { const pl = p.roster.find((x) => x.id === a.p_pid); pl[a.p_stat] += 3; p.coins -= 40; return { profile: p, price: 40 }; }
  if (fn === "gabbia_tour_enter") { p.progress.tour = { id: a.p_tour, round: 0 }; return { profile: p }; }
  if (fn === "gabbia_league_start") { p.progress.league = { div: 0, day: 0, table: Array.from({ length: 6 }, () => ({ pts: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0 })) }; return { profile: p }; }
  if (fn === "gabbia_match_start") return { match: "m1", opp: null };
  if (fn === "gabbia_match_result") { p.coins += 50; p.stats.played++; return { profile: p, reward: 50, prize: 0, extra: {} }; }
  if (fn === "gabbia_board") return [{ name: "Tizio", value: 3, played: 1, won: 1 }];
  if (fn === "gabbia_inbox") return { items: [] };
  return { error: "bad_item" };
}
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];
async function page(ctx, vp, q = "") {
  const pg = await ctx.newPage(); await pg.setViewportSize(vp);
  pg.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  pg.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
  await pg.route("**/rest/v1/rpc/*", (r) => { const fn = r.request().url().split("/rpc/")[1]; r.fulfill({ contentType: "application/json", body: JSON.stringify(fake(fn, JSON.parse(r.request().postData() || "{}"))) }); });
  await pg.route("**/fonts.googleapis.com/**", (r) => r.abort());
  await pg.goto("http://localhost:8123/" + q); await pg.waitForSelector('#fName, [data-to="play"]');
  return pg;
}
async function login(pg, name) { await pg.fill("#fName", name); await pg.fill("#fPin", "1234"); await pg.click('[data-act="register"]'); await pg.waitForSelector('[data-to="play"]'); }
const shot = (pg, n) => pg.screenshot({ path: `/tmp/shot-${n}.png` });
const ctx = await browser.newContext();
const pg = await page(ctx, { width: 900, height: 420 });
await shot(pg, "login"); await login(pg, "Prova"); await shot(pg, "home");
for (const to of ["squad", "market", "tours", "league", "friends", "board", "tricks", "help"]) { await pg.click(`[data-to="${to}"]`); await pg.waitForTimeout(150); if (to === "squad") { await pg.click('[data-to="player"]'); await pg.click('[data-act="train"]'); await pg.waitForTimeout(200); await shot(pg, "player"); await pg.click('[data-to="squad"]'); } await pg.click('[data-to="home"]'); }
await pg.click('[data-to="tours"]'); await pg.click('[data-act="tourEnter"]'); await pg.waitForSelector('[data-act="tourPlay"]'); await shot(pg, "tours"); await pg.click('[data-to="home"]');
await pg.click('[data-to="league"]'); await pg.click('[data-act="leagueStart"]'); await pg.waitForSelector('[data-act="leaguePlay"]'); await shot(pg, "league"); await pg.click('[data-to="home"]');
await pg.click('[data-to="play"]'); await pg.click('[data-act="friendly"]'); await pg.waitForSelector("#matchUi:not([hidden])", { state: "attached" });
await pg.waitForTimeout(2500);
// play with the keyboard: run right, try a trick (N then T P), shoot
await pg.keyboard.down("ArrowRight"); await pg.waitForTimeout(500);
await pg.keyboard.press("KeyL"); await pg.waitForTimeout(60); await pg.keyboard.press("KeyJ"); await pg.waitForTimeout(60); await shot(pg, "trick-input"); await pg.keyboard.press("KeyK"); await pg.waitForTimeout(900);
await shot(pg, "match"); await pg.keyboard.press("KeyJ"); await pg.waitForTimeout(1500); await pg.keyboard.up("ArrowRight");
const info = await pg.evaluate(() => { const m = window.__gabbia.game.m; return { phase: m.phase, clock: m.clock, tricks: m.tricks, score: m.score, bx: m.ball.x }; });
console.log("mid-match", JSON.stringify(info));
await pg.click("#quit"); await pg.waitForSelector('[data-act="resume"]'); await shot(pg, "quit"); await pg.click('[data-act="resume"]');
await pg.evaluate(() => { window.__gabbia.game.m.clock = 1.5; });
await pg.waitForSelector(".big", { timeout: 15000 }); await shot(pg, "result");
console.log("result text:", (await pg.textContent("#panel")).replace(/\s+/g, " ").slice(0, 160));
// portrait phone
const ph = await page(ctx, { width: 390, height: 800 }); await ph.waitForSelector('[data-to="play"]'); await shot(ph, "home-portrait");
await ph.click('[data-to="play"]'); await ph.click('[data-act="free"]'); await ph.waitForSelector("#matchUi:not([hidden])", { state: "attached" }); await ph.waitForTimeout(3500); await shot(ph, "match-portrait");
await pg.close(); await ph.close();
// live: two tabs of the same browser through BroadcastChannel
const h = await page(ctx, { width: 800, height: 400 }, "?net=local"); await h.waitForSelector('[data-to="friends"]');
const ctx2 = ctx; const g = await ctx2.newPage(); await g.setViewportSize({ width: 800, height: 400 });
g.on("pageerror", (e) => errors.push("GUEST " + e.message));
await g.route("**/rest/v1/rpc/*", (r) => { const fn = r.request().url().split("/rpc/")[1]; const a = JSON.parse(r.request().postData() || "{}"); if (a.p_token) a.p_token = "tok-Ospite"; if (!profiles["tok-Ospite"]) profiles["tok-Ospite"] = mk("Ospite"); r.fulfill({ contentType: "application/json", body: JSON.stringify(fake(fn, a)) }); });
await g.route("**/fonts.googleapis.com/**", (r) => r.abort());
await g.goto("http://localhost:8123/?net=local"); await g.waitForSelector('[data-to="friends"]');
await h.click('[data-to="friends"]'); await h.click('[data-act="liveHost"]'); await h.waitForSelector(".code"); const code = (await h.textContent(".code")).trim();
await g.click('[data-to="friends"]'); await g.fill("#fCode", code); await g.click('[data-act="liveJoin"]');
await h.waitForSelector("#matchUi:not([hidden])", { state: "attached", timeout: 8000 }); await g.waitForSelector("#matchUi:not([hidden])", { state: "attached", timeout: 8000 });
await g.waitForTimeout(6000); await g.keyboard.down("ArrowLeft"); await g.waitForTimeout(5000);
const hs = await h.evaluate(() => { const m = window.__gabbia.game.m; return { ctrl: m.ctrl[1], x: m.players[m.ctrl[1]].x, vx: m.players[m.ctrl[1]].vx, clock: m.clock, phase: m.phase }; });
const gs = await g.evaluate(() => { const m = window.__gabbia.game.m; return { x: m.players[m.ctrl[1]].x, clock: m.clock, phase: m.phase, me: window.__gabbia.game.me }; });
console.log("live host", JSON.stringify(hs), "guest", JSON.stringify(gs)); await shot(g, "live-guest");
await h.evaluate(() => { window.__gabbia.game.m.clock = 1; });
await h.waitForSelector(".big", { timeout: 15000 }); await g.waitForSelector(".big", { timeout: 15000 });
console.log("live results:", (await h.textContent(".big")).trim(), "|", (await g.textContent(".big")).trim());
console.log("calls", [...new Set(calls)].join(","));
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no console errors");
await browser.close(); srv.close();

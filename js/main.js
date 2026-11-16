// Screens and game flow: account, club management, match launcher, results.
import { api, ERRORS } from "./api.js";
import { createView } from "./view.js";
import { createMatch, step } from "./engine.js";
import { createInput, sfx } from "./input.js";
import * as D from "./data.js";
import { encode, ghostMatch, applySnapshot, extrapolate, roomCode, openRoom } from "./online.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const C = D.CATALOG, STEP = 1 / 60;
const S = { token: store.get("gabbia_token"), profile: null, screen: "login", arg: null, game: null, room: null, busy: false, boardKind: "points", trickFilter: "all" };
const panel = $("panel"), app = $("app");
let view, input, T = 0, last = 0, acc = 0, toastTimer = 0, bannerTimer = 0;

function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600); }
function banner(html, bad, ms = 1300) { const b = $("banner"); b.innerHTML = html; b.className = "banner show" + (bad ? " bad" : ""); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove("show"), ms); }
const errText = (r) => ERRORS[r.error] || "Qualcosa non ha funzionato.";

// ---- club helpers
const rosterOf = () => S.profile.roster;
const byId = (id) => rosterOf().find((p) => p.id === id);
function myTeam() {
  const players = S.profile.lineup.map(byId).filter(Boolean).map((p) => ({ name: p.name, num: p.num, look: p.look, ...D.effStats(p) }));
  return { name: S.profile.name, players, kit: D.MY_KIT, ai: 0.6 };
}
const teamLevel = (t) => Math.round(t.players.reduce((s, p) => s + p.prec + p.vel + p.skill, 0) / 9);
function setProfile(p) {
  S.profile = p;
  $("who").hidden = false; $("whoName").textContent = p.name; $("whoCoins").textContent = p.coins + " M";
  if (!S.game) view.setTeams([myTeam()]);
}
async function call(promise, okMsg) {
  if (S.busy) return null;
  S.busy = true;
  const r = await promise;
  S.busy = false;
  if (!r || r.error) {
    if (r && r.error === "no_session") { store.del("gabbia_token"); S.token = null; go("login"); }
    toast(r ? errText(r) + (r.missing ? ` Mancano ${r.missing} M.` : "") : "Errore");
    return null;
  }
  if (r.profile) setProfile(r.profile);
  if (okMsg) { toast(okMsg); sfx.coin(); }
  return r;
}

// ---- screens
function go(screen, arg) { S.screen = screen; S.arg = arg ?? null; render(); panel.scrollTop = 0; }
const back = (to = "home") => `<button class="btn ghost small" data-act="go" data-to="${to}">Indietro</button>`;
const chips = (key) => `<span class="chips">${key.split("").map((s) => `<span class="chip ${s}">${s}</span>`).join("")}</span>`;
function statRows(p) {
  const e = D.effStats(p);
  return D.STATS.map((k) => `<div class="stat"><span>${D.STAT_LABEL[k]}</span><i><u style="width:${e[k]}%"></u></i><em>${p[k]}${e[k] > p[k] ? `<s> +${e[k] - p[k]}</s>` : ""}</em></div>`).join("");
}

const SCREENS = {
  login: () => `
    <h2>Entra in gabbia</h2>
    <p>Tre contro tre, sponde vive, nessun arbitro. Parti con tre scarsi e li fai diventare re.</p>
    <label class="field"><span>Nome della squadra</span><input id="fName" maxlength="14" autocomplete="username" autocapitalize="words"></label>
    <label class="field"><span>PIN (4 cifre)</span><input id="fPin" maxlength="4" inputmode="numeric" pattern="[0-9]*" type="password" autocomplete="current-password"></label>
    <div class="err" id="fErr"></div>
    <div class="row"><button class="btn grow" data-act="login">Entra</button><button class="btn ghost grow" data-act="register">Crea squadra</button></div>
    <p>Squadra, monete e trofei restano sul server: li ritrovi su qualsiasi telefono con nome e PIN.</p>`,

  home: () => {
    const p = S.profile, st = p.stats, lv = teamLevel(myTeam());
    return `
    <h2>${esc(p.name)} <span class="tag">liv. ${lv}</span></h2>
    <p>${st.played} partite · ${st.won} V ${st.drawn} P ${st.lost} S · ${st.cups} coppe · ${st.titles} scudetti</p>
    <div class="tiles">
      <button class="tile wide" data-act="go" data-to="play"><b>Gioca</b><small>Amichevole o allenamento libero</small></button>
      <button class="tile" data-act="go" data-to="tours"><b>Tornei</b><small>${p.progress.tours.length}/${C.tours.length} vinti</small></button>
      <button class="tile" data-act="go" data-to="league"><b>Campionato</b><small>${esc(C.divs[p.progress.div].name)}</small></button>
      <button class="tile" data-act="go" data-to="friends"><b>Amici</b><small>Sfida in diretta o la loro squadra</small></button>
      <button class="tile" data-act="go" data-to="squad"><b>Squadra</b><small>Allenamenti, scarpe, titolari</small></button>
      <button class="tile" data-act="go" data-to="market"><b>Mercato</b><small>Compra e vendi giocatori</small></button>
      <button class="tile" data-act="go" data-to="board"><b>Classifiche</b><small>Top 10</small></button>
      <button class="tile" data-act="go" data-to="tricks"><b>Numeri</b><small>120 combinazioni</small></button>
      <button class="tile" data-act="go" data-to="help"><b>Comandi</b><small>Come si gioca</small></button>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn ghost small" data-act="logout">Esci dall'account</button></div>`;
  },

  help: () => `
    <h2>Comandi ${back()}</h2>
    <p><b>Joystick</b> a 8 direzioni (tastiera: frecce o WASD).</p>
    <p><span class="chip T">T</span> con la palla <b>tiri</b> (joystick di lato per scegliere l'angolo), senza palla fai la <b>scivolata</b>. Tasto J o Z.</p>
    <p><span class="chip P">P</span> con la palla <b>passi</b> verso dove punti, senza palla fai il <b>contrasto</b>; lontano dalla palla cambia giocatore. Tasto K o X.</p>
    <p><span class="chip N">N</span> apre i <b>numeri</b>: dopo averlo premuto, componi una sequenza da 1 a 4 tasti tra T, P e N. Tasto L o C.</p>
    <p>Le sequenze che finiscono con T o P provano a saltare chi ti sta davanti; quelle che finiscono con N sono solo spettacolo e valgono monete stile. Più è lunga, più è forte e più è facile perdere palla: conta la Skill.</p>
    <p>Partita da 2 minuti. La gabbia è chiusa: la palla rimbalza su tutte le sponde. Nei tornei, in parità si va al golden gol.</p>`,

  play: () => {
    const lv = teamLevel(myTeam());
    const opp = [["Scappati di casa", 18], ["Quelli del cortile", 30], ["Banda del quartiere", 45], ["Stelle di città", 62], ["Leggende della gabbia", 82]];
    return `
    <h2>Gioca ${back()}</h2>
    <p>La tua squadra è di livello ${lv}. Più forte è l'avversario, più monete vale.</p>
    ${opp.map(([n, l]) => `<div class="card"><div class="name">${n}<span class="tag dim">liv. ${l}</span></div>
      <div class="row"><span class="grow">Vittoria ${Math.round(C.rewards.friendly[0] * Math.max(0.4, Math.min(1.8, l / 50)))} M + gol e numeri</span><button class="btn small" data-act="friendly" data-level="${l}" data-name="${n}">Gioca</button></div></div>`).join("")}
    <div class="card"><div class="name">Allenamento libero</div><div class="row"><span class="grow">Niente monete, niente classifica: per provare i numeri.</span><button class="btn ghost small" data-act="free">Prova</button></div></div>`;
  },

  squad: () => {
    const p = S.profile;
    return `
    <h2>Squadra ${back()}</h2>
    <p>${p.roster.length}/${C.roster.max} giocatori. Tocca un giocatore per allenarlo, cambiargli le scarpe o venderlo.</p>
    ${p.roster.map((pl) => `<div class="card ${p.lineup.includes(pl.id) ? "on" : ""}" data-act="go" data-to="player" data-arg="${pl.id}">
      <div class="name"><span>${pl.num} ${esc(pl.name)}</span><span>${p.lineup.includes(pl.id) ? '<span class="tag">Titolare</span>' : '<span class="tag dim">Panchina</span>'} <span class="tag dim">${D.overall(pl)}</span></span></div>
      ${statRows(pl)}${pl.shoe ? `<p>Scarpe: ${esc(C.shoes[pl.shoe].name)}</p>` : ""}</div>`).join("")}`;
  },

  player: () => {
    const pl = byId(S.arg); if (!pl) return SCREENS.squad();
    const p = S.profile, starter = p.lineup.includes(pl.id);
    return `
    <h2>${pl.num} ${esc(pl.name)} ${back("squad")}</h2>
    ${statRows(pl)}
    <h3>Allenamenti (+${C.train.step}, massimo ${C.train.cap})</h3>
    <div class="row">${D.STATS.map((k) => pl[k] >= C.train.cap ? `<button class="btn small grow" disabled>${D.STAT_LABEL[k]} max</button>` : `<button class="btn small grow" data-act="train" data-stat="${k}">${D.STAT_LABEL[k]}<br>${D.trainCost(pl[k])} M</button>`).join("")}</div>
    <h3>Scarpe (una per giocatore: quella nuova sostituisce la vecchia)</h3>
    ${Object.entries(C.shoes).map(([id, s]) => `<div class="row" style="margin:6px 0"><span class="grow"><b>${esc(s.name)}</b> ${D.STATS.filter((k) => s[k]).map((k) => `+${s[k]} ${D.STAT_LABEL[k].toLowerCase()}`).join(", ")}</span>
      ${pl.shoe === id ? '<span class="tag">Ai piedi</span>' : `<button class="btn small" data-act="shoe" data-shoe="${id}">${s.price} M</button>`}</div>`).join("")}
    <h3>Formazione</h3>
    ${starter ? "<p>È titolare.</p>" : `<div class="row">${p.lineup.map((id) => `<button class="btn ghost small grow" data-act="swap" data-out="${id}">Al posto di ${esc(byId(id)?.name)}</button>`).join("")}</div>`}
    <h3>Cessione</h3>
    <div class="row"><span class="grow">Vale ${D.playerValue(pl)} M, il mercato te ne dà ${D.sellPrice(pl)}.</span><button class="btn danger small" data-act="sell" ${p.roster.length <= C.roster.min ? "disabled" : ""}>Vendi</button></div>`;
  },

  market: () => {
    const p = S.profile, owned = new Set(p.roster.map((x) => x.mid).filter(Boolean));
    return `
    <h2>Mercato ${back()}</h2>
    <p>Rosa ${p.roster.length}/${C.roster.max}. Per vendere vai in Squadra.</p>
    ${Object.entries(C.market).map(([id, m]) => `<div class="card"><div class="name"><span>${esc(m.name)}</span><span class="tag dim">${Math.round((m.prec + m.vel + m.skill) / 3)}</span></div>
      ${statRows(m)}
      <div class="row"><span class="grow"></span>${owned.has(id) ? '<span class="tag">In rosa</span>' : `<button class="btn small" data-act="buy" data-mid="${id}">${D.playerValue(m)} M</button>`}</div></div>`).join("")}`;
  },

  tours: () => {
    const pr = S.profile.progress;
    return `
    <h2>Tornei ${back()}</h2>
    <p>Eliminazione diretta: quarti, semifinale, finale. Se perdi sei fuori e devi reiscriverti.</p>
    ${C.tours.map((t, i) => {
      const won = pr.tours.includes(t.id), open = i === 0 || pr.tours.includes(C.tours[i - 1].id), active = pr.tour && pr.tour.id === t.id;
      let body;
      if (active) { const o = D.tourOpponent(t, pr.tour.round, S.profile.name); body = `<div class="row"><span class="grow">${D.POS_LABEL[pr.tour.round]} contro <b>${esc(o.name)}</b> (liv. ${teamLevel(o)})</span><button class="btn small" data-act="tourPlay">Gioca</button></div>`; }
      else if (open) body = `<div class="row"><span class="grow">Livello ${t.level}-${t.level + 8} · premio ${t.prize} M</span><button class="btn ghost small" data-act="tourEnter" data-tour="${t.id}">${won ? "Rigioca" : "Iscriviti"}</button></div>`;
      else body = `<p>Bloccato: vinci prima ${esc(C.tours[i - 1].name)}.</p>`;
      return `<div class="card ${active ? "on" : ""}"><div class="name">${esc(t.name)} ${won ? '<span class="tag">Vinto</span>' : ""}</div>${body}</div>`;
    }).join("")}`;
  },

  league: () => {
    const pr = S.profile.progress, lg = pr.league, div = lg ? lg.div : pr.div, d = C.divs[div];
    if (!lg) return `
      <h2>Campionato ${back()}</h2>
      <div class="card"><div class="name">${esc(d.name)}</div>
      <p>6 squadre, 5 giornate. Premio al primo ${d.prize} M. ${div < C.divs.length - 1 ? "Le prime due salgono." : "Il primo è campione."} ${div > 0 ? "L'ultima scende." : ""}</p>
      <button class="btn" data-act="leagueStart">Inizia la stagione</button></div>`;
    const oppIdx = C.schedule[lg.day].find((x) => x.includes(0)).reduce((a, b) => a + b, 0), o = D.leagueOpponent(div, oppIdx);
    return `
      <h2>Campionato ${back()}</h2>
      <p>${esc(d.name)} · giornata ${lg.day + 1} di 5</p>
      ${tableHtml(lg.table, div)}
      <div class="row" style="margin-top:10px"><span class="grow">Prossima: <b>${esc(o.name)}</b> (liv. ${teamLevel(o)})</span><button class="btn small" data-act="leaguePlay">Gioca</button></div>`;
  },

  friends: () => `
    <h2>Amici ${back()}</h2>
    <h3>In diretta (due telefoni)</h3>
    <p>Uno crea la stanza e detta il codice, l'altro entra. Serve una connessione decente per entrambi.</p>
    <div class="row"><button class="btn grow" data-act="liveHost">Crea stanza</button></div>
    <div class="row" style="margin-top:8px"><label class="field grow" style="margin:0"><input id="fCode" maxlength="4" placeholder="Codice" autocapitalize="characters" autocomplete="off"></label><button class="btn ghost" data-act="liveJoin">Entra</button></div>
    <h3>Contro la sua squadra (guidata dal computer)</h3>
    <div class="row"><label class="field grow" style="margin:0"><input id="fFriend" maxlength="14" placeholder="Nome della squadra" autocomplete="off"></label><button class="btn ghost" data-act="friendPlay">Sfida</button></div>
    <h3>Chi ha sfidato la tua squadra</h3>
    <div id="inbox"><p>Carico…</p></div>`,

  wait: () => `
    <h2>Stanza ${S.arg.role === "host" ? "aperta" : "trovata"}</h2>
    <div class="code">${esc(S.arg.code)}</div>
    <p>${S.arg.role === "host" ? "Detta questo codice al tuo amico. La partita parte appena entra." : "Aspetto chi ha creato la stanza…"}</p>
    <button class="btn ghost" data-act="liveCancel">Annulla</button>`,

  board: () => `
    <h2>Classifiche ${back()}</h2>
    <div class="row">${[["points", "Punti"], ["cups", "Trofei"], ["friends", "Amici"], ["tricks", "Numeri"]].map(([k, l]) => `<button class="btn small ${S.boardKind === k ? "" : "ghost"}" data-act="board" data-kind="${k}">${l}</button>`).join("")}</div>
    <div id="boardBody"><p>Carico…</p></div>`,

  tricks: () => {
    const all = D.allTricks().filter((t) => S.trickFilter === "all" || t.kind === S.trickFilter);
    return `
    <h2>Numeri ${back()}</h2>
    <p>Premi <span class="chip N">N</span>, poi la sequenza. Quelli con il nome proprio sono i più famosi.</p>
    <div class="row">${[["all", "Tutti"], ["dribble", "Per saltare l'uomo"], ["show", "Solo spettacolo"]].map(([k, l]) => `<button class="btn small ${S.trickFilter === k ? "" : "ghost"}" data-act="trickFilter" data-kind="${k}">${l}</button>`).join("")}</div>
    ${all.map((t) => `<div class="trick"><span>${esc(t.name)}</span>${chips(t.key)}</div>`).join("")}`;
  },

  quit: () => `
    <h2>Abbandoni?</h2>
    <p>${S.game && S.game.ticket ? "Uscire adesso vale una sconfitta 0-3 senza monete." : "La partita finisce qui."}</p>
    <div class="row"><button class="btn grow" data-act="resume">Continua a giocare</button><button class="btn danger" data-act="forfeit">Abbandona</button></div>`,

  result: () => {
    const r = S.arg, won = r.gf > r.ga, draw = r.gf === r.ga, x = r.extra || {};
    let more = "";
    if (x.cup) more = `<p><b>Hai vinto ${esc(C.tours.find((t) => t.id === x.tour).name)}!</b> Premio ${r.prize} M.</p>`;
    else if (x.round !== undefined) more = `<p>Passi il turno: ti aspetta la ${D.POS_LABEL[x.round].toLowerCase()}.</p>`;
    else if (x.out) more = "<p>Eliminato dal torneo.</p>";
    if (x.table) more += (x.final ? `<p><b>Stagione finita: ${x.pos}° posto.</b> Premio ${r.prize} M.${x.newDiv > x.div ? " Promosso!" : x.newDiv < x.div ? " Retrocesso." : ""}</p>` : "") + tableHtml(x.table, x.div ?? S.profile.progress.league?.div ?? S.profile.progress.div);
    return `
    <h2>${r.forfeit ? "Abbandono" : won ? "Vittoria" : draw ? "Pareggio" : "Sconfitta"}</h2>
    <div class="big">${r.gf} - ${r.ga}</div>
    <p>${esc(r.oppName)} · ${r.tricks} numeri riusciti</p>
    ${r.error ? `<p class="err">${esc(r.error)}</p>` : r.saved ? `<p><b class="coin">+${r.reward + (r.prize || 0)} M</b></p>` : "<p>Partita non registrata.</p>"}
    ${more}
    <button class="btn" data-act="go" data-to="${r.next || "home"}">Continua</button>`;
  }
};

function tableHtml(table, div) {
  const names = [S.profile.name, ...C.divs[div].teams];
  const rows = table.map((e, i) => ({ ...e, i })).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.i - b.i);
  return `<table><tr><th>#</th><th>Squadra</th><th>Pt</th><th>V</th><th>P</th><th>S</th><th>Gol</th></tr>${rows.map((e, k) => `<tr class="${e.i === 0 ? "me" : ""}"><td>${k + 1}</td><td>${esc(names[e.i])}</td><td>${e.pts}</td><td>${e.w}</td><td>${e.d}</td><td>${e.l}</td><td>${e.gf}-${e.ga}</td></tr>`).join("")}</table>`;
}

function render() {
  const playing = !!S.game && S.screen === "match";
  app.classList.toggle("playing", !!S.game);
  $("matchUi").hidden = !S.game;
  panel.hidden = playing;
  if (!playing) panel.innerHTML = SCREENS[S.screen]();
  if (S.screen === "board") loadBoard();
  if (S.screen === "friends") loadInbox();
  requestAnimationFrame(() => view && view.resize());
}
async function loadBoard() {
  const kind = S.boardKind, r = await api.board(kind), el = $("boardBody");
  if (!el || S.boardKind !== kind) return;
  if (!Array.isArray(r)) { el.innerHTML = `<p class="err">${errText(r)}</p>`; return; }
  el.innerHTML = r.length ? `<table><tr><th>#</th><th>Squadra</th><th>${{ points: "Punti", cups: "Trofei", friends: "Vittorie", tricks: "Numeri" }[kind]}</th><th>Partite</th></tr>${r.map((e, i) => `<tr class="${e.name === S.profile.name ? "me" : ""}"><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.value}</td><td>${e.played}</td></tr>`).join("")}</table>` : "<p>Ancora nessuno. Gioca la prima partita.</p>";
}
async function loadInbox() {
  const r = await api.inbox(S.token), el = $("inbox");
  if (!el) return;
  if (!r.items) { el.innerHTML = `<p class="err">${errText(r)}</p>`; return; }
  el.innerHTML = r.items.length ? r.items.map((e) => `<p><b>${esc(e.name)}</b> ${e.gf > e.ga ? "ti ha battuto" : e.gf === e.ga ? "ha pareggiato" : "ha perso"} ${e.gf}-${e.ga}${e.mode === "live" ? " in diretta" : ""}</p>`).join("") : "<p>Nessuna sfida ricevuta.</p>";
}

// ---- actions
const ACTIONS = {
  go: (d) => go(d.to, d.arg),
  async login() { await auth(api.login); },
  async register() { await auth(api.register); },
  async logout() { api.logout(S.token); store.del("gabbia_token"); S.token = null; S.profile = null; $("who").hidden = true; go("login"); },
  async train(d) { if (await call(api.train(S.token, S.arg, d.stat), "Allenamento fatto")) render(); },
  async shoe(d) { if (await call(api.buyShoe(S.token, S.arg, d.shoe), "Scarpe nuove ai piedi")) render(); },
  async sell() { if (await call(api.sellPlayer(S.token, S.arg), "Venduto")) go("squad"); },
  async swap(d) { const l = S.profile.lineup.map((id) => (id === d.out ? S.arg : id)); if (await call(api.setLineup(S.token, l), "Formazione aggiornata")) render(); },
  async buy(d) { if (await call(api.buyPlayer(S.token, d.mid), "Benvenuto in squadra")) render(); },
  async tourEnter(d) { if (await call(api.tourEnter(S.token, d.tour))) render(); },
  async leagueStart() { if (await call(api.leagueStart(S.token))) render(); },
  friendly: (d) => launch({ mode: "friendly", ref: String(d.level), opp: D.makeTeam(d.name, +d.level), next: "play" }),
  free: () => launch({ mode: "free", opp: D.makeTeam("Sparring", Math.max(15, teamLevel(myTeam()) - 4)), next: "play" }),
  tourPlay() { const pr = S.profile.progress, t = C.tours.find((x) => x.id === pr.tour.id); launch({ mode: "tour", opp: D.tourOpponent(t, pr.tour.round, S.profile.name), golden: true, next: "tours" }); },
  leaguePlay() { const lg = S.profile.progress.league, idx = C.schedule[lg.day].find((x) => x.includes(0)).reduce((a, b) => a + b, 0); launch({ mode: "league", opp: D.leagueOpponent(lg.div, idx), next: "league" }); },
  friendPlay() { const n = $("fFriend").value.trim(); if (n) launch({ mode: "friend", ref: n, next: "friends" }); },
  liveHost: () => live("host", roomCode()),
  liveJoin() { const c = $("fCode").value.trim().toUpperCase(); if (c.length === 4) live("guest", c); else toast("Il codice ha 4 lettere."); },
  liveCancel() { closeRoom(); go("friends"); },
  board(d) { S.boardKind = d.kind; render(); },
  trickFilter(d) { S.trickFilter = d.kind; render(); },
  resume() { S.game.paused = false; go("match"); },
  forfeit() { finish(true); }
};
panel.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]"); if (!el || el.disabled) return;
  const f = ACTIONS[el.dataset.act]; if (f) f(el.dataset);
});
panel.addEventListener("keydown", (e) => { if (e.key === "Enter" && S.screen === "login") ACTIONS.login(); });
$("quit").addEventListener("click", () => { if (!S.game || S.game.over) return; if (!S.game.live) S.game.paused = true; go("quit"); });

async function auth(fn) {
  const name = $("fName").value, pin = $("fPin").value, err = $("fErr");
  if (S.busy) return;
  S.busy = true; err.textContent = "";
  const r = await fn(name, pin);
  S.busy = false;
  if (r.error) { err.textContent = errText(r) + (r.left !== undefined ? ` Tentativi rimasti: ${r.left}.` : ""); return; }
  S.token = r.token; store.set("gabbia_token", r.token); setProfile(r.profile); go("home");
}

// ---- match
async function launch({ mode, ref, opp, golden, next }) {
  if (S.busy || S.game) return;
  let ticket = null;
  if (mode !== "free") {
    const r = await call(api.matchStart(S.token, mode, ref));
    if (!r) return;
    ticket = r.match;
    if (r.opp) opp = { ...r.opp, ai: 0.6, kit: D.kitFor(r.opp.name, D.MY_KIT) };
  }
  const mine = myTeam();
  startGame({ teams: [{ ...mine, human: true }, opp], me: 0, ticket, golden, next, oppName: opp.name });
}

function startGame(g) {
  g.m = g.guest ? ghostMatch(g.teams) : createMatch({ teams: g.teams, golden: g.golden, seconds: D.MATCH_SECONDS });
  g.remote = { dx: 0, dz: 0, a: false, b: false, c: false }; g.pend = { a: false, b: false, c: false }; g.out = []; g.snapT = 0; g.sendT = 0; g.over = false; g.paused = false;
  S.game = g; acc = 0;
  view.setTeams(g.teams);
  $("tA").textContent = g.teams[0].name; $("tB").textContent = g.teams[1].name;
  input.clear(); go("match");
  window.__gabbia = S;
}

function onEvents(g, events) {
  for (const e of events) {
    if (e.type === "goal") { banner(e.team === g.me ? "GOL!" : "Gol subito", e.team !== g.me, 2000); sfx.goal(); }
    else if (e.type === "shot" || e.type === "pass") sfx.kick();
    else if (e.type === "wall" || e.type === "block") sfx.wall();
    else if (e.type === "whistle") sfx.whistle();
    else if (e.type === "tackle") sfx.tackle();
    else if (e.type === "golden") banner("Golden gol<small>chi segna vince</small>", false, 2200);
    else if (e.type === "trick") {
      if (e.team === g.me) banner(e.ok ? `${esc(e.name)}<small>${e.kind === "show" ? "stile" : e.beaten ? "saltati " + e.beaten : "a vuoto"}</small>` : `${esc(e.name)}<small>palla persa</small>`, !e.ok);
      e.ok ? sfx.trick() : sfx.fail();
    } else if (e.type === "end") { sfx.whistle(); if (!g.over) { g.over = true; setTimeout(() => finish(false), 1400); } }
  }
}

function tickGame(dt) {
  const g = S.game, m = g.m;
  const raw = input.read(), w = view.screenToWorld(raw.sx, raw.sy);
  g.pend.a ||= raw.a; g.pend.b ||= raw.b; g.pend.c ||= raw.c;
  if (g.guest) {
    extrapolate(m, dt);
    g.sendT -= dt;
    if (g.pend.a || g.pend.b || g.pend.c || g.sendT <= 0) { g.room.ch.send("in", { dx: w.dx, dz: w.dz, a: g.pend.a, b: g.pend.b, c: g.pend.c }); g.pend = { a: false, b: false, c: false }; g.sendT = 0.08; }
    if (m.phase === "end" && !g.over) m.events.push({ type: "end" });
    onEvents(g, m.events); m.events.length = 0;
  } else if (!g.paused && !g.over) {
    acc += dt;
    while (acc >= STEP) {
      const inputs = { [g.me]: { dx: w.dx, dz: w.dz, ...g.pend } };
      if (g.live) { inputs[1] = { ...g.remote }; g.remote.a = g.remote.b = g.remote.c = false; }
      g.pend = { a: false, b: false, c: false };
      step(m, STEP, inputs); acc -= STEP;
      if (m.events.length) { onEvents(g, m.events); if (g.live) g.out.push(...m.events.filter((e) => e.type !== "end")); m.events.length = 0; }
    }
    if (g.live) { g.snapT -= dt; if (g.snapT <= 0 || m.phase === "end") { g.snapT = 1 / 15; g.room.ch.send("s", encode(m, g.out)); g.out = []; } }
  }
  // HUD
  $("sc").textContent = m.score[0] + " - " + m.score[1];
  const ck = $("clock"), s = Math.ceil(m.clock);
  ck.textContent = m.golden ? "GOLDEN" : Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); ck.classList.toggle("gold", m.golden || s <= 10);
  const has = m.ball.owner >= 0 && m.players[m.ball.owner].team === g.me, tk = m.trick[g.me];
  $("lA").textContent = tk.on ? "Finta" : has ? "Tira" : "Scivola"; $("lB").textContent = tk.on ? "Suola" : has ? "Passa" : "Contrasta"; $("lC").textContent = tk.on ? "Tocco" : "Numeri";
  $("bC").classList.toggle("armed", tk.on);
  const seq = $("seq"), key = tk.on ? "1" + tk.seq.join("") : "";
  if (seq.dataset.k !== key) { seq.dataset.k = key; seq.innerHTML = tk.on ? [0, 1, 2, 3].map((i) => tk.seq[i] ? `<span class="chip ${tk.seq[i]}">${tk.seq[i]}</span>` : '<span class="slot"></span>').join("") : ""; }
  view.sync(m, dt, T, g.me);
}

async function finish(forfeit) {
  const g = S.game; if (!g || g.done) return;
  g.done = true; g.over = true;
  const m = g.m, gf = forfeit ? 0 : m.score[g.me], ga = forfeit ? 3 : m.score[1 - g.me], tricks = forfeit ? 0 : m.tricks[g.me];
  const res = { gf, ga, tricks, forfeit, oppName: g.oppName, next: g.next, saved: false };
  if (g.live) closeRoom();
  if (g.ticket) {
    panel.hidden = false; panel.innerHTML = "<h2>Fischio finale</h2><p>Salvo il risultato…</p>";
    let r = await api.matchResult(S.token, g.ticket, gf, ga, tricks);
    if (r.error === "network") r = await api.matchResult(S.token, g.ticket, gf, ga, tricks);
    if (r.error) res.error = errText(r);
    else { res.saved = true; res.reward = r.reward; res.prize = r.prize; res.extra = r.extra; S.game = null; setProfile(r.profile); sfx.coin(); }
  }
  S.game = null; view.setTeams([myTeam()]);
  go("result", res);
}

// ---- live room
function closeRoom() { if (S.room) { S.room.close(); S.room = null; } }
async function live(role, code) {
  if (S.busy || S.room) return;
  go("wait", { role, code });
  const mine = myTeam();
  const room = await openRoom(code, role, { name: S.profile.name, team: mine }, (peer, room) => {
    S.room = room;
    const theirs = { ...peer.team, name: peer.name, kit: D.kitFor(peer.name, D.MY_KIT), human: true };
    const g = { teams: role === "host" ? [{ ...mine, human: true }, theirs] : [theirs, { ...mine, human: true }], me: role === "host" ? 0 : 1, live: role === "host", guest: role === "guest", room, ticket: null, next: "friends", oppName: peer.name };
    startGame(g);
    api.matchStart(S.token, "live", peer.name).then((r) => { if (r && r.match) g.ticket = r.match; });
    if (role === "host") room.ch.on("in", (msg) => { g.remote.dx = msg.dx; g.remote.dz = msg.dz; g.remote.a ||= msg.a; g.remote.b ||= msg.b; g.remote.c ||= msg.c; });
    else room.ch.on("s", (snap) => applySnapshot(g.m, snap));
  }, () => {
    if (S.game && !S.game.over) { toast("L'avversario è uscito: partita annullata."); const g = S.game; g.ticket = null; finish(false); }
  });
  if (!room) { toast("Non riesco ad aprire la stanza: controlla la connessione."); go("friends"); return; }
  if (S.screen !== "wait" && !S.game) { room.close(); return; }
  S.room = room;
}

// ---- boot
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now; T += dt;
  if (S.game) tickGame(dt); else view.showcase(dt, T);
  view.render();
}
async function boot() {
  view = createView($("view"));
  input = createInput($("stick"), $("knob"), { a: $("bA"), b: $("bB"), c: $("bC") });
  addEventListener("resize", () => view.resize());
  view.setTeams([D.makeTeam("Vetrina", 30)]);
  view.resize();
  $("loading").hidden = true;
  requestAnimationFrame(frame);
  if (S.token) {
    const r = await api.profile(S.token);
    if (r.profile) { setProfile(r.profile); go("home"); return; }
    if (r.error === "no_session") { store.del("gabbia_token"); S.token = null; }
    else toast(errText(r));
  }
  go("login");
}
boot().catch((e) => { $("loading").hidden = false; $("loading").textContent = "Il 3D non parte su questo dispositivo."; console.error(e); });

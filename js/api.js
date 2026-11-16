// Thin client for the Supabase RPC functions. The publishable key is meant to be public:
// the database only exposes the gabbia_* functions, never the tables.
export const SUPABASE_URL = "https://prmyrmpmfavppkbzdqyg.supabase.co";
export const SUPABASE_KEY = "sb_publishable_M_ihkB0s9phBxPwDwQFd5g_KDzlQmDW";
const URL = SUPABASE_URL + "/rest/v1/rpc/";

async function rpc(name, args) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(URL + name, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: ctrl.signal
    });
    if (!r.ok) return { error: "network", status: r.status };
    return await r.json();
  } catch (e) {
    return { error: "network" };
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  register: (name, pin) => rpc("gabbia_register", { p_name: name, p_pin: pin }),
  login: (name, pin) => rpc("gabbia_login", { p_name: name, p_pin: pin }),
  profile: (token) => rpc("gabbia_profile", { p_token: token }),
  logout: (token) => rpc("gabbia_logout", { p_token: token }),
  train: (token, pid, stat) => rpc("gabbia_train", { p_token: token, p_pid: pid, p_stat: stat }),
  buyShoe: (token, pid, shoe) => rpc("gabbia_buy_shoe", { p_token: token, p_pid: pid, p_shoe: shoe }),
  buyPlayer: (token, mid) => rpc("gabbia_buy_player", { p_token: token, p_mid: mid }),
  sellPlayer: (token, pid) => rpc("gabbia_sell_player", { p_token: token, p_pid: pid }),
  setLineup: (token, lineup) => rpc("gabbia_set_lineup", { p_token: token, p_lineup: lineup }),
  tourEnter: (token, tour) => rpc("gabbia_tour_enter", { p_token: token, p_tour: tour }),
  leagueStart: (token) => rpc("gabbia_league_start", { p_token: token }),
  matchStart: (token, mode, ref) => rpc("gabbia_match_start", { p_token: token, p_mode: mode, p_ref: ref ?? null }),
  matchResult: (token, match, gf, ga, tricks) => rpc("gabbia_match_result", { p_token: token, p_match: match, p_gf: gf, p_ga: ga, p_tricks: tricks }),
  board: (kind) => rpc("gabbia_board", { p_kind: kind }),
  inbox: (token) => rpc("gabbia_inbox", { p_token: token })
};

export const ERRORS = {
  bad_name: "Nome non valido: 2-14 caratteri, lettere, numeri, spazi, punto o trattino.",
  bad_pin: "Il PIN deve essere di 4 cifre.",
  name_taken: "Questo nome è già usato. Se è tuo, entra con il PIN.",
  bad_login: "Nome o PIN sbagliati.",
  locked: "Troppi tentativi sbagliati: account bloccato per qualche minuto.",
  no_session: "Sessione scaduta: rientra con nome e PIN.",
  network: "Connessione assente o server non raggiungibile.",
  too_fast: "Partita troppo breve: non salvata.",
  expired: "Partita scaduta: non salvata.",
  implausible: "Risultato non plausibile: non salvato.",
  no_coins: "Monete insufficienti.",
  already_owned: "Ce l'hai già.",
  bad_item: "Operazione non valida.",
  maxed: "Allenamento al massimo: per salire ancora servono le scarpe.",
  roster_full: "Rosa al completo (6): vendi qualcuno prima.",
  roster_min: "Ti servono almeno 3 giocatori.",
  bad_lineup: "Scegli 3 titolari.",
  locked_tour: "Vinci prima il torneo precedente.",
  no_tour: "Non sei iscritto a nessun torneo.",
  no_league: "Nessuna stagione in corso.",
  no_player: "Giocatore non trovato.",
  duplicate: "Risultato già salvato."
};

# Re della Gabbia

Calcio 3 contro 3 in gabbia, in 3D nel browser (Three.js, nessun build step).

- Gioca: https://cartesio89.github.io/re-della-gabbia/
- Account: nome squadra + PIN di 4 cifre; rosa, monete e trofei sono sul server, quindi si ritrovano su qualsiasi dispositivo.
- Comandi: joystick digitale a 8 direzioni + 3 tasti. **T** tiro / scivolata, **P** passaggio / contrasto, **N** apre i numeri: dopo N, una sequenza di 1-4 tasti tra T, P, N (120 combinazioni, `trickFor` in `js/data.js`). Le sequenze che finiscono con T o P provano a saltare l'avversario, quelle che finiscono con N sono solo spettacolo.
- Crescita: si parte con tre giocatori scarsi; allenamenti (+3 a precisione, velocità o skill), scarpe, mercato giocatori (compra e vendi).
- Modalità: amichevoli, 4 tornei a eliminazione, campionato su 3 serie, sfida amici (contro la loro squadra guidata dal computer, oppure in diretta con codice stanza).

Struttura: `js/data.js` (regole e numeri), `js/engine.js` (simulazione della partita, senza DOM), `js/view.js` (scena 3D),
`js/input.js` (comandi e suoni), `js/main.js` (schermate), `js/api.js` (server), `js/online.js` + `js/net.js` (partita in diretta).
Three.js r170 e supabase-js sono in `vendor/` (licenza MIT).

Backend: progetto Supabase "calcetto", tabelle `gabbia_players`, `gabbia_sessions`, `gabbia_matches`, `gabbia_purchases`,
accessibili solo tramite le funzioni `gabbia_*`. Prezzi e premi sono calcolati dal server (`gabbia__catalog`) e devono restare
allineati a `CATALOG` in `js/data.js`: dopo ogni modifica, `node tools/gen-catalog.mjs` stampa l'SQL da riapplicare.

Prove: `node tools/sim.mjs 30` (partite computer contro computer, per il bilanciamento), `node tools/e2e.mjs` (browser con server finto; richiede Playwright).

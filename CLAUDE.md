# SIGARETTA

Party game online di scrittura collettiva (italiano, telefoni prima). Stack: TypeScript, PeerJS (P2P, host = server), GitHub Pages, vitest.

## Rules
- Le regole di gioco in DESIGN.md non si cambiano senza conferma dell'autore.
- Il prototipo sigaretta.html è solo riferimento, non base di codice (non è salvato qui).
- Il motore (`engine/`) non dipende da Cloudflare e riceve l'ora come parametro.

## Commands
- `npm run dev` — pagina in locale. `npm test` — test. `npm run check` — controllo dei tipi.

## Docs
- DESIGN.md — regole, schermate, architettura. Leggere prima di toccare le regole.

## Status
- Fase 1 (motore + test): fatta. Oggi 48 test passano.
- Fase 2 (P2P, niente Cloudflare): M2 fatto (net/host.ts). M3 fatto (net/peer.ts, web/, Vite: `npm run dev`; provata una partita completa in 3 schede; manca il playtest di Giovanni verde/giallo/rosso). M4 fatto: repo pubblico giovannialtamore00-create/sigaretta (ramo main), Pages via .github/workflows/deploy.yml come gli altri giochi, online su https://giovannialtamore00-create.github.io/sigaretta/ e scheda nella sezione Guest di Platypus. Prossimo: playtest di Giovanni su 2 dispositivi (verde/giallo/rosso), poi correzioni.
- M16 fatto: importate tutte le risposte del Form (tranne insulti razziali e la figlia del mafioso) e portate le frasi dei bot a ~30 per categoria (engine/data.ts). 48 test passano.
- M11-M13 fatti e pubblicati online: i giocatori inviano le proprie frasi a un Google Form (FORM_URL e FORM_ENTRY in web/main.ts; ogni invio è un JSON {easy:[7 liste], gram:[7 liste]}, una lista per slot); tasto "Scarica" dell'host tolto; le frasi vere vanno aggiunte a mano a BOT_PHRASES in engine/data.ts. 48 test passano.
- Risposte del Form (account galtamore.00@gmail.com, NON giovanni.altamore.00 che ha Drive pieno): foglio https://docs.google.com/spreadsheets/d/1-o5VOqmySAG4PkyQCNy8aeVAs9HtHbN8Ggquhn7CvZI/edit?gid=1490525833 . Leggerlo dal browser Playwright con ?authuser=1, via /export?format=csv&gid=1490525833. Già importate: la prima risposta vera (7 frasi easy).
- M10 fatto (non ancora pubblicato): carta stropicciata (pieghe morbide, righe sottili scure che seguono le pieghe, tinta grigio-calda) in web/paper.svg + web/style.css. Riferimento visivo: foto stock con filigrana, NON inclusa. `npm test` ogni tanto fallisce alla prima esecuzione ("3 failed, no tests"): rilanciare.
- M9 fatto e pubblicato online: sfondo = foto del tavolo fornita da Giovanni (web/table.jpg, al posto di table.svg), foglio sempre centrato con il posacenere a destra in parte sotto la carta, carta più dettagliata (fibre, luce, bordi ingialliti, spessore, fori forati). Prossimo: playtest di Giovanni (verde/giallo/rosso).
- M8 fatto (non ancora pubblicato): su telefono (<760 px) schermo bloccato sul foglio, 6 px di bordo di legno, niente posacenere, il foglio scorre da solo (web/style.css).
- M7 fatto e pubblicato online: tavolo di quercia scura con posacenere e sigaretta accesa, foglio 702 px, matita del timer che si consuma dalla punta (index.html, web/style.css, layoutDesk in web/main.ts). Su telefono il posacenere spunta solo dall'angolo. Prossimo: playtest di Giovanni (verde/giallo/rosso) e dire se serve più realismo.
- M5+M6 fatti e pubblicati online: stile quaderno a matita (DESIGN.md 8.1) in web/style.css, index.html, web/main.ts; suoni e musica lo-fi sintetizzati in web/audio.ts con volumi musica/effetti e muto salvati nel browser. Le schermate si ridisegnano solo se cambiano (prima un tocco poteva perdersi). Prossimo: playtest di Giovanni sul nuovo stile e audio (verde/giallo/rosso).
- Da confermare: espulso non rientra; i bot dell'host votano e rivelano; PEEK mostra "…" se il pezzo è vuoto. Voto: non rifinire.

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
- M5+M6 fatti (non ancora pubblicati): stile quaderno a matita (DESIGN.md 8.1) in web/style.css, index.html, web/main.ts; suoni e musica lo-fi sintetizzati in web/audio.ts con volumi musica/effetti e muto salvati nel browser. Le schermate si ridisegnano solo se cambiano (prima un tocco poteva perdersi). Prossimo: playtest di Giovanni sul nuovo stile e audio (verde/giallo/rosso), poi pubblicare (git push).
- Da confermare: espulso non rientra; i bot dell'host votano e rivelano; PEEK mostra "…" se il pezzo è vuoto. Voto: non rifinire.

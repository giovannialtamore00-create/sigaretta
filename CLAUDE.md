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
- Fase 1 (motore + test): fatta, 37 test passano.
- Fase 2 (P2P, niente Cloudflare): M2 fatto (net/host.ts). M3 fatto (net/peer.ts, web/, Vite: `npm run dev`; provata una partita completa in 3 schede; manca il playtest di Giovanni verde/giallo/rosso). M4 fatto: repo pubblico giovannialtamore00-create/sigaretta (ramo main), Pages via .github/workflows/deploy.yml come gli altri giochi, online su https://giovannialtamore00-create.github.io/sigaretta/ e scheda nella sezione Guest di Platypus. Prossimo: playtest di Giovanni su 2 dispositivi (verde/giallo/rosso), poi correzioni.
- Da confermare: espulso non rientra; i bot dell'host votano e rivelano; PEEK mostra "…" se il pezzo è vuoto. Voto: non rifinire.

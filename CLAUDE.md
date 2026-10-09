# SIGARETTA

Party game online di scrittura collettiva (italiano, telefoni prima). Stack: TypeScript, PeerJS (P2P, host = server), GitHub Pages, vitest.

## Rules
- Le regole di gioco in DESIGN.md non si cambiano senza conferma dell'autore.
- Il prototipo sigaretta.html è solo riferimento, non base di codice (non è salvato qui).
- Il motore (`engine/`) non dipende da Cloudflare e riceve l'ora come parametro.

## Commands
- `npm test` — test del motore. `npm run check` — controllo dei tipi.

## Docs
- DESIGN.md — regole, schermate, architettura. Leggere prima di toccare le regole.

## Status
- Fase 1 (motore + test): fatta, 37 test passano.
- Fase 2 (P2P, niente Cloudflare): M2 fatto (net/host.ts + test, host che esce = stanza chiusa). Prossimo: M3 interfaccia telefono + adattatore PeerJS (net/peer), poi M4 push GitHub (repo 'sigaretta', pubblico) e Pages.
- Da confermare: espulso non rientra; i bot dell'host votano e rivelano; PEEK mostra "…" se il pezzo è vuoto. Voto: non rifinire.

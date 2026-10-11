# SIGARETTA — Documento di design

Versione: ottobre 2026. Regole e architettura confermate dall'autore. Le regole di gioco (sezioni 2-8) non vanno cambiate senza chiedere conferma. Il prototipo `sigaretta.html` (non salvato nel progetto) è solo riferimento di comportamento; le frasi dei bot sono in `engine/data.ts`.

## 1. Concept
Party game online di scrittura collettiva, tipo "telefono senza fili" / "cadavere squisito". Ogni giocatore comincia una storia su un foglio virtuale; il foglio passa al giocatore alla sua destra, che aggiunge il pezzo successivo, e così via. Nessuno sa cosa c'è scritto davanti (o ne vede solo l'ultimo pezzo).
- Obiettivo: far ridere. Nessun punteggio.
- Giocatori: da 4 a 10 (i bot contano).
- Online, a stanze create da un host, nel browser (in futuro anche app dalla stessa pagina).
- Solo italiano. Interfaccia semplicissima, pensata per telefoni (testi grandi, pulsanti facili). Effetti sonori e musica di sottofondo, regolabili (sezione 8.1).
- Il nome "Sigaretta" è solo un nome: niente fumo né sigarette nella grafica.

## 2. Stanze e lobby
- Home: "Crea stanza" e "Entra con codice".
- Codice stanza: generato dal gioco, 5 caratteri, senza caratteri ambigui. Il nome della stanza è il codice.
- Ingresso: l'ospite scrive il codice (comunicato dall'host) e il suo nickname.
- Nickname: max 15 caratteri, unico nella lobby (senza distinzione maiuscole/minuscole). Se in uso: errore.
- Host: chi crea la stanza, segnato in lobby. Può scegliere modalità (EASY / GRAMMAR ADDICTED) e variante (BLIND / PEEK), avviare (solo con almeno 4 giocatori, bot inclusi), rimuovere un giocatore (solo in lobby), aggiungere/togliere bot.
- Massimo 10 giocatori, bot inclusi. L'undicesimo vede "Stanza piena".
- Si entra solo a partita non in corso: "Partita in corso, riprova a fine partita". Vale il rientro di chi era già dentro (sezione 6).
- Chi esce o perde la connessione in lobby resta segnato offline e viene tolto all'avvio.
- Un giocatore espulso non può rientrare nella stessa stanza con lo stesso dispositivo.
- Host disconnesso: il ruolo passa al primo giocatore (non bot) entrato. Se l'host originale rientra, è un giocatore normale.
- Stanza vuota: dopo un po' di inattività si chiude e il codice non vale più.
- Nessun filtro sulle parole; unico strumento di moderazione: espulsione in lobby.
- Più partite consecutive nella stessa lobby (vedi 7.3).

## 3. Modalità e varianti
Scelte dall'host prima dell'avvio, valgono per tutta la partita. Sempre 7 turni.

| Turno | EASY | GRAMMAR ADDICTED |
|---|---|---|
| 1 | Chi? | Soggetto |
| 2 | Cosa fa? | Apposizione |
| 3 | Come? | Verbo transitivo |
| 4 | Dove? | Complemento oggetto |
| 5 | Con chi? | Complemento di specificazione |
| 6 | Quando? | Complemento di modo |
| 7 | Perché? | Complemento di causa |

- BLIND: si scrive senza vedere i pezzi precedenti.
- PEEK: si vede solo l'ultimo pezzo dello stesso foglio (turno precedente). Se è vuoto si mostra "…".

## 4. Svolgimento
### 4.1 Fogli e rotazione
- N fogli quanti i giocatori. L'ordine dei posti è l'ordine di ingresso; **i bot dell'host siedono in posti a caso** (decisione dell'autore). Al turno t (0-6) il foglio s è in mano al posto (s+t) mod N.
- Con meno di 7 giocatori il foglio torna a chi ha già scritto. Con 7 o più, ogni foglio passa per 7 mani diverse.
- Dopo il turno 7 c'è un passaggio in più, di sola lettura: ognuno si ritrova con un foglio da rivelare.

### 4.2 Un turno
- Timer 40 secondi, deciso dal server. Tutti scrivono insieme, max 120 caratteri per pezzo.
- Allo scadere il testo passa così com'è, anche a metà o vuoto.
- "Pronto": si può annullare. Se tutti i giocatori connessi sono pronti si avanza subito; da quell'istante non si annulla più.
- Su tastiera, Invio = Pronto.

## 5. Bot
Due tipi di bot:
1. **Bot dell'host** ("+ Bot" / "− Bot" in lobby, "Bot 1", "Bot 2"…). Contano per il minimo 4 e per il massimo 10; non possono essere host. Scrivono subito una frase casuale dalla lista del turno (liste diverse per modalità), segnano Pronto dopo 10 secondi, votano a caso, e se tocca a loro rivelare i pezzi compaiono ogni 3 secondi.
2. **Bot sostituto** (vedi sezione 6): prende il posto di un giocatore assente.

## 6. Disconnessioni, bot sostituto e rientro
La partita non si interrompe. Appena un giocatore si disconnette o esce, il suo posto passa **subito** a un bot sostituto.
- Il bot sostituto scrive una frase casuale solo **all'ultimo secondo** di ogni turno, e solo se il giocatore non ha già scritto qualcosa; così, se il giocatore rientra, può scrivere le sue parole. Il testo già scritto dal giocatore prima di uscire resta.
- Il pezzo scritto dal bot sostituto è segnato come tale.
- Il bot sostituto non preme "Pronto" (non blocca e non accelera), non vota e non rivela. Se tocca a lui rivelare, rivela un altro giocatore connesso scelto a caso.
- Il giocatore riconosciuto dallo stesso dispositivo/browser, rientrando, si riprende il posto in qualsiasi momento.
- Con un dispositivo diverso o dati del browser cancellati è un nuovo giocatore: entra solo a partita non in corso.
- Se tutti gli umani sono assenti, la stanza si chiude dopo l'inattività.

## 7. Fine partita
### 7.1 Rivelazione
- Storie rivelate una alla volta, in ordine casuale, ognuna da chi ha quel foglio dopo il passaggio finale.
- Schermata: "Storia X di N" e chi rivela. I pezzi compaiono dal primo all'ultimo, uno per click di chi rivela; dopo l'ultimo, un click passa alla storia successiva.
- Accanto a ogni pezzo: turno, criterio, autore. Pezzo vuoto = "…".
- Dopo 15 secondi senza click, il pezzo successivo compare da solo.
- Se chi deve rivelare è assente (bot sostituto), rivela un altro giocatore connesso a caso.

### 7.2 Voto
- Dopo l'ultima storia, ognuno vota la storia più divertente (goliardico, nessun punteggio). Storie indicate col numero, in forma compatta e apribili. Un voto a testa, cambiabile finché non si chiude; anonimo, si vede solo quanti hanno votato. Nessuna restrizione sulle storie votabili.
- Si chiude quando tutti i connessi hanno votato o dopo 30 secondi. Votano i giocatori connessi e i bot dell'host; i bot sostituti non votano.
- Meccanica secondaria: non va rifinita oltre.

### 7.3 Pagina finale
- Si mostra la storia più votata, completa. Pareggio o zero voti: una storia a caso tra quelle a pari merito (zero voti: tra tutte).
- **Ogni giocatore torna alla lobby per conto suo** con il proprio pulsante. Il primo che torna riapre la lobby (e diventa host se l'host non è ancora tornato). Chi è ancora sulla pagina finale resta fuori dalla partita successiva.

## 8. Interfaccia
Mouse e tastiera su desktop, touch su telefono; si progetta prima per i telefoni.
- Home: "Crea stanza" / "Entra con codice".
- Ingresso: nickname (max 15), codice stanza; errore se il nickname è in uso.
- Lobby: codice e pulsante per copiare il link d'invito; elenco giocatori (host, bot, offline, "n/10"); solo host: modalità, variante, "+ Bot" / "− Bot", rimozione, "Avvia" attivo da 4.
- Scrittura: "Turno X/7", domanda, timer 40s; in PEEK il pezzo precedente; campo con contatore (max 120); "Pronto" / "Annulla pronto"; elenco giocatori con segno su chi è pronto.
- Rivelazione, Voto (timer 30s), Fine partita: come in sezione 7.

### 8.1 Stile (direzione artistica)
**Un'idea sola: un quaderno a righe scarabocchiato a matita, passato di mano in mano.** Tutte le schermate seguono questo stile, nessuna esclusa.
- **Tavolo:** il foglio è appoggiato su un tavolo di quercia scura visto dall'alto (assi, venature, luce calda). Accanto c'è un posacenere di ceramica con una sigaretta accesa (brace che pulsa, fumo che sale), disegnato in SVG in modo semi-realistico; la sua area è il 25% di quella del foglio. Su telefono il foglio occupa tutta la larghezza e il posacenere spunta solo dall'angolo.
- **Foglio:** largo 702 px su schermo grande (prima 540). Sfondo e materiali: carta da quaderno a righe azzurre con margine rosso, bianco caldo, grana leggera, bordi un po' consumati. I pannelli sono fogli strappati o piegati; il foglio di ogni storia è un foglio arrotolato/piegato che passa al vicino.
- **Tratto:** disegnato a matita, linee sketchy e un po' storte (bordi doppi, non perfetti). Pulsanti come riquadri disegnati a mano con tratteggio a matita; scarabocchi e doodle (stelline, frecce, spirali, faccine) negli angoli vuoti. Tutto disegnato in codice (SVG/CSS), nessun file immagine.
- **Colori:** grafite (grigio scuro) per testo e tratti, azzurro delle righe, rosso del margine; un solo colore d'accento tipo evidenziatore giallo per l'azione principale.
- **Font:** stile fumetto/scritto a mano, ben leggibile su telefono e con le lettere accentate. Font con licenza libera, incluso nel sito.
- **Momenti da curare:**
  - Invio del pezzo ("Pronto"): il foglio si piega/arrotola e scivola via verso destra.
  - Rivelazione: ogni pezzo compare come se venisse scritto a matita.
  - Timer: una matita che si consuma dalla punta (la gomma resta ferma); negli ultimi 10 secondi trema.
  - Pulsanti: alla pressione si "schiacciano" come carta.
  - Voto: la storia scelta viene cerchiata a matita.
- **Suoni:** effetti di carta e matita (foglio che si piega, scarabocchio, pagina girata, gomma), generati in codice. Musica di sottofondo lo-fi rilassata in loop, generata in codice.
- **Impostazioni audio:** volume musica e volume effetti separati (con muto), raggiungibili da ogni schermata, ricordati dal browser. Musica parte solo dopo il primo tocco (regola dei browser).
- **Telefoni prima:** testi grandi e leggibili, l'effetto disegnato non deve mai rendere il testo difficile da leggere.

## 9. Architettura
- Peer-to-peer con PeerJS (decisione dell'autore, ottobre 2026): il browser dell'host fa da server. Esegue `engine/` (arbitro: timer, turni, rotazione, pronto, voti, rientri, bot) tramite `net/host.ts`. Il codice stanza è l'ID PeerJS dell'host. Niente Cloudflare.
- L'host controlla tutto: lunghezza, massimo giocatori, nickname unici; solo l'host avvia, cambia modalità/variante, gestisce bot, espelle.
- L'host invia a ogni giocatore solo ciò che può vedere (BLIND nessun pezzo precedente, PEEK solo l'ultimo). Il browser dell'host vede tutto: accettato.
- **Host che esce = stanza chiusa** (cambia il passaggio host di §2: con P2P nessun altro ha lo stato). Gli altri vedono "Host disconnesso". I giocatori che cadono possono rientrare finché l'host resta.
- Client: pagina web statica per telefoni, nessuna logica di gioco; ospitata su GitHub Pages.
- TypeScript ovunque; il motore delle regole è un modulo indipendente (`engine/`), testabile da solo.
- Link pubblico, nessun account. Nessun salvataggio delle storie. Rientro tramite identificativo salvato nel browser.
- Verso l'app: la stessa pagina web, prima installabile dal browser.
- Test automatici: meno di 7 giocatori, disconnessioni e rientri, pareggi, revealer assente, "pronto" annullato mentre scatta l'avanzamento; rete: nessun pezzo nascosto arriva al client sbagliato.
- Solo italiano, nessuna analitica.

## 10. Prototipo (sigaretta.html)
Riferimento di comportamento; limiti da NON replicare: tutti ricevono tutto, niente espulsione né passaggio host.

## 11. Decisioni prese
- Ritorno alla lobby: ognuno per conto suo.
- I bot rientrano nel massimo di 10.
- Nessun voto: storia a caso.
- Codice stanza: 5 caratteri (da confermare vedendolo).
- Posti dei bot: a caso.
- Bot sostituto: vedi sezione 6 (sostituzione immediata, scrive all'ultimo secondo, non vota, non rivela).
- Assunte dall'assistente, da confermare: espulso non rientra; i bot dell'host continuano a votare e rivelare; in PEEK un pezzo vuoto si mostra "…".

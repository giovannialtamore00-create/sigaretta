import { describe, expect, it } from 'vitest';
import { Game, TURN_MS, VOTE_MS, REVEAL_MS, REVEAL_BOT_MS, type Variant } from './game';

// rng deterministico
function seeded(seed = 1) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Stanza con n umani (u1..un) più b bot, partita avviata a t=0. */
function started(n: number, b = 0, variant: Variant = 'blind') {
  const g = new Game(seeded(7));
  for (let i = 1; i <= n; i++) expect(g.join('u' + i, 'Utente' + i)).toEqual({ ok: true });
  for (let i = 0; i < b; i++) g.addBot('u1');
  g.config('u1', 'easy', variant);
  expect(g.start('u1', 0)).toEqual({ ok: true });
  return g;
}
/** Tutti gli umani connessi scrivono e premono Pronto: il turno avanza subito. */
function playTurn(g: Game, now: number) {
  for (const id of g.seats) {
    const p = g.players.find((q) => q.id === id)!;
    if (!p.bot && p.online) {
      g.setText(id, g.turn, `${id}-t${g.turn}`);
      g.setReady(id, true, now);
    }
  }
}
function toReveal(g: Game, now = 1000) {
  for (let t = 0; t < 7; t++) playTurn(g, now);
  expect(g.phase).toBe('reveal');
}

describe('lobby', () => {
  it('nickname unico senza distinzione maiuscole, max 15 caratteri', () => {
    const g = new Game();
    g.join('a', 'Marco');
    expect(g.join('b', 'MARCO')).toEqual({ ok: false, error: 'Nickname già in uso.' });
    g.join('c', 'abcdefghijklmnopqrstuvwxyz');
    expect(g.players[1].nick).toHaveLength(15);
  });
  it('undicesimo giocatore: stanza piena', () => {
    const g = new Game();
    for (let i = 0; i < 10; i++) g.join('u' + i, 'N' + i);
    expect(g.join('x', 'Extra')).toEqual({ ok: false, error: 'Stanza piena.' });
  });
  it('i bot rientrano nel massimo di 10', () => {
    const g = new Game();
    g.join('h', 'Host');
    for (let i = 0; i < 9; i++) expect(g.addBot('h').ok).toBe(true);
    expect(g.addBot('h').ok).toBe(false);
  });
  it('avvio solo da 4 (bot inclusi) e solo l\'host', () => {
    const g = new Game();
    g.join('a', 'A'); g.join('b', 'B'); g.join('c', 'C');
    expect(g.start('a', 0).ok).toBe(false);
    g.addBot('a');
    expect(g.start('b', 0).ok).toBe(false);
    expect(g.start('a', 0).ok).toBe(true);
  });
  it('solo l\'host cambia modalità, aggiunge bot ed espelle; l\'espulso non rientra', () => {
    const g = new Game();
    g.join('a', 'A'); g.join('b', 'B');
    expect(g.config('b', 'gram', 'peek').ok).toBe(false);
    expect(g.addBot('b').ok).toBe(false);
    expect(g.kick('b', 'a').ok).toBe(false);
    expect(g.kick('a', 'b').ok).toBe(true);
    expect(g.join('b', 'B')).toEqual({ ok: false, error: 'Sei stato espulso da questa stanza.' });
  });
  it('chi arriva a partita iniziata viene rifiutato', () => {
    const g = started(4);
    expect(g.join('nuovo', 'Nuovo')).toEqual({ ok: false, error: 'Partita in corso, riprova a fine partita.' });
  });
  it('host disconnesso: passa al primo umano entrato; se rientra è un giocatore normale', () => {
    const g = new Game();
    g.join('a', 'A'); g.join('b', 'B'); g.join('c', 'C');
    g.setConnected('a', false, 0);
    expect(g.hostId).toBe('b');
    g.setConnected('a', true, 0);
    expect(g.hostId).toBe('b');
  });
  it('chi è offline in lobby viene tolto all\'avvio', () => {
    const g = new Game();
    ['a', 'b', 'c', 'd', 'e'].forEach((i) => g.join(i, i.toUpperCase()));
    g.setConnected('e', false, 0);
    g.start('a', 0);
    expect(g.seats).not.toContain('e');
  });
});

describe('rotazione dei fogli', () => {
  it('con 4 giocatori il foglio torna a chi ha già scritto', () => {
    const g = started(4);
    toReveal(g);
    for (const sheet of g.sheets) {
      const authors = sheet.map((p) => p.author);
      expect(authors).toHaveLength(7);
      expect(new Set(authors).size).toBe(4);
    }
  });
  it('con 7 o più giocatori ogni foglio passa per 7 mani diverse', () => {
    const g = started(8);
    toReveal(g);
    for (const sheet of g.sheets) expect(new Set(sheet.map((p) => p.author)).size).toBe(7);
  });
  it('il foglio s al turno t è in mano al posto (s+t) mod N', () => {
    const g = started(5);
    toReveal(g);
    g.sheets.forEach((sheet, s) =>
      sheet.forEach((p, t) => {
        const holder = g.players.find((q) => q.id === g.seats[(s + t) % 5])!;
        expect(p.author).toBe(holder.nick);
      }),
    );
  });
  it('i bot siedono in posti a caso, gli umani restano in ordine di ingresso', () => {
    const g = started(5, 3);
    expect(g.seats.filter((s) => s.startsWith('u'))).toEqual(['u1', 'u2', 'u3', 'u4', 'u5']);
    expect(g.seats).toHaveLength(8);
  });
});

describe('turno', () => {
  it('Pronto di tutti fa avanzare subito; annullare prima impedisce l\'avanzamento', () => {
    const g = started(4);
    ['u1', 'u2', 'u3'].forEach((id) => g.setReady(id, true, 5));
    g.setReady('u3', false, 6);
    g.setReady('u4', true, 7);
    expect(g.turn).toBe(0);
    g.setReady('u3', true, 8);
    expect(g.turn).toBe(1);
  });
  it('annullare "pronto" dopo che il turno è già avanzato non rompe nulla', () => {
    const g = started(4);
    ['u1', 'u2', 'u3', 'u4'].forEach((id) => g.setReady(id, true, 5));
    expect(g.turn).toBe(1);
    expect(g.setReady('u1', false, 5).ok).toBe(true);
    expect(g.turn).toBe(1);
    expect(g.ready.size).toBe(0);
  });
  it('allo scadere il testo passa com\'è, anche vuoto o a metà', () => {
    const g = started(4);
    g.setText('u1', 0, 'Un pira');
    g.tick(TURN_MS);
    expect(g.turn).toBe(1);
    expect(g.sheets[0][0].text).toBe('Un pira');
    expect(g.sheets[1][0].text).toBe('');
  });
  it('120 caratteri al massimo; testo di un turno vecchio ignorato', () => {
    const g = started(4);
    g.setText('u1', 0, 'x'.repeat(500));
    expect(g.tx.get('u1')).toHaveLength(120);
    g.tick(TURN_MS);
    expect(g.setText('u1', 0, 'tardi').ok).toBe(false);
  });
  it('i bot dell\'host scrivono subito e sono pronti dopo 10 secondi', () => {
    const g = started(3, 1);
    ['u1', 'u2', 'u3'].forEach((id) => g.setReady(id, true, 1000));
    expect(g.turn).toBe(0);
    g.tick(10000);
    expect(g.turn).toBe(1);
    expect(g.sheets.flat().some((p) => p.author === 'Bot 1' && p.text !== '')).toBe(true);
  });
});

describe('visibilità', () => {
  it('BLIND: nessun pezzo precedente', () => {
    const g = started(4, 0, 'blind');
    playTurn(g, 1);
    expect(g.view('u1', 2)).toMatchObject({ turn: 2, prev: null });
  });
  it('PEEK: solo l\'ultimo pezzo dello stesso foglio', () => {
    const g = started(4, 0, 'peek');
    playTurn(g, 1);
    playTurn(g, 2);
    const v = g.view('u1', 3) as any;
    const seat = g.seats.indexOf('u1');
    const s = (((seat - 2) % 4) + 4) % 4;
    expect(v.prev).toBe(g.sheets[s][1].text);
    expect(JSON.stringify(v)).not.toContain(g.sheets[s][0].text);
  });
  it('in scrittura nessuno riceve i fogli completi', () => {
    const g = started(4, 0, 'peek');
    playTurn(g, 1);
    expect((g.view('u1', 2) as any).stories).toBeUndefined();
  });
});

describe('disconnessione e bot sostituto', () => {
  it('un giocatore assente non blocca gli altri', () => {
    const g = started(4);
    g.setConnected('u4', false, 1);
    ['u1', 'u2', 'u3'].forEach((id) => g.setReady(id, true, 2));
    expect(g.turn).toBe(1);
  });
  it('il bot sostituto scrive solo all\'ultimo secondo e il pezzo è marcato bot', () => {
    const g = started(4);
    g.setConnected('u4', false, 1);
    g.tick(20000);
    expect(g.tx.get('u4')).toBeUndefined();
    g.tick(TURN_MS - 500);
    g.tick(TURN_MS);
    expect(g.sheets[g.seats.indexOf('u4')][0].text).not.toBe('');
    expect(g.sheets[g.seats.indexOf('u4')][0].bot).toBe(true);
  });
  it('il testo già scritto prima di uscire non viene sovrascritto', () => {
    const g = started(4);
    g.setText('u4', 0, 'mio testo');
    g.setConnected('u4', false, 1);
    g.tick(TURN_MS - 500);
    g.tick(TURN_MS);
    expect(g.sheets[g.seats.indexOf('u4')][0]).toMatchObject({ text: 'mio testo', bot: false });
  });
  it('se rientra a metà turno scrive le sue parole e il bot non interviene', () => {
    const g = started(4);
    g.setConnected('u4', false, 1);
    g.setConnected('u4', true, 5000);
    g.setText('u4', 0, 'ci sono io');
    g.tick(TURN_MS - 500);
    g.tick(TURN_MS);
    expect(g.sheets[g.seats.indexOf('u4')][0]).toMatchObject({ text: 'ci sono io', bot: false });
  });
  it('se rientra dopo che il bot ha scritto può comunque cambiare il testo', () => {
    const g = started(5);
    g.setConnected('u5', false, 1);
    g.tick(TURN_MS - 500);
    expect(g.tx.get('u5')).toBeTruthy();
    g.setConnected('u5', true, TURN_MS - 400);
    g.setText('u5', 0, 'torno');
    g.tick(TURN_MS);
    expect(g.sheets[g.seats.indexOf('u5')][0]).toMatchObject({ text: 'torno', bot: false });
  });
  it('rientra nei turni successivi e riprende il suo posto', () => {
    const g = started(4);
    g.setConnected('u4', false, 1);
    g.tick(TURN_MS);
    g.setConnected('u4', true, TURN_MS + 10);
    expect(g.setText('u4', 1, 'di nuovo qui').ok).toBe(true);
    expect(g.view('u4', TURN_MS + 20)).toMatchObject({ turn: 2 });
  });
  it('se tutti i presenti sono pronti e l\'ultimo si disconnette, si avanza', () => {
    const g = started(4);
    ['u1', 'u2', 'u3'].forEach((id) => g.setReady(id, true, 2));
    expect(g.turn).toBe(0);
    g.setConnected('u4', false, 3);
    expect(g.turn).toBe(1);
  });
  it('chi è stato espulso o ha un id nuovo non entra a partita in corso', () => {
    const g = started(4);
    expect(g.join('altro-dispositivo', 'Utente4').ok).toBe(false);
  });
});

describe('rivelazione', () => {
  it('ogni storia la rivela chi ha il foglio dopo il passaggio finale; i pezzi arrivano uno a click', () => {
    const g = started(4);
    toReveal(g);
    const v0 = g.view('u1', 2000) as any;
    expect(v0.pieces).toHaveLength(0);
    const rev = g.revealer!;
    expect(rev).toBe(g.seats[(g.order[0] + 7) % 4]);
    expect(g.next('u' + (rev === 'u1' ? 2 : 1), 2000).ok).toBe(false);
    g.next(rev, 2001);
    expect((g.view(rev, 2002) as any).pieces).toHaveLength(1);
    for (let i = 0; i < 7; i++) g.next(rev, 2003);
    expect(g.ri).toBe(1);
  });
  it('dopo 15 secondi senza click il pezzo compare da solo', () => {
    const g = started(4);
    toReveal(g, 1000);
    g.tick(1000 + REVEAL_MS - 1);
    expect(g.shown).toBe(0);
    g.tick(1000 + REVEAL_MS);
    expect(g.shown).toBe(1);
  });
  it('se chi deve rivelare è disconnesso, rivela un altro umano connesso', () => {
    const g = started(4);
    toReveal(g);
    const intended = g.seats[(g.order[0] + 7) % 4];
    g.setConnected(intended, false, 1500);
    expect(g.revealer).not.toBe(intended);
    expect(g.revealer).not.toBeNull();
    expect(g.players.find((p) => p.id === g.revealer)!.online).toBe(true);
  });
  it('se tocca a un bot dell\'host, i pezzi compaiono ogni 3 secondi', () => {
    const g = new Game(seeded(3));
    ['a', 'b', 'c'].forEach((i) => g.join(i, i.toUpperCase()));
    g.addBot('a');
    g.start('a', 0);
    for (let t = 0; t < 7; t++) g.tick((t + 1) * TURN_MS);
    expect(g.phase).toBe('reveal');
    let guard = 0;
    while (g.revealer !== 'bot-1' && g.phase === 'reveal' && guard++ < 200) {
      g.tick(g.lastAdv + REVEAL_MS);
    }
    expect(g.revealer).toBe('bot-1');
    const s = g.shown;
    g.tick(g.lastAdv + REVEAL_BOT_MS);
    expect(g.shown).toBe(s + 1);
  });
});

describe('voto e fine partita', () => {
  function toVote(g: Game) {
    toReveal(g, 1000);
    let t = 1000;
    let guard = 0;
    while (g.phase === 'reveal' && guard++ < 500) {
      t += REVEAL_MS;
      g.tick(t);
    }
    expect(g.phase).toBe('vote');
    return t;
  }
  it('voto cambiabile, anonimo, si chiude quando tutti i connessi hanno votato', () => {
    const g = started(4);
    const t = toVote(g);
    g.vote('u1', 1, t); g.vote('u1', 2, t);
    g.vote('u2', 2, t); g.vote('u3', 2, t);
    expect(g.phase).toBe('vote');
    expect((g.view('u1', t) as any).myVote).toBe(2);
    expect((g.view('u1', t) as any).voted).toBe(3);
    g.vote('u4', 3, t);
    expect(g.phase).toBe('end');
    expect((g.view('u1', t) as any).storyNo).toBe(2);
  });
  it('i disconnessi non votano e non bloccano', () => {
    const g = started(4);
    const t = toVote(g);
    g.setConnected('u4', false, t);
    ['u1', 'u2', 'u3'].forEach((id) => g.vote(id, 1, t));
    expect(g.phase).toBe('end');
  });
  it('dopo 30 secondi il voto si chiude; pareggio e zero voti scelgono una storia', () => {
    const g = started(4);
    const t = toVote(g);
    g.vote('u1', 1, t); g.vote('u2', 2, t);
    g.tick(t + VOTE_MS);
    expect(g.phase).toBe('end');
    expect([1, 2]).toContain((g.view('u1', t) as any).storyNo);
    const h = started(4);
    const t2 = toVote(h);
    h.tick(t2 + VOTE_MS);
    expect(h.phase).toBe('end');
    expect((h.view('u1', t2) as any).pieces).toHaveLength(7);
  });
  it('i bot dell\'host votano a caso', () => {
    const g = started(3, 1);
    for (let k = 1; k <= 7; k++) g.tick(k * TURN_MS);
    expect(g.phase).toBe('reveal');
    let t = 7 * TURN_MS, guard = 0;
    while (g.phase === 'reveal' && guard++ < 500) { t += REVEAL_MS; g.tick(t); }
    g.tick(t);
    expect(g.votes.has('bot-1')).toBe(true);
  });
  it('ognuno torna alla lobby per conto suo; gli altri restano fuori dalla partita dopo', () => {
    const g = started(5);
    const t = toVote(g);
    g.tick(t + VOTE_MS);
    expect(g.phase).toBe('end');
    g.backToLobby('u2');
    expect(g.phase).toBe('lobby');
    expect(g.hostId).toBe('u2');
    g.backToLobby('u3'); g.backToLobby('u4'); g.backToLobby('u5');
    expect(g.start('u2', t).ok).toBe(true); // u1 non è tornato: resta fuori
    expect(g.seats).not.toContain('u1');
  });
});

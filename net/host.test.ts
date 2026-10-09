import { describe, expect, it } from 'vitest';
import { HostSession, type Conn } from './host';

function seeded(seed = 3) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Giocatore finto: tiene l'ultima view e gli errori ricevuti. */
class Fake implements Conn {
  view: any = null;
  errors: string[] = [];
  kicked = false;
  all: string[] = []; // tutto ciò che ha ricevuto, serializzato
  constructor(public token: string, public nick: string) {}
  send(msg: any) {
    this.all.push(JSON.stringify(msg));
    if (msg.t === 'view') this.view = msg.view;
    else if (msg.t === 'error') this.errors.push(msg.error);
    else if (msg.t === 'kicked') this.kicked = true;
  }
}

function room(n: number) {
  const h = new HostSession(seeded());
  const ps = Array.from({ length: n }, (_, i) => new Fake('tok' + i, 'P' + i));
  for (const p of ps) h.onMessage(p, { t: 'join', token: p.token, nick: p.nick }, 0);
  return { h, ps };
}

describe('HostSession', () => {
  it('i giocatori entrano e vedono la lobby, il primo è host', () => {
    const { ps } = room(4);
    expect(ps[0].view.isHost).toBe(true);
    expect(ps[3].view.isHost).toBe(false);
    expect(ps[3].view.players).toHaveLength(4);
  });

  it('chi non è entrato viene ignorato; solo l\'host avvia', () => {
    const { h, ps } = room(4);
    const ghost = new Fake('x', 'X');
    h.onMessage(ghost, { t: 'start' }, 0);
    expect(ghost.all).toHaveLength(0);
    h.onMessage(ps[1], { t: 'start' }, 0);
    expect(ps[1].errors).toHaveLength(1);
    expect(ps[1].view.phase).toBe('lobby');
  });

  it('messaggi malformati non rompono nulla', () => {
    const { h, ps } = room(4);
    for (const bad of [null, 5, 'x', {}, { t: 7 }, { t: 'boom' }]) h.onMessage(ps[0], bad, 0);
    expect(ps[0].view.phase).toBe('lobby');
  });

  it('partita completa con 4 giocatori fino alla fine, un pezzo nascosto non arriva mai al client sbagliato', () => {
    const { h, ps } = room(4);
    h.onMessage(ps[0], { t: 'config', mode: 'easy', variant: 'blind' }, 0);
    h.onMessage(ps[0], { t: 'start' }, 0);
    expect(ps[0].view.phase).toBe('write');
    let now = 0;
    for (let t = 1; t <= 7; t++) {
      now += 1000;
      for (const p of ps) {
        // BLIND: nessun pezzo precedente
        expect(p.view.prev).toBeNull();
        h.onMessage(p, { t: 'text', turn: p.view.turn - 1, text: `segreto-${p.token}-${t}` }, now);
        h.onMessage(p, { t: 'ready', v: true }, now);
      }
    }
    expect(ps[0].view.phase).toBe('reveal');
    // durante la scrittura nessuno ha mai ricevuto il testo di un altro
    for (const p of ps) {
      const writing = p.all.map((s) => JSON.parse(s)).filter((m) => m.t === 'view' && m.view.phase === 'write');
      for (const m of writing) {
        for (const other of ps.filter((o) => o !== p)) {
          expect(JSON.stringify(m)).not.toContain(`segreto-${other.token}`);
        }
      }
    }
    // rivelazione, voto, fine
    for (let i = 0; i < 40 && ps[0].view.phase === 'reveal'; i++) {
      now += 20000;
      h.tick(now);
    }
    expect(ps[0].view.phase).toBe('vote');
    for (const p of ps) h.onMessage(p, { t: 'vote', n: 1 }, now);
    expect(ps[0].view.phase).toBe('end');
    expect(ps[2].view.pieces.length).toBe(7);
  });

  it('PEEK mostra solo l\'ultimo pezzo', () => {
    const { h, ps } = room(4);
    h.onMessage(ps[0], { t: 'config', mode: 'easy', variant: 'peek' }, 0);
    h.onMessage(ps[0], { t: 'start' }, 0);
    for (const p of ps) {
      h.onMessage(p, { t: 'text', turn: 0, text: 'uno-' + p.token }, 1);
      h.onMessage(p, { t: 'ready', v: true }, 1);
    }
    expect(ps[0].view.turn).toBe(2);
    expect(ps[0].view.prev).toMatch(/^uno-tok/);
    expect(ps[0].view.prev).not.toBe('uno-tok0'); // non il proprio
  });

  it('disconnessione e rientro con lo stesso token riprende il posto', () => {
    const { h, ps } = room(4);
    h.onMessage(ps[0], { t: 'start' }, 0);
    h.onClose(ps[2], 5);
    expect(ps[0].view.players.find((p: any) => p.id === 'tok2').online).toBe(false);
    const again = new Fake('tok2', 'P2');
    h.onMessage(again, { t: 'join', token: 'tok2', nick: 'P2' }, 6);
    expect(again.view.players.find((p: any) => p.id === 'tok2').online).toBe(true);
    expect(again.view.phase).toBe('write');
  });

  it('un nuovo dispositivo a partita in corso viene rifiutato', () => {
    const { h, ps } = room(4);
    h.onMessage(ps[0], { t: 'start' }, 0);
    const late = new Fake('nuovo', 'Tardi');
    h.onMessage(late, { t: 'join', token: 'nuovo', nick: 'Tardi' }, 1);
    expect(late.errors).toHaveLength(1);
  });

  it('espulso: avvisato e non può rientrare', () => {
    const { h, ps } = room(4);
    h.onMessage(ps[0], { t: 'kick', id: 'tok3' }, 0);
    expect(ps[3].kicked).toBe(true);
    const again = new Fake('tok3', 'P3');
    h.onMessage(again, { t: 'join', token: 'tok3', nick: 'P3' }, 1);
    expect(again.errors).toHaveLength(1);
    expect(ps[0].view.players).toHaveLength(3);
  });

  it('bot dell\'host: con 3 umani + 1 bot si può avviare', () => {
    const { h, ps } = room(3);
    h.onMessage(ps[0], { t: 'addBot' }, 0);
    h.onMessage(ps[0], { t: 'start' }, 0);
    expect(ps[0].view.phase).toBe('write');
  });
});

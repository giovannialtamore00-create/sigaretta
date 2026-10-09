import { Game, type Rng, type Res } from '../engine/game';

/** Una connessione verso un giocatore (nel browser è una DataConnection di PeerJS). */
export interface Conn {
  send(msg: unknown): void;
}

/** Messaggi che i giocatori mandano all'host. */
export type ClientMsg =
  | { t: 'join'; token: string; nick: string }
  | { t: 'text'; turn: number; text: string }
  | { t: 'ready'; v: boolean }
  | { t: 'config'; mode: 'easy' | 'gram'; variant: 'blind' | 'peek' }
  | { t: 'start' }
  | { t: 'kick'; id: string }
  | { t: 'addBot' }
  | { t: 'removeBot' }
  | { t: 'next' }
  | { t: 'vote'; n: number }
  | { t: 'back' }
  | { t: 'leave' };

/**
 * L'host fa da server: tiene il Game, controlla ogni messaggio e manda a ognuno
 * solo la sua view. L'identità del giocatore è il token salvato nel browser.
 * L'ora arriva sempre dal chiamante (`now`).
 */
export class HostSession {
  readonly game: Game;
  private byConn = new Map<Conn, string>(); // connessione -> token
  private byToken = new Map<string, Conn>();

  constructor(rng?: Rng) {
    this.game = new Game(rng);
  }

  onMessage(conn: Conn, raw: unknown, now: number) {
    const m = raw as Partial<ClientMsg> | null;
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    if (m.t === 'join') return this.join(conn, m as ClientMsg & { t: 'join' }, now);
    const id = this.byConn.get(conn);
    if (!id) return; // chi non è entrato non può fare altro
    const g = this.game;
    let r: Res = { ok: true };
    switch (m.t) {
      case 'text': r = g.setText(id, Number(m.turn), String(m.text ?? '')); break;
      case 'ready': r = g.setReady(id, m.v === true, now); break;
      case 'config': r = g.config(id, m.mode as 'easy' | 'gram', m.variant as 'blind' | 'peek'); break;
      case 'start': r = g.start(id, now); break;
      case 'kick': r = g.kick(id, String(m.id)); this.dropToken(String(m.id)); break;
      case 'addBot': r = g.addBot(id); break;
      case 'removeBot': r = g.removeBot(id); break;
      case 'next': r = g.next(id, now); break;
      case 'vote': r = g.vote(id, Number(m.n), now); break;
      case 'back': r = g.backToLobby(id); break;
      case 'leave': r = g.leave(id, now); this.detach(conn); break;
      default: return;
    }
    if (!r.ok) conn.send({ t: 'error', error: r.error });
    this.broadcast(now);
  }

  onClose(conn: Conn, now: number) {
    const id = this.byConn.get(conn);
    if (!id) return;
    this.detach(conn);
    this.game.setConnected(id, false, now);
    this.broadcast(now);
  }

  tick(now: number) {
    this.game.tick(now);
    this.broadcast(now);
  }

  private join(conn: Conn, m: { token: unknown; nick: unknown }, now: number) {
    const token = typeof m.token === 'string' ? m.token.slice(0, 64) : '';
    if (!token) return conn.send({ t: 'error', error: 'Identificativo mancante.' });
    const r = this.game.join(token, String(m.nick ?? ''));
    if (!r.ok) return conn.send({ t: 'error', error: r.error });
    const old = this.byToken.get(token);
    if (old && old !== conn) this.byConn.delete(old); // stesso dispositivo che rientra
    this.byConn.set(conn, token);
    this.byToken.set(token, conn);
    this.game.setConnected(token, true, now);
    this.broadcast(now);
  }

  private detach(conn: Conn) {
    const id = this.byConn.get(conn);
    this.byConn.delete(conn);
    if (id && this.byToken.get(id) === conn) this.byToken.delete(id);
  }

  private dropToken(id: string) {
    const c = this.byToken.get(id);
    if (!c) return;
    c.send({ t: 'kicked' });
    this.byConn.delete(c);
    this.byToken.delete(id);
  }

  private broadcast(now: number) {
    for (const [conn, id] of this.byConn) conn.send({ t: 'view', view: this.game.view(id, now) });
  }
}

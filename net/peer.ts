import Peer, { type DataConnection } from 'peerjs';
import { HostSession, type ClientMsg, type Conn } from './host';
import { makeCode, normalizeCode, peerId } from './code';

export type View = Record<string, any>;

export interface Handlers {
  onView(v: View): void;
  /** errore dall'host, espulsione o chiusura della stanza */
  onEvent(e: { t: 'error'; error: string } | { t: 'kicked' } | { t: 'closed' }): void;
}

export interface Room {
  code: string;
  send(msg: ClientMsg): void;
  /** Solo nel browser che ha creato la stanza: le parole scritte dagli umani, come JSON. */
  exportWords?(): string;
}

const TICK_MS = 500;
const SILENCE_MS = 6000; // nessun messaggio per tanto = connessione persa

function dispatch(msg: any, h: Handlers) {
  if (msg?.t === 'view') h.onView(msg.view);
  else if (msg?.t === 'error') h.onEvent({ t: 'error', error: String(msg.error) });
  else if (msg?.t === 'kicked') h.onEvent({ t: 'kicked' });
}

/** Crea la stanza: questo browser è l'host e gioca anche lui (connessione locale). */
export function createRoom(token: string, nick: string, h: Handlers): Promise<Room> {
  const session = new HostSession();
  const local: Conn = { send: (m) => dispatch(m, h) };
  return new Promise((resolve, reject) => {
    const attempt = (left: number) => {
      const code = makeCode();
      const peer = new Peer(peerId(code));
      peer.on('error', (err: any) => {
        if (err.type === 'unavailable-id' && left > 0) {
          peer.destroy();
          attempt(left - 1);
        } else reject(new Error(err.type === 'unavailable-id' ? 'Codice occupato, riprova.' : 'Connessione al server fallita.'));
      });
      peer.on('open', () => {
        peer.on('error', () => {}); // errori successivi: ignorati
        peer.on('connection', (dc: DataConnection) => {
          const conn: Conn = { send: (m) => dc.open && dc.send(m) };
          let last = Date.now();
          let gone = false;
          const drop = () => { if (!gone) { gone = true; clearInterval(watch); session.onClose(conn, Date.now()); } };
          const watch = setInterval(() => { if (Date.now() - last > SILENCE_MS) { drop(); dc.close(); } }, 1000);
          dc.on('data', (d) => { last = Date.now(); session.onMessage(conn, d, last); });
          dc.on('close', drop);
        });
        setInterval(() => session.tick(Date.now()), TICK_MS);
        const send = (m: ClientMsg) => session.onMessage(local, m, Date.now());
        resolve({ code, send, exportWords: () => JSON.stringify(session.game.wordLog, null, 1) });
        setTimeout(() => send({ t: 'join', token, nick }), 0); // dopo che il chiamante ha ricevuto la stanza
      });
    };
    attempt(5);
  });
}

/** Entra in una stanza esistente. Il primo errore (es. nickname in uso) arriva da onEvent. */
export function joinRoom(codeRaw: string, token: string, nick: string, h: Handlers): Promise<Room> {
  const code = normalizeCode(codeRaw);
  const peer = new Peer();
  return new Promise((resolve, reject) => {
    peer.on('error', (err: any) =>
      reject(new Error(err.type === 'peer-unavailable' ? 'Stanza non trovata.' : 'Connessione al server fallita.')),
    );
    peer.on('open', () => {
      const dc = peer.connect(peerId(code), { reliable: true });
      dc.on('open', () => {
        peer.on('error', () => {});
        const send = (m: ClientMsg) => dc.open && dc.send(m);
        let last = Date.now();
        let gone = false;
        const drop = () => { if (!gone) { gone = true; clearInterval(timers); h.onEvent({ t: 'closed' }); } };
        const timers = setInterval(() => {
          send({ t: 'ping' } as any); // battito: l'host sa che ci siamo
          if (Date.now() - last > SILENCE_MS) { drop(); dc.close(); } // l'host manda una view ogni TICK_MS
        }, 2000);
        dc.on('data', (d) => { last = Date.now(); dispatch(d, h); });
        dc.on('close', drop);
        resolve({ code, send });
        setTimeout(() => send({ t: 'join', token, nick }), 0);
      });
    });
  });
}

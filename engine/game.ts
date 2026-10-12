import { BOT_PHRASES, CRITERIA, type Mode } from './data';

export type { Mode };
export type Variant = 'blind' | 'peek';
export type Phase = 'lobby' | 'write' | 'reveal' | 'vote' | 'end';
export type Rng = () => number;
export type Res = { ok: true } | { ok: false; error: string };

export interface Player {
  id: string;
  nick: string;
  bot: boolean; // bot aggiunto dall'host in lobby
  online: boolean;
  pending: boolean; // ancora sulla pagina finale, non ancora tornato in lobby
}

export interface Piece {
  turn: number; // 1-7
  criterion: string;
  author: string;
  text: string;
  bot: boolean; // scritto dal bot sostituto
}

export const TURNS = 7;
export const MAX_PLAYERS = 10;
export const MIN_PLAYERS = 4;
export const MAX_CHARS = 120;
export const MAX_NICK = 15;
export const TURN_MS = 40000;
export const VOTE_MS = 30000;
export const REVEAL_MS = 15000;
export const REVEAL_BOT_MS = 3000;
export const BOT_READY_MS = 10000;
export const LAST_SECOND_MS = 1000; // il bot sostituto scrive negli ultimi istanti del turno

const ok: Res = { ok: true };
const no = (error: string): Res => ({ ok: false, error });

export class Game {
  phase: Phase = 'lobby';
  mode: Mode = 'easy';
  variant: Variant = 'blind';
  players: Player[] = [];
  hostId = '';
  kicked = new Set<string>();

  seats: string[] = [];
  turn = 0;
  deadline = 0;
  tx = new Map<string, string>();
  ready = new Set<string>();
  botReadyAt = new Map<string, number>();
  botFilled = new Set<string>();
  sheets: Piece[][] = [];
  /** Frasi scritte da umani (mai bot), per modalità e turno: da scaricare e aggiungere ai bot. */
  wordLog: Record<Mode, string[][]> = { easy: Array.from({ length: TURNS }, () => []), gram: Array.from({ length: TURNS }, () => []) };

  order: number[] = [];
  ri = 0;
  shown = 0;
  lastAdv = 0;
  revealer: string | null = null;

  votes = new Map<string, number>();
  voteDeadline = 0;
  winner = -1;

  constructor(private rng: Rng = Math.random) {}

  // ---------- utilità ----------
  private pick<T>(a: T[]): T {
    return a[Math.floor(this.rng() * a.length)];
  }
  private shuffle<T>(a: T[]): T[] {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  private player(id: string) {
    return this.players.find((p) => p.id === id);
  }
  private get N() {
    return this.seats.length;
  }
  /** Foglio in mano al posto i al turno t (0-6). */
  private sheetAt(i: number, t: number) {
    return (((i - t) % this.N) + this.N) % this.N;
  }
  /** Connesso e in gioco: umano online o bot dell'host. */
  private active(id: string) {
    const p = this.player(id);
    return !!p && (p.bot || p.online);
  }
  connectedHumans() {
    return this.players.filter((p) => !p.bot && p.online);
  }

  // ---------- lobby ----------
  join(id: string, nickRaw: string): Res {
    if (this.kicked.has(id)) return no('Sei stato espulso da questa stanza.');
    const ex = this.player(id);
    if (ex && !ex.bot) {
      ex.online = true;
      if (this.phase === 'lobby') ex.pending = false;
      return ok;
    }
    if (this.phase !== 'lobby') return no('Partita in corso, riprova a fine partita.');
    const nick = nickRaw.trim().slice(0, MAX_NICK);
    if (!nick) return no('Scrivi un nickname.');
    if (this.players.length >= MAX_PLAYERS) return no('Stanza piena.');
    if (this.players.some((p) => p.nick.toLowerCase() === nick.toLowerCase())) return no('Nickname già in uso.');
    this.players.push({ id, nick, bot: false, online: true, pending: false });
    if (!this.hostId || !this.player(this.hostId)) this.hostId = id;
    return ok;
  }

  private reassignHost() {
    const h = this.player(this.hostId);
    if (h && h.online && !h.pending) return;
    const next = this.players.find((p) => !p.bot && p.online && !p.pending);
    if (next) this.hostId = next.id;
  }

  setConnected(id: string, online: boolean, now: number): Res {
    const p = this.player(id);
    if (!p || p.bot) return no('Giocatore sconosciuto.');
    p.online = online;
    if (!online) this.reassignHost();
    this.check(now);
    return ok;
  }

  /** Uscita volontaria: in lobby si viene tolti, in partita vale come disconnessione. */
  leave(id: string, now: number): Res {
    const p = this.player(id);
    if (!p || p.bot) return no('Giocatore sconosciuto.');
    if (this.phase === 'lobby') {
      this.players = this.players.filter((q) => q.id !== id);
      this.reassignHost();
      return ok;
    }
    return this.setConnected(id, false, now);
  }

  kick(by: string, id: string): Res {
    if (by !== this.hostId || this.phase !== 'lobby') return no('Non consentito.');
    const t = this.player(id);
    if (!t || t.bot || id === by) return no('Non consentito.');
    this.players = this.players.filter((q) => q.id !== id);
    this.kicked.add(id);
    return ok;
  }

  addBot(by: string): Res {
    if (by !== this.hostId || this.phase !== 'lobby') return no('Non consentito.');
    if (this.players.length >= MAX_PLAYERS) return no('Stanza piena.');
    let n = 1;
    while (this.players.some((p) => p.nick === 'Bot ' + n)) n++;
    this.players.push({ id: 'bot-' + n, nick: 'Bot ' + n, bot: true, online: true, pending: false });
    return ok;
  }

  removeBot(by: string): Res {
    if (by !== this.hostId || this.phase !== 'lobby') return no('Non consentito.');
    for (let i = this.players.length - 1; i >= 0; i--) {
      if (this.players[i].bot) {
        this.players.splice(i, 1);
        return ok;
      }
    }
    return ok;
  }

  config(by: string, mode: Mode, variant: Variant): Res {
    if (by !== this.hostId || this.phase !== 'lobby') return no('Non consentito.');
    this.mode = mode;
    this.variant = variant;
    return ok;
  }

  /** Giocatori che parteciperebbero se la partita partisse ora. */
  private members() {
    return this.players.filter((p) => p.bot || (p.online && !p.pending));
  }

  start(by: string, now: number): Res {
    if (by !== this.hostId || this.phase !== 'lobby') return no('Non consentito.');
    const m = this.members();
    if (m.length < MIN_PLAYERS) return no('Servono almeno 4 giocatori.');
    this.players = m;
    // umani nell'ordine di ingresso, bot in posti a caso
    const seats = m.filter((p) => !p.bot).map((p) => p.id);
    for (const b of m.filter((p) => p.bot)) seats.splice(Math.floor(this.rng() * (seats.length + 1)), 0, b.id);
    this.seats = seats;
    this.sheets = seats.map(() => []);
    this.turn = 0;
    this.phase = 'write';
    this.startTurn(now);
    return ok;
  }

  backToLobby(id: string): Res {
    const p = this.player(id);
    if (!p || p.bot) return no('Giocatore sconosciuto.');
    if (this.phase === 'end') {
      this.seats = [];
      this.sheets = [];
      this.order = [];
      this.votes.clear();
      this.winner = -1;
      this.phase = 'lobby';
      for (const q of this.players) q.pending = !q.bot;
      p.pending = false;
      this.reassignHost();
      return ok;
    }
    if (this.phase === 'lobby') {
      p.pending = false;
      return ok;
    }
    return no('Non consentito.');
  }

  // ---------- scrittura ----------
  private startTurn(now: number) {
    this.deadline = now + TURN_MS;
    this.tx.clear();
    this.ready.clear();
    this.botFilled.clear();
    this.botReadyAt.clear();
    for (const id of this.seats) {
      const p = this.player(id)!;
      if (p.bot) {
        this.tx.set(id, this.pick(BOT_PHRASES[this.mode][this.turn]));
        this.botReadyAt.set(id, now + BOT_READY_MS);
      }
    }
  }

  setText(id: string, turn: number, text: string): Res {
    if (this.phase !== 'write' || turn !== this.turn || !this.seats.includes(id)) return no('Non consentito.');
    this.tx.set(id, String(text).slice(0, MAX_CHARS));
    this.botFilled.delete(id);
    return ok;
  }

  setReady(id: string, v: boolean, now: number): Res {
    if (this.phase !== 'write' || !this.seats.includes(id)) return no('Non consentito.');
    if (v) this.ready.add(id);
    else this.ready.delete(id);
    this.check(now);
    return ok;
  }

  private allReady() {
    const w = this.seats.filter((id) => this.active(id));
    return w.length > 0 && w.every((id) => this.ready.has(id));
  }

  private advance(now: number) {
    const t = this.turn;
    this.seats.forEach((id, i) => {
      const p = this.player(id)!;
      this.sheets[this.sheetAt(i, t)][t] = {
        turn: t + 1,
        criterion: CRITERIA[this.mode][t],
        author: p.nick,
        text: this.tx.get(id) ?? '',
        bot: this.botFilled.has(id),
      };
      const text = (this.tx.get(id) ?? '').trim();
      const log = this.wordLog[this.mode][t];
      if (text && !p.bot && !this.botFilled.has(id) && !log.includes(text)) log.push(text);
    });
    this.turn++;
    if (this.turn < TURNS) {
      this.startTurn(now);
    } else {
      this.phase = 'reveal';
      this.order = this.shuffle(this.sheets.map((_, i) => i));
      this.ri = 0;
      this.shown = 0;
      this.lastAdv = now;
      this.revealer = null;
      this.ensureRevealer();
    }
  }

  // ---------- rivelazione ----------
  /** Chi rivela: chi ha il foglio dopo il passaggio finale; se non è connesso, un umano connesso a caso. */
  private ensureRevealer() {
    const s = this.order[this.ri];
    const intended = this.seats[(s + TURNS) % this.N];
    if (this.active(intended)) {
      this.revealer = intended;
      return;
    }
    if (this.revealer && this.active(this.revealer) && !this.player(this.revealer)!.bot) return;
    const hs = this.connectedHumans().filter((p) => this.seats.includes(p.id));
    this.revealer = hs.length ? this.pick(hs).id : null;
  }

  private revNext(now: number) {
    this.lastAdv = now;
    if (this.shown < TURNS) {
      this.shown++;
      return;
    }
    this.ri++;
    this.shown = 0;
    if (this.ri >= this.order.length) {
      this.phase = 'vote';
      this.votes.clear();
      this.voteDeadline = now + VOTE_MS;
    } else {
      this.revealer = null;
      this.ensureRevealer();
    }
  }

  next(id: string, now: number): Res {
    if (this.phase !== 'reveal' || id !== this.revealer) return no('Non consentito.');
    this.revNext(now);
    this.check(now);
    return ok;
  }

  // ---------- voto ----------
  private voters() {
    return this.seats.filter((id) => this.active(id));
  }

  /** Vota la storia numero `storyNo` (1..N). Si può cambiare finché il voto è aperto. */
  vote(id: string, storyNo: number, now: number): Res {
    if (this.phase !== 'vote' || !this.seats.includes(id) || !this.active(id)) return no('Non consentito.');
    if (!Number.isInteger(storyNo) || storyNo < 1 || storyNo > this.N) return no('Storia non valida.');
    this.votes.set(id, this.order[storyNo - 1]);
    this.check(now);
    return ok;
  }

  private endVote() {
    const n = new Map<number, number>();
    for (const s of this.votes.values()) n.set(s, (n.get(s) ?? 0) + 1);
    const max = Math.max(0, ...n.values());
    const top = [...n.keys()].filter((s) => n.get(s) === max);
    this.winner = top.length ? this.pick(top) : this.pick(this.order);
    this.phase = 'end';
  }

  // ---------- tempo ----------
  tick(now: number) {
    if (this.phase === 'write') {
      for (const [id, t] of this.botReadyAt) if (now >= t) this.ready.add(id);
      if (this.deadline - now <= LAST_SECOND_MS) {
        for (const id of this.seats) {
          const p = this.player(id)!;
          if (!p.bot && !p.online && !this.tx.get(id)) {
            this.tx.set(id, this.pick(BOT_PHRASES[this.mode][this.turn]));
            this.botFilled.add(id);
          }
        }
      }
    }
    this.check(now);
  }

  private check(now: number) {
    if (this.phase === 'write') {
      if (now >= this.deadline || this.allReady()) this.advance(now);
    } else if (this.phase === 'reveal') {
      this.ensureRevealer();
      const r = this.revealer ? this.player(this.revealer) : null;
      if (now - this.lastAdv >= (!r || r.bot ? REVEAL_BOT_MS : REVEAL_MS)) {
        this.revNext(now);
      }
    } else if (this.phase === 'vote') {
      for (const id of this.seats) {
        if (this.player(id)!.bot && !this.votes.has(id)) this.votes.set(id, this.pick(this.order));
      }
      const v = this.voters();
      if (now >= this.voteDeadline || (v.length > 0 && v.every((id) => this.votes.has(id)))) this.endVote();
    }
  }

  // ---------- cosa vede ogni giocatore ----------
  view(id: string, now: number) {
    const me = this.player(id);
    const base = {
      phase: this.phase,
      mode: this.mode,
      variant: this.variant,
      you: id,
      inRoom: !!me && !me.bot,
      isHost: id === this.hostId,
      wordCount: [...this.wordLog.easy, ...this.wordLog.gram].reduce((n, l) => n + l.length, 0),
      players: this.players.map((p) => ({
        id: p.id,
        nick: p.nick,
        bot: p.bot,
        online: p.bot || p.online,
        pending: p.pending,
        host: p.id === this.hostId,
      })),
    };
    if (!base.inRoom) return base;
    const seat = this.seats.indexOf(id);
    if (this.phase === 'write' && seat >= 0) {
      const t = this.turn;
      return {
        ...base,
        turn: t + 1,
        criterion: CRITERIA[this.mode][t],
        msLeft: Math.max(0, this.deadline - now),
        // BLIND: nessun pezzo precedente; PEEK: solo l'ultimo pezzo sullo stesso foglio
        prev: this.variant === 'peek' && t > 0 ? this.sheets[this.sheetAt(seat, t)][t - 1].text : null,
        text: this.tx.get(id) ?? '',
        ready: this.ready.has(id),
        readyIds: this.seats.filter((s) => this.ready.has(s) || !this.active(s)),
      };
    }
    if (this.phase === 'reveal') {
      return {
        ...base,
        storyNo: this.ri + 1,
        total: this.N,
        revealer: this.revealer,
        canNext: this.revealer === id,
        pieces: this.sheets[this.order[this.ri]].slice(0, this.shown),
      };
    }
    if (this.phase === 'vote') {
      const v = this.voters();
      return {
        ...base,
        msLeft: Math.max(0, this.voteDeadline - now),
        stories: this.order.map((s, i) => ({ no: i + 1, pieces: this.sheets[s] })),
        voted: v.filter((x) => this.votes.has(x)).length,
        voters: v.length,
        myVote: this.votes.has(id) ? this.order.indexOf(this.votes.get(id)!) + 1 : null,
      };
    }
    if (this.phase === 'end') {
      return { ...base, storyNo: this.order.indexOf(this.winner) + 1, pieces: this.sheets[this.winner] };
    }
    return base;
  }
}

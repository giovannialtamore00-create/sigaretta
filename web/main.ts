import { createRoom, joinRoom, type Room, type View } from '../net/peer';

const app = document.getElementById('app')!;
const MAX_CHARS = 120;
const MAX_NICK = 15;

const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// identità del dispositivo: serve per il rientro
const token = (() => {
  let t = localStorage.getItem('sigaretta-token');
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem('sigaretta-token', t);
  }
  return t;
})();

let room: Room | null = null;
let view: View | null = null;
let viewAt = 0;
let error = '';
let closed = false;
let screenKey = '';

const send = (m: Parameters<Room['send']>[0]) => room?.send(m);

// ---------- Home / Ingresso ----------
function home(msg = '') {
  room = view = null;
  screenKey = 'home';
  const code = new URLSearchParams(location.search).get('c') ?? '';
  app.innerHTML = `
    <h1>SIGARETTA</h1>
    <input id="nick" maxlength="${MAX_NICK}" placeholder="Il tuo nickname" value="${esc(localStorage.getItem('sigaretta-nick') ?? '')}">
    <button id="create">Crea stanza</button>
    <h2>Entra con codice</h2>
    <input id="code" maxlength="8" placeholder="Codice stanza" value="${esc(code)}" autocapitalize="characters">
    <button id="join" class="sec">Entra</button>
    <div class="err" id="err">${esc(msg)}</div>`;
  const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
  const fail = (e: unknown) => { $('err').textContent = (e as Error).message; busy(false); };
  const busy = (b: boolean) => ['create', 'join'].forEach((i) => (($(i) as unknown as HTMLButtonElement).disabled = b));
  const nick = () => {
    const n = $('nick').value.trim();
    if (n) localStorage.setItem('sigaretta-nick', n);
    else $('err').textContent = 'Scrivi un nickname.';
    return n;
  };
  const handlers = {
    onView(v: View) { view = v; viewAt = Date.now(); error = ''; render(); },
    onEvent(e: any) {
      if (e.t === 'error') {
        error = e.error;
        if (view) render();
        else home(e.error); // errore all'ingresso (nickname in uso, stanza piena...)
      } else if (e.t === 'kicked') home('Sei stato rimosso dalla stanza.');
      else if (e.t === 'closed' && view) { closed = true; render(); } // se non siamo mai entrati, niente schermata di chiusura
    },
  };
  $('create').onclick = () => {
    const n = nick(); if (!n) return;
    busy(true); closed = false;
    createRoom(token, n, handlers).then((r) => (room = r)).catch(fail);
  };
  $('join').onclick = () => {
    const n = nick(); if (!n) return;
    if (!$('code').value.trim()) return void ($('err').textContent = 'Scrivi il codice.');
    busy(true); closed = false;
    joinRoom($('code').value, token, n, handlers).then((r) => (room = r)).catch(fail);
  };
}

// ---------- schermate ----------
const playerList = (v: View, opts: { kick?: boolean; ready?: string[] } = {}) =>
  v.players
    .map((p: any) => {
      const tags = [p.host ? 'host' : '', p.bot ? 'bot' : '', !p.online ? 'offline' : '', p.pending ? 'sulla pagina finale' : '',
        opts.ready?.includes(p.id) ? 'pronto ✓' : '']
        .filter(Boolean).join(' · ');
      const kick = opts.kick && !p.host && p.id !== v.you && !p.bot ? `<button class="sec" data-kick="${esc(p.id)}">Rimuovi</button>` : '';
      return `<div class="pl"><span>${esc(p.nick)} <span class="muted">${esc(tags)}</span></span>${kick}</div>`;
    })
    .join('');

const pieces = (list: any[]) =>
  list.map((p) => `<div class="piece"><small>${p.turn}. ${esc(p.criterion)} — ${esc(p.author)}${p.bot ? ' (bot)' : ''}</small>${esc(p.text || '…')}</div>`).join('');

function lobby(v: View) {
  screenKey = 'lobby';
  const h = v.isHost;
  const link = `${location.origin}${location.pathname}?c=${room?.code}`;
  const n = v.players.length;
  app.innerHTML = `
    <h1>SIGARETTA</h1>
    <div class="code">${esc(room?.code)}</div>
    <button class="sec" id="copy">Copia link d'invito</button>
    <h2>Giocatori ${n}/10</h2>
    ${playerList(v, { kick: h })}
    ${h ? `
      <div class="row"><button class="sec" id="addBot">+ Bot</button><button class="sec" id="rmBot">− Bot</button></div>
      <div class="row">
        <button class="${v.mode === 'easy' ? '' : 'sec'}" data-mode="easy">EASY</button>
        <button class="${v.mode === 'gram' ? '' : 'sec'}" data-mode="gram">GRAMMAR ADDICTED</button>
      </div>
      <div class="row">
        <button class="${v.variant === 'blind' ? '' : 'sec'}" data-variant="blind">BLIND</button>
        <button class="${v.variant === 'peek' ? '' : 'sec'}" data-variant="peek">PEEK</button>
      </div>
      <button id="start" ${n < 4 ? 'disabled' : ''}>Avvia${n < 4 ? ' (servono 4 giocatori)' : ''}</button>`
      : `<p class="muted">Modalità ${esc(v.mode)} · ${esc(v.variant)}. Aspetta che l'host avvii.</p>`}
    <div class="err">${esc(error)}</div>
    <button class="sec" id="leave">Esci</button>`;
  const $ = (id: string) => document.getElementById(id);
  $('copy')!.onclick = () => { navigator.clipboard?.writeText(link); $('copy')!.textContent = 'Copiato!'; };
  $('leave')!.onclick = () => { send({ t: 'leave' }); location.href = location.pathname; };
  if (!h) return;
  $('addBot')!.onclick = () => send({ t: 'addBot' });
  $('rmBot')!.onclick = () => send({ t: 'removeBot' });
  $('start')!.onclick = () => send({ t: 'start' });
  app.querySelectorAll<HTMLElement>('[data-mode],[data-variant]').forEach((b) => (b.onclick = () =>
    send({ t: 'config', mode: (b.dataset.mode ?? v.mode) as any, variant: (b.dataset.variant ?? v.variant) as any })));
  app.querySelectorAll<HTMLElement>('[data-kick]').forEach((b) => (b.onclick = () => send({ t: 'kick', id: b.dataset.kick! })));
}

function write(v: View) {
  const turn0 = v.turn - 1;
  const key = `write${v.turn}`;
  if (screenKey !== key) {
    screenKey = key;
    app.innerHTML = `
      <div class="timer" id="timer"></div>
      <div class="muted">Turno ${v.turn}/7</div>
      <div class="q">${esc(v.criterion)}</div>
      ${v.prev !== null ? `<div class="piece"><small>Pezzo precedente</small>${esc(v.prev || '…')}</div>` : ''}
      <textarea id="text" maxlength="${MAX_CHARS}" autofocus></textarea>
      <div class="muted" id="count"></div>
      <button id="ready"></button>
      <div id="pl"></div>`;
    const ta = document.getElementById('text') as HTMLTextAreaElement;
    ta.value = v.text;
    const upd = () => (document.getElementById('count')!.textContent = `${ta.value.length}/${MAX_CHARS}`);
    upd();
    ta.oninput = () => { upd(); send({ t: 'text', turn: turn0, text: ta.value }); };
    ta.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); send({ t: 'ready', v: true }); } };
    document.getElementById('ready')!.onclick = () => send({ t: 'ready', v: !(view as any).ready });
  }
  // aggiorna senza toccare il campo di testo
  const btn = document.getElementById('ready')!;
  btn.textContent = v.ready ? 'Annulla pronto' : 'Pronto';
  btn.className = v.ready ? 'sec' : '';
  document.getElementById('pl')!.innerHTML = playerList(v, { ready: v.readyIds });
  tickTimer();
}

function reveal(v: View) {
  screenKey = 'reveal';
  app.innerHTML = `
    <h2>Storia ${v.storyNo} di ${v.total}</h2>
    <p class="muted">Rivela: ${esc(v.players.find((p: any) => p.id === v.revealer)?.nick ?? '—')}</p>
    ${pieces(v.pieces)}
    ${v.canNext ? `<button id="next">${v.pieces.length < 7 ? 'Mostra il prossimo pezzo' : 'Avanti'}</button>` : '<p class="muted">Aspetta chi rivela…</p>'}`;
  const b = document.getElementById('next');
  if (b) b.onclick = () => send({ t: 'next' });
}

function vote(v: View) {
  const key = 'vote';
  const same = screenKey === key;
  screenKey = key;
  if (!same) app.innerHTML = `<div class="timer" id="timer"></div><h2>Qual è la storia più divertente?</h2><div id="st"></div><p class="muted" id="cnt"></p>`;
  const open = new Set([...app.querySelectorAll('details[open]')].map((d) => (d as HTMLElement).dataset.no));
  document.getElementById('st')!.innerHTML = v.stories
    .map((s: any) => `<details data-no="${s.no}" ${open.has(String(s.no)) ? 'open' : ''}><summary>Storia ${s.no}${v.myVote === s.no ? ' ✓ votata' : ''}</summary>${pieces(s.pieces)}<button data-vote="${s.no}" class="${v.myVote === s.no ? '' : 'sec'}">Vota storia ${s.no}</button></details>`)
    .join('');
  document.getElementById('cnt')!.textContent = `Hanno votato ${v.voted}/${v.voters}`;
  app.querySelectorAll<HTMLElement>('[data-vote]').forEach((b) => (b.onclick = () => send({ t: 'vote', n: Number(b.dataset.vote) })));
  tickTimer();
}

function end(v: View) {
  screenKey = 'end';
  app.innerHTML = `
    <h1>Storia più votata</h1>
    <p class="muted">Storia ${v.storyNo}</p>
    ${pieces(v.pieces)}
    <button id="back">Torna alla lobby</button>`;
  document.getElementById('back')!.onclick = () => send({ t: 'back' });
}

function tickTimer() {
  const el = document.getElementById('timer');
  if (!el || !view || view.msLeft === undefined) return;
  el.textContent = String(Math.max(0, Math.ceil((view.msLeft - (Date.now() - viewAt)) / 1000)));
}
setInterval(tickTimer, 250);

function render() {
  if (closed) {
    screenKey = 'closed';
    app.innerHTML = `<h1>SIGARETTA</h1><h2>Host disconnesso</h2><p>La stanza è chiusa.</p><button id="home">Torna alla home</button>`;
    document.getElementById('home')!.onclick = () => (location.href = location.pathname);
    return;
  }
  const v = view;
  if (!v) return;
  if (!v.inRoom) {
    screenKey = 'busy';
    app.innerHTML = `<h1>SIGARETTA</h1><p>Partita in corso, riprova a fine partita.</p><button id="home">Indietro</button>`;
    document.getElementById('home')!.onclick = () => (location.href = location.pathname);
    return;
  }
  if (v.phase === 'lobby') lobby(v);
  else if (v.phase === 'write') write(v);
  else if (v.phase === 'reveal') reveal(v);
  else if (v.phase === 'vote') vote(v);
  else if (v.phase === 'end') end(v);
}

home();

import '@fontsource/patrick-hand';
import { TURN_MS, VOTE_MS } from '../engine/game';
import { sfx, unlockAudio, settings, setAudio } from './audio';
import { createRoom, joinRoom, type Room, type View } from '../net/peer';

const app = document.getElementById('app')!;
const MAX_CHARS = 120;
const MAX_NICK = 15;

const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// ridisegna solo se il contenuto cambia: l'host manda aggiornamenti di continuo e
// ricreare i pulsanti a ogni aggiornamento può perdere un tocco e interrompe le animazioni
const tpl = document.createElement('template');
function paint(el: HTMLElement, html: string) {
  tpl.innerHTML = html;
  if (tpl.innerHTML === el.innerHTML) return false;
  el.innerHTML = html;
  return true;
}

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

// titolo scritto a mano: ogni lettera un po' storta
const TILT = [-4, 3, -2, 5, -3, 2, -5, 3, -1];
const title = () =>
  `<h1 class="title" aria-label="Sigaretta">${[...'SIGARETTA'].map((c, i) => `<span style="transform:rotate(${TILT[i]}deg) translateY(${(i % 3) - 1}px)">${c}</span>`).join('')}</h1>
  <svg class="underline" viewBox="0 0 230 18" aria-hidden="true"><path d="M3 11c30-7 60-6 90-2s70 5 134-4M40 15c40-4 90-5 150-3"/></svg>`;

const CHECK = '<svg class="check" viewBox="0 0 26 22" aria-hidden="true"><path d="M3 12l7 7L23 3"/></svg>';
const RING = `<svg class="ring" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true"><path d="M58 4C30 1 4 9 4 23s27 19 48 18 45-6 44-20S70 2 40 6"/></svg>`;
const TIMER = `<div class="timer" id="timer"><div class="pencil"><span class="tip"></span><span class="wood" id="wood"></span><span class="ferrule"></span><span class="eraser"></span></div><span class="sec-left" id="secs"></span></div>`;

// ---------- Home / Ingresso ----------
function home(msg = '') {
  room = view = null;
  screenKey = 'home';
  const code = new URLSearchParams(location.search).get('c') ?? '';
  app.innerHTML = `
    ${title()}
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
      const tags = [p.host ? 'host' : '', p.bot ? 'bot' : '', !p.online ? 'offline' : '', p.pending ? 'sulla pagina finale' : '']
        .filter(Boolean).join(', ');
      const ok = opts.ready?.includes(p.id) ? ` ${CHECK}<span class="tag">pronto</span>` : '';
      const kick = opts.kick && !p.host && p.id !== v.you && !p.bot ? `<button class="sec" data-kick="${esc(p.id)}">Rimuovi</button>` : '';
      return `<div class="pl"><span>${esc(p.nick)} ${tags ? `<span class="tag">(${esc(tags)})</span>` : ''}${ok}</span>${kick}</div>`;
    })
    .join('');

// writeLast: l'ultimo pezzo compare come scritto a matita
const pieces = (list: any[], writeLast = false) =>
  list.map((p, i) => `<div class="piece${writeLast && i === list.length - 1 ? ' writing' : ''}"><small>${p.turn}. ${esc(p.criterion)}, scritto da ${esc(p.author)}${p.bot ? ' (bot)' : ''}</small><span class="txt">${esc(p.text || '…')}</span></div>`).join('');

// Parole scritte da questo giocatore, salvate nel browser; ognuno può inviarle di sua scelta
// a un Google Form (da creare: poi compilare FORM_URL e FORM_ENTRY, vedi Status).
const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSc-XuP0ecUMt1Rq6ydj0ab4R901rOxfCS2QYi8LwcygmpN5BA/formResponse';
const FORM_ENTRY = 'entry.1479085044';
type Words = Record<'easy' | 'gram', string[][]>;
const loadWords = (): Words => {
  try { return JSON.parse(localStorage.getItem('sigaretta-words') ?? ''); }
  catch { return { easy: Array.from({ length: 7 }, () => []), gram: Array.from({ length: 7 }, () => []) }; }
};
const countWords = (w: Words) => [...w.easy, ...w.gram].reduce((n, l) => n + l.length, 0);
let sentThanks = false;

// in votazione tutti vedono tutte le storie: tengo i pezzi scritti da me (non dai bot)
function collectWords(v: View) {
  const me = v.players.find((p: any) => p.id === v.you)?.nick;
  const w = loadWords();
  let added = false;
  for (const s of v.stories) for (const p of s.pieces) {
    const text = String(p.text ?? '').trim();
    const list = w[v.mode as 'easy' | 'gram']?.[p.turn - 1];
    if (p.author === me && !p.bot && text && list && !list.includes(text)) { list.push(text); added = true; }
  }
  if (added) localStorage.setItem('sigaretta-words', JSON.stringify(w));
}

const wordsBtn = () => {
  if (!FORM_URL) return '';
  const n = countWords(loadWords());
  if (n > 0) return `<button class="sec" id="words">Invia le mie parole (${n})</button><p class="muted">Si inviano solo le frasi, senza nickname.</p>`;
  return sentThanks ? '<p class="muted">Parole inviate, grazie!</p>' : '';
};
function wireWords() {
  const b = document.getElementById('words');
  if (!b) return;
  b.onclick = async () => {
    b.setAttribute('disabled', '');
    try {
      await fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ [FORM_ENTRY]: localStorage.getItem('sigaretta-words') ?? '' }) });
      localStorage.removeItem('sigaretta-words');
      sentThanks = true;
    } catch { error = 'Invio non riuscito, riprova.'; }
    render();
  };
}

// solo chi ha creato la stanza: scarica tutte le parole degli umani della stanza
const hostWordsBtn = (v: View) =>
  room?.exportWords && v.wordCount > 0 ? `<button class="sec" id="hostWords">Scarica le parole (${v.wordCount})</button>` : '';
function wireHostWords() {
  const b = document.getElementById('hostWords');
  if (!b) return;
  b.onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([room!.exportWords!()], { type: 'application/json' }));
    a.download = `sigaretta-parole-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
}

function lobby(v: View) {
  screenKey = 'lobby';
  const h = v.isHost;
  const link = `${location.origin}${location.pathname}?c=${room?.code}`;
  const n = v.players.length;
  if (!paint(app, `
    <h1>Stanza</h1>
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
    ${hostWordsBtn(v)}
    ${wordsBtn()}
    <button class="sec" id="leave">Esci</button>`)) return;
  wireWords();
  wireHostWords();
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

let wasReady = false;

function write(v: View) {
  const turn0 = v.turn - 1;
  const key = `write${v.turn}`;
  if (screenKey !== key) {
    screenKey = key;
    wasReady = v.ready;
    app.innerHTML = `
      ${TIMER}
      <div class="muted">Turno ${v.turn} di 7</div>
      <div class="q">${esc(v.criterion)}</div>
      <div class="sheet${v.ready ? ' folded still' : ''}" id="sheet"><div class="paper">
        ${v.prev !== null ? `<div class="prev"><small>Pezzo precedente</small>${esc(v.prev || '…')}</div>` : ''}
        <textarea id="text" maxlength="${MAX_CHARS}" placeholder="Scrivi qui…" autofocus></textarea>
        <div class="count" id="count"></div>
      </div></div>
      <p class="waiting">Foglio piegato e passato. Aspetta gli altri…</p>
      <button id="ready"></button>
      <div id="pl"></div>`;
    sfx('page');
    const ta = document.getElementById('text') as HTMLTextAreaElement;
    ta.value = v.text;
    const upd = () => (document.getElementById('count')!.textContent = `${ta.value.length}/${MAX_CHARS}`);
    upd();
    ta.oninput = () => { upd(); send({ t: 'text', turn: turn0, text: ta.value }); };
    ta.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); send({ t: 'ready', v: true }); } };
    document.getElementById('ready')!.onclick = () => send({ t: 'ready', v: !(view as any).ready });
  }
  // foglio piegato quando si è pronti, riaperto se si annulla
  const sheet = document.getElementById('sheet')!;
  if (v.ready !== wasReady) {
    wasReady = v.ready;
    sheet.className = v.ready ? 'sheet folded' : 'sheet';
    sfx(v.ready ? 'fold' : 'unfold');
    // a piegatura finita il foglio non occupa più spazio
    if (v.ready) setTimeout(() => sheet.classList.contains('folded') && sheet.classList.add('still'), 600);
    if (!v.ready) (document.getElementById('text') as HTMLTextAreaElement).focus();
  }
  // aggiorna senza toccare il campo di testo
  const btn = document.getElementById('ready')!;
  btn.textContent = v.ready ? 'Annulla pronto' : 'Pronto';
  btn.className = v.ready ? 'sec' : '';
  document.getElementById('pl')!.innerHTML = playerList(v, { ready: v.readyIds });
  tickTimer();
}

let revealKey = '';

function reveal(v: View) {
  screenKey = 'reveal';
  // anima solo quando compare un pezzo nuovo, non a ogni aggiornamento
  const key = `${v.storyNo}:${v.pieces.length}`;
  const fresh = key !== revealKey;
  if (fresh) sfx(revealKey.split(':')[0] !== String(v.storyNo) ? 'page' : 'scribble');
  revealKey = key;
  if (!paint(app, `
    <h2>Storia ${v.storyNo} di ${v.total}</h2>
    <p class="muted">Rivela: ${esc(v.players.find((p: any) => p.id === v.revealer)?.nick ?? '—')}</p>
    ${pieces(v.pieces, true)}
    ${v.canNext ? `<button id="next">${v.pieces.length < 7 ? 'Mostra il prossimo pezzo' : 'Avanti'}</button>` : '<p class="muted">Aspetta chi rivela…</p>'}`)) return;
  const b = document.getElementById('next');
  if (b) b.onclick = () => send({ t: 'next' });
}

let lastVote: unknown = null;

function vote(v: View) {
  const key = 'vote';
  const same = screenKey === key;
  screenKey = key;
  if (!same) { app.innerHTML = `${TIMER}<h2>Qual è la storia più divertente?</h2><div id="st"></div><p class="muted" id="cnt"></p>`; lastVote = v.myVote; }
  const changed = v.myVote !== lastVote;
  if (changed && v.myVote != null) sfx('circle');
  lastVote = v.myVote;
  const open = new Set([...app.querySelectorAll('details[open]')].map((d) => (d as HTMLElement).dataset.no));
  const painted = paint(document.getElementById('st')!, v.stories
    .map((s: any) => {
      const mine = v.myVote === s.no;
      const ring = mine ? RING.replace('class="ring"', 'class="ring draw"') : '';
      return `<details data-no="${s.no}" ${open.has(String(s.no)) ? 'open' : ''}><summary><span class="no">Storia ${s.no}${ring}</span>${mine ? ' <span class="tag">il tuo voto</span>' : ''}</summary>${pieces(s.pieces)}<button data-vote="${s.no}" class="${mine ? '' : 'sec'}">${mine ? 'Votata' : `Vota storia ${s.no}`}</button></details>`;
    })
    .join(''));
  document.getElementById('cnt')!.textContent = `Hanno votato ${v.voted} su ${v.voters}`;
  if (painted) app.querySelectorAll<HTMLElement>('[data-vote]').forEach((b) => (b.onclick = () => send({ t: 'vote', n: Number(b.dataset.vote) })));
  tickTimer();
}

function end(v: View) {
  const first = screenKey !== 'end';
  if (first) sfx('circle');
  screenKey = 'end';
  if (!paint(app, `
    <h1>La più votata è la <span class="no">storia ${v.storyNo}${RING.replace('class="ring"', 'class="ring draw"')}</span></h1>
    ${pieces(v.pieces)}
    ${hostWordsBtn(v)}
    ${wordsBtn()}
    <button id="back">Torna alla lobby</button>`)) return;
  wireWords();
  wireHostWords();
  document.getElementById('back')!.onclick = () => send({ t: 'back' });
}

let lastSecs = -1;

function tickTimer() {
  const el = document.getElementById('timer');
  if (!el || !view || view.msLeft === undefined) return;
  const ms = Math.max(0, view.msLeft - (Date.now() - viewAt));
  const secs = Math.ceil(ms / 1000);
  const total = view.phase === 'vote' ? VOTE_MS : TURN_MS;
  document.getElementById('wood')!.style.width = `calc((100% - 48px) * ${Math.min(1, ms / total)})`;
  document.getElementById('secs')!.textContent = String(secs);
  el.classList.toggle('hurry', secs > 0 && secs <= 10);
  if (secs !== lastSecs && secs > 0 && secs <= 5) sfx('tick');
  lastSecs = secs;
}
setInterval(tickTimer, 250);

function render() {
  if (closed) {
    screenKey = 'closed';
    app.innerHTML = `${title()}<h2>Host disconnesso</h2><p>La stanza è chiusa.</p><button id="home">Torna alla home</button>`;
    document.getElementById('home')!.onclick = () => (location.href = location.pathname);
    return;
  }
  const v = view;
  if (!v) return;
  if (!v.inRoom) {
    screenKey = 'busy';
    app.innerHTML = `${title()}<p>Partita in corso, riprova a fine partita.</p><button id="home">Indietro</button>`;
    document.getElementById('home')!.onclick = () => (location.href = location.pathname);
    return;
  }
  if (v.phase === 'lobby') lobby(v);
  else if (v.phase === 'write') write(v);
  else if (v.phase === 'reveal') reveal(v);
  else if (v.phase === 'vote') { collectWords(v); vote(v); }
  else if (v.phase === 'end') end(v);
}

home();

// ---------- audio ----------
const audioBtn = document.getElementById('audioBtn')!;
const panel = document.getElementById('audioPanel')!;
const volMusic = document.getElementById('volMusic') as HTMLInputElement;
const volSfx = document.getElementById('volSfx') as HTMLInputElement;
const mute = document.getElementById('mute')!;
const syncAudioUi = () => {
  volMusic.value = String(settings.music);
  volSfx.value = String(settings.sfx);
  mute.textContent = settings.muted ? 'Riattiva' : 'Muto';
  audioBtn.classList.toggle('off', settings.muted);
};
syncAudioUi();
audioBtn.onclick = () => (panel.hidden = !panel.hidden);
document.getElementById('audioClose')!.onclick = () => (panel.hidden = true);
volMusic.oninput = () => setAudio({ music: Number(volMusic.value) });
volSfx.oninput = () => setAudio({ sfx: Number(volSfx.value) });
volSfx.onchange = () => sfx('scribble'); // prova del volume effetti
mute.onclick = () => { setAudio({ muted: !settings.muted }); syncAudioUi(); };
// i browser fanno partire l'audio solo dopo un gesto
addEventListener('pointerdown', unlockAudio);
addEventListener('keydown', unlockAudio);
// colpetto di matita su ogni pulsante
addEventListener('click', (e) => { if ((e.target as Element).closest('button')) sfx('tap'); });

// ---------- tavolo ----------
// il posacenere (cerchio) vale il 25% dell'area visibile del foglio: pi*(d/2)^2 = 0.25*w*h
const pageEl = document.querySelector<HTMLElement>('.page')!;
function layoutDesk() {
  const root = document.documentElement;
  const r = pageEl.getBoundingClientRect();
  const h = innerHeight - (innerWidth >= 760 ? 48 : 24);
  root.style.setProperty('--ash-d', `${Math.sqrt((r.width * h) / Math.PI).toFixed(1)}px`);
  root.style.setProperty('--page-gap', `${Math.max(0, root.clientWidth - pageEl.getBoundingClientRect().right).toFixed(1)}px`);
}
layoutDesk();
addEventListener('resize', layoutDesk);

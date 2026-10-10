/** Suoni sintetizzati con Web Audio: effetti carta/matita e musica lo-fi in loop. Nessun file audio. */

const STORE = 'sigaretta-audio';

export interface AudioSettings { music: number; sfx: number; muted: boolean }

export const settings: AudioSettings = { music: 0.5, sfx: 0.7, muted: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(STORE) ?? '{}')); } catch { /* valori di default */ }

let ctx: AudioContext | null = null;
let musicBus: GainNode, sfxBus: GainNode, noise: AudioBuffer;
let started = false;

const now = () => ctx!.currentTime;

function applyVolumes() {
  if (!ctx) return;
  const m = settings.muted ? 0 : settings.music * 0.55;
  const s = settings.muted ? 0 : settings.sfx;
  musicBus.gain.setTargetAtTime(m, now(), 0.05);
  sfxBus.gain.setTargetAtTime(s, now(), 0.05);
}

export function setAudio(p: Partial<AudioSettings>) {
  Object.assign(settings, p);
  localStorage.setItem(STORE, JSON.stringify(settings));
  applyVolumes();
}

/** Da chiamare al primo tocco: i browser non fanno partire l'audio prima. */
export function unlockAudio() {
  if (started) return void ctx?.resume();
  started = true;
  ctx = new AudioContext();
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus.gain.value = sfxBus.gain.value = 0;
  // la musica passa da un passa-basso: suono "lo-fi" ovattato
  const lofi = ctx.createBiquadFilter();
  lofi.type = 'lowpass';
  lofi.frequency.value = 2200;
  musicBus.connect(lofi).connect(ctx.destination);
  sfxBus.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  startMusic();
}

// ---------- mattoncini ----------
function noiseHit(out: AudioNode, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, vol: number) {
  const src = ctx!.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx!.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 1.5, dur + 0.05);
}

function tone(out: AudioNode, t: number, freq: number, dur: number, vol: number, type: OscillatorType = 'sine', drop = 0) {
  const o = ctx!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (drop) o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.05);
}

// ---------- effetti ----------
export type Sfx = 'tap' | 'fold' | 'unfold' | 'scribble' | 'page' | 'circle' | 'tick';

export function sfx(name: Sfx) {
  if (!ctx || settings.muted || settings.sfx === 0) return;
  const t = now(), o = sfxBus;
  switch (name) {
    case 'tap': // colpetto di matita sul foglio
      noiseHit(o, t, 0.05, 'bandpass', 2500, 1800, 2, 0.5);
      tone(o, t, 900, 0.04, 0.08, 'triangle', 0.6);
      break;
    case 'fold': // foglio piegato e fatto scivolare
      noiseHit(o, t, 0.12, 'bandpass', 1200, 3000, 1.5, 0.6);
      noiseHit(o, t + 0.13, 0.1, 'bandpass', 2600, 900, 1.5, 0.5);
      noiseHit(o, t + 0.25, 0.45, 'highpass', 1500, 4000, 0.7, 0.25);
      break;
    case 'unfold': // foglio riaperto (come una gomma)
      for (let i = 0; i < 3; i++) noiseHit(o, t + i * 0.09, 0.08, 'bandpass', 700, 500, 3, 0.4);
      break;
    case 'scribble': // matita che scrive
      for (let i = 0; i < 6; i++) noiseHit(o, t + i * 0.07 + Math.random() * 0.02, 0.06, 'bandpass', 3500 + Math.random() * 2500, 2500, 4, 0.35);
      break;
    case 'circle': // cerchio a matita
      noiseHit(o, t, 0.45, 'bandpass', 2500, 5000, 3, 0.4);
      break;
    case 'page': // pagina girata
      noiseHit(o, t, 0.35, 'bandpass', 800, 5000, 0.8, 0.5);
      noiseHit(o, t + 0.3, 0.08, 'lowpass', 1200, 400, 1, 0.4);
      break;
    case 'tick': // ultimi secondi
      tone(o, t, 1400, 0.03, 0.12, 'square', 0.5);
      break;
  }
}

// ---------- musica lo-fi ----------
const BPM = 74;
const STEP = 60 / BPM / 4; // sedicesimi
const CHORDS = [ // Fmaj7, Em7, Dm9, Cmaj7 (MIDI)
  [53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60, 64], [48, 52, 55, 59],
];
const BASS = [41, 40, 38, 36];
const KICK = [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

let step = 0, nextAt = 0, wobble: GainNode;

function keys(t: number, notes: number[], dur: number) {
  for (const n of notes) {
    const o = ctx!.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midi(n);
    wobble.connect(o.detune); // nastro che oscilla un po'
    const g = ctx!.createGain();
    const strum = Math.random() * 0.04;
    g.gain.setValueAtTime(0.0001, t + strum);
    g.gain.exponentialRampToValueAtTime(0.05, t + strum + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(musicBus);
    o.start(t + strum); o.stop(t + dur + 0.1);
  }
}

function crackle(t: number) {
  if (Math.random() < 0.5) noiseHit(musicBus, t + Math.random() * STEP, 0.01, 'highpass', 3000, 3000, 1, 0.08);
}

function scheduleStep(s: number, t: number) {
  const bar = Math.floor(s / 16) % 4, i = s % 16;
  const swing = i % 2 ? STEP * 0.18 : 0;
  t += swing;
  if (i === 0) { keys(t, CHORDS[bar], STEP * 14); tone(musicBus, t, midi(BASS[bar]), STEP * 7, 0.18); }
  if (i === 8) tone(musicBus, t, midi(BASS[bar] + 7), STEP * 6, 0.12);
  if (i === 10 && Math.random() < 0.5) keys(t, [CHORDS[bar][CHORDS[bar].length - 1] + 12], STEP * 4);
  if (KICK[i]) tone(musicBus, t, 110, 0.25, 0.5, 'sine', 0.35);
  if (SNARE[i]) noiseHit(musicBus, t, 0.18, 'bandpass', 1800, 1200, 0.8, 0.25);
  if (i % 2 === 0) noiseHit(musicBus, t, 0.03, 'highpass', 7000, 7000, 1, i % 4 ? 0.05 : 0.09);
  crackle(t);
}

function startMusic() {
  const lfo = ctx!.createOscillator();
  lfo.frequency.value = 0.4;
  wobble = ctx!.createGain();
  wobble.gain.value = 8; // cent
  lfo.connect(wobble);
  lfo.start();
  nextAt = now() + 0.1;
  setInterval(() => {
    if (ctx!.state !== 'running') return;
    if (nextAt < now()) nextAt = now() + 0.05; // scheda tornata visibile: non recuperare le note perse
    while (nextAt < now() + 0.2) { scheduleStep(step++, nextAt); nextAt += STEP; }
  }, 50);
}

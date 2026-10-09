import type { Rng } from '../engine/game';

// niente 0/O/1/I/L: caratteri ambigui
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 5;

export function makeCode(rng: Rng = Math.random): string {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return s;
}

export function normalizeCode(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

/** ID PeerJS dell'host: il prefisso evita collisioni sul server pubblico. */
export function peerId(code: string): string {
  return 'sigaretta-' + normalizeCode(code);
}

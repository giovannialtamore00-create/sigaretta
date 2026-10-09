import { describe, expect, it } from 'vitest';
import { makeCode, normalizeCode, peerId } from './code';

describe('codice stanza', () => {
  it('ha 5 caratteri senza ambigui', () => {
    for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$/);
  });
  it('normalizza spazi e minuscole', () => {
    expect(normalizeCode(' ab c12 ')).toBe('ABC12');
    expect(peerId('ab c12')).toBe('sigaretta-ABC12');
  });
});

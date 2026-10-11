import { describe, expect, it } from 'vitest';
import { parseVcards } from './vcard';

describe('parseVcards', () => {
  it('liest Name, Nummer und Geburtstag (mit und ohne Jahr)', () => {
    const v = [
      'BEGIN:VCARD', 'VERSION:3.0', 'N:Hoffmann;Lena;;;', 'FN:Lena Hoffmann', 'TEL;type=CELL:+49 171 234 56 78', 'BDAY:1991-10-18', 'END:VCARD',
      'BEGIN:VCARD', 'VERSION:3.0', 'N:Weber;Jonas;;;', 'TEL:0171-999', 'BDAY;X-APPLE-OMIT-YEAR=1604:--03-02', 'END:VCARD',
    ].join('\r\n');
    expect(parseVcards(v)).toEqual([
      { name: 'Jonas Weber', phone: '0171999', birthday: '03-02' },
      { name: 'Lena Hoffmann', phone: '+491712345678', birthday: '10-18' },
    ]);
  });
});

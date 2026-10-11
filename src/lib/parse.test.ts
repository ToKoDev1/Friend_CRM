import { describe, expect, it } from 'vitest';
import { parseNote, splitClauses, type KnownPerson } from './parse';

const today = '2026-10-10'; // Samstag
const known: KnownPerson[] = [
  { id: 1, name: 'Jonas Weber', aliases: ['jonas weber', 'jonas'] },
  { id: 2, name: 'Mo', aliases: ['mo'] },
  { id: 3, name: 'Kathi', aliases: ['kathi'] },
  { id: 4, name: 'Lena Hoffmann', aliases: ['lena hoffmann', 'lena'] },
];

describe('splitClauses', () => {
  it('trennt an Kommas, aber nicht in Datumsangaben', () => {
    expect(splitClauses('treffen am 18.10. in köln, danach essen')).toEqual(['treffen am 18.10. in köln', 'danach essen']);
  });
});

describe('parseNote', () => {
  it('erkennt Person, Job, Familie, nächstes Mal und Anlass', () => {
    const p = parseNote('kaffee mit jonas, er fängt montag bei siemens an, tochter heißt mila, nächstes mal tennis', known, today);
    expect(p.people).toEqual([{ id: 1, name: 'Jonas Weber', isNew: false }]);
    expect(p.label).toBe('Kaffee mit jonas');
    expect(p.facts).toContainEqual({ p: 0, label: 'Job', value: 'Siemens' });
    expect(p.facts).toContainEqual({ p: 0, label: 'Familie', value: 'Tochter Mila' });
    expect(p.nexts).toEqual([{ p: 0, text: 'tennis' }]);
    expect(p.occasions).toEqual([{ p: 0, date: '2026-10-12', text: 'fängt bei siemens an' }]);
  });

  it('verteilt "nächstes mal" auf alle, wenn kein Name im Satzteil steht', () => {
    const p = parseNote('Essen bei Mo und Kathi, nächstes mal kochen wir', known, today);
    expect(p.people.map(x => x.id)).toEqual([2, 3]);
    expect(p.nexts).toEqual([{ p: 0, text: 'kochen wir' }, { p: 1, text: 'kochen wir' }]);
  });

  it('schlägt neue Personen nach "mit" vor', () => {
    const p = parseNote('pizza mit sarah, sie zieht nach hamburg', known, today);
    expect(p.people).toEqual([{ name: 'Sarah', isNew: true }]);
    expect(p.facts).toContainEqual({ p: 0, label: 'Wohnort', value: 'Hamburg' });
  });

  it('ignoriert Füllwörter nach "mit"', () => {
    const p = parseNote('Mittagessen mit dem Team', known, today);
    expect(p.people).toEqual([]);
  });

  it('liest Geburtstag', () => {
    const p = parseNote('lena hat geburtstag am 18.10.', known, today);
    expect(p.birthdays).toEqual([{ p: 0, mmdd: '10-18' }]);
  });

  it('nimmt "gestern" als Datum des Moments', () => {
    const p = parseNote('gestern mit lena telefoniert', known, today);
    expect(p.date).toBe('2026-10-09');
    expect(p.occasions).toEqual([]);
  });
});

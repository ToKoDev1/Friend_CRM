import { describe, expect, it } from 'vitest';
import type { Person, Snapshot } from './db';
import { sinceText, weekCards } from './week';

const today = '2026-10-10';
const person = (id: number, extra: Partial<Person> = {}): Person => ({
  id, name: `P${id}`, aliases: [`p${id}`], lens: 'nah', createdAt: '2026-01-01T00:00:00.000Z', ...extra,
});
const empty = (): Snapshot => ({ persons: [], facts: [], moments: [], nexts: [], occasions: [] });

describe('weekCards', () => {
  it('zeigt Geburtstag, Anlass und fälligen Rhythmus, sortiert nach Datum', () => {
    const s = empty();
    s.persons = [
      person(1, { birthday: '10-15' }),
      person(2),
      person(3, { rhythmDays: 30 }),
      person(4, { rhythmDays: 30, routine: true }),
    ];
    s.occasions = [{ id: 1, personId: 2, date: '2026-10-12', text: 'erster Arbeitstag' }];
    s.moments = [{ id: 1, date: '2026-06-02', text: 'x', personIds: [3], kind: 'notiz' }];
    const { cards } = weekCards(s, today);
    expect(cards.map(c => c.person.id)).toEqual([2, 1, 3]);
    expect(cards[2].reasons).toEqual(['seit Juni nichts notiert']);
  });

  it('lässt zurückgestellte Personen weg und begrenzt auf fünf', () => {
    const s = empty();
    s.persons = Array.from({ length: 7 }, (_, i) => person(i + 1, { birthday: '10-12' }));
    s.persons[0].snoozeUntil = '2026-10-17';
    const r = weekCards(s, today);
    expect(r.cards).toHaveLength(5);
    expect(r.more).toBe(1);
    expect(r.cards.some(c => c.person.id === 1)).toBe(false);
  });
});

describe('sinceText', () => {
  it('formuliert ehrlich', () => {
    expect(sinceText(undefined, today)).toBe('noch nichts notiert');
    expect(sinceText('2026-10-01', today)).toBe('zuletzt notiert am 01.10.');
    expect(sinceText('2026-06-20', today)).toBe('seit Juni nichts notiert');
  });
});

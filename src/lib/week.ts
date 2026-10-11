// Wer ist diese Woche dran? Anlass vor Abstand, höchstens fünf Karten.

import type { Person, Snapshot } from './db';
import { addDays, diffDays, dm, monthName, nextBirthday } from './dates';

export interface Card {
  person: Person;
  date?: string;
  kind: 'geburtstag' | 'anlass' | 'rhythmus';
  reasons: string[];
  hint?: string;
  hintDate?: string;
}

const PRIO = { geburtstag: 0, anlass: 1, rhythmus: 2 };

export function lastContact(snap: Snapshot, personId: number): string | undefined {
  let last: string | undefined;
  for (const m of snap.moments) if (m.personIds.includes(personId) && (!last || m.date > last)) last = m.date;
  return last;
}

export function openNexts(snap: Snapshot, personId: number) {
  return snap.nexts.filter(n => n.personId === personId && !n.done);
}

/** Ehrliche Formulierung: die App weiß nur, was notiert wurde. */
export function sinceText(last: string | undefined, today: string): string {
  if (!last) return 'noch nichts notiert';
  const n = diffDays(last, today);
  if (n <= 0) return 'heute notiert';
  if (n === 1) return 'gestern notiert';
  if (n < 45) return `zuletzt notiert am ${dm(last)}`;
  return `seit ${monthName(last)} nichts notiert`;
}

export function weekCards(snap: Snapshot, today: string): { cards: Card[]; more: number } {
  const end = addDays(today, 6);
  const cards: Card[] = [];
  for (const p of snap.persons) {
    if (p.snoozeUntil && p.snoozeUntil > today) continue;
    const reasons: { kind: Card['kind']; date?: string; text: string }[] = [];

    if (p.birthday) {
      const b = nextBirthday(p.birthday, today);
      if (b <= end) reasons.push({ kind: 'geburtstag', date: b, text: 'Geburtstag' });
    }
    for (const o of snap.occasions) {
      if (o.personId === p.id && o.date >= addDays(today, -1) && o.date <= end) reasons.push({ kind: 'anlass', date: o.date, text: o.text });
    }
    const last = lastContact(snap, p.id);
    if (!p.routine && p.rhythmDays) {
      const due = addDays(last ?? p.createdAt.slice(0, 10), p.rhythmDays);
      if (due <= end && !reasons.length) reasons.push({ kind: 'rhythmus', text: sinceText(last, today) });
    }
    if (!reasons.length) continue;

    reasons.sort((a, b) => PRIO[a.kind] - PRIO[b.kind] || (a.date ?? '').localeCompare(b.date ?? ''));
    const nx = openNexts(snap, p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    cards.push({
      person: p,
      date: reasons.find(r => r.date)?.date,
      kind: reasons[0].kind,
      reasons: reasons.map(r => r.text),
      hint: nx ? `nächstes Mal: ${nx.text}` : undefined,
      hintDate: nx?.createdAt.slice(0, 10),
    });
  }
  cards.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return PRIO[a.kind] - PRIO[b.kind];
  });
  return { cards: cards.slice(0, 5), more: Math.max(0, cards.length - 5) };
}

/** Wenn nichts fällig ist: wer am längsten nicht vorkam (ohne "sehen uns eh"). */
export function quietest(snap: Snapshot, today: string, n = 2) {
  return snap.persons
    .filter(p => !p.routine && !(p.snoozeUntil && p.snoozeUntil > today))
    .map(p => ({ p, last: lastContact(snap, p.id) ?? p.createdAt.slice(0, 10) }))
    .sort((a, b) => a.last.localeCompare(b.last))
    .slice(0, n);
}

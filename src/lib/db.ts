import Dexie, { type EntityTable } from 'dexie';

export type Lens = 'nah' | 'netzwerk';

export interface Person {
  id: number;
  name: string;
  /** kleingeschriebene Namen, unter denen die Person in Notizen erkannt wird */
  aliases: string[];
  circle?: string;
  lens: Lens;
  phone?: string;
  /** "MM-DD" */
  birthday?: string;
  /** gewünschter Abstand in Tagen, null = kein Rhythmus */
  rhythmDays?: number | null;
  /** "sehen uns eh": taucht nie wegen Rhythmus auf */
  routine?: boolean;
  snoozeUntil?: string;
  createdAt: string;
}

export interface Fact {
  id: number;
  personId: number;
  label: string;
  value: string;
  createdAt: string;
}

export interface Moment {
  id: number;
  date: string;
  text: string;
  personIds: number[];
  kind: 'notiz' | 'gemeldet';
}

export interface Next {
  id: number;
  personId: number;
  text: string;
  done: 0 | 1;
  createdAt: string;
}

export interface Occasion {
  id: number;
  personId: number;
  date: string;
  text: string;
}

export const db = new Dexie('leute') as Dexie & {
  persons: EntityTable<Person, 'id'>;
  facts: EntityTable<Fact, 'id'>;
  moments: EntityTable<Moment, 'id'>;
  nexts: EntityTable<Next, 'id'>;
  occasions: EntityTable<Occasion, 'id'>;
};

db.version(1).stores({
  persons: '++id, name, *aliases',
  facts: '++id, personId',
  moments: '++id, date, *personIds',
  nexts: '++id, personId, done',
  occasions: '++id, personId, date',
});

export interface Snapshot {
  persons: Person[];
  facts: Fact[];
  moments: Moment[];
  nexts: Next[];
  occasions: Occasion[];
}

export async function snapshot(): Promise<Snapshot> {
  const [persons, facts, moments, nexts, occasions] = await Promise.all([
    db.persons.toArray(),
    db.facts.toArray(),
    db.moments.toArray(),
    db.nexts.toArray(),
    db.occasions.toArray(),
  ]);
  return { persons, facts, moments, nexts, occasions };
}

export function aliasesFor(name: string): string[] {
  const parts = name.trim().toLowerCase().split(/\s+/);
  const out = new Set<string>([parts.join(' '), parts[0]]);
  return [...out];
}

export async function wipe(): Promise<void> {
  await db.transaction('rw', [db.persons, db.facts, db.moments, db.nexts, db.occasions], async () => {
    await Promise.all([db.persons.clear(), db.facts.clear(), db.moments.clear(), db.nexts.clear(), db.occasions.clear()]);
  });
}

// Regelbasiertes Verstehen einer Notiz ("kaffee mit jonas, er fängt montag bei siemens an").
// Bewusst ohne KI: läuft offline, kostet nichts. Ein LLM kann später dieselbe Proposal-Struktur liefern.

import { addDays, nextWeekday, parseDayMonth, WEEKDAYS } from './dates';

export interface KnownPerson {
  id: number;
  name: string;
  aliases: string[];
}

export interface ProposedPerson {
  id?: number;
  name: string;
  isNew: boolean;
}

export interface Proposal {
  text: string;
  date: string;
  label: string;
  people: ProposedPerson[];
  facts: { p: number; label: string; value: string }[];
  nexts: { p: number; text: string }[];
  occasions: { p: number; date: string; text: string }[];
  birthdays: { p: number; mmdd: string }[];
}

/** Fakten, von denen eine Person nur einen Wert hat (neuer Wert ersetzt alten). */
export const SINGLE_FACTS = new Set(['Job', 'Wohnort']);

const L = '\\p{L}';
const word = (w: string) => new RegExp(`(?<![${L}])${escapeRe(w)}(?![${L}])`, 'iu');

const STOP = new Set([
  'dem', 'der', 'den', 'die', 'das', 'einem', 'einer', 'einen', 'meiner', 'meinem', 'meinen', 'seiner', 'seinem',
  'ihrer', 'ihrem', 'uns', 'ihr', 'ihm', 'ihnen', 'allen', 'leuten', 'kollegen', 'freunden', 'familie', 'team',
  'mir', 'dir', 'euch', 'ist', 'hat', 'war', 'und', 'oder', 'auch', 'noch', 'schon', 'jetzt', 'heute', 'gestern',
  'morgen', 'zusammen', 'ihnen', 'beiden', 'kaffee', 'essen', 'bier', 'pizza',
]);
const MONTHS = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function cap(s: string): string {
  return s ? s[0].toLocaleUpperCase('de') + s.slice(1) : s;
}

function capWords(s: string): string {
  return s.split(/\s+/).map(cap).join(' ');
}

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/^(und|aber|dann)\s+/i, '').trim();
}

export function splitClauses(text: string): string[] {
  return text
    .split(/,|;|(?<!\d)\.(?=\s|$)|\s+und\s+(?=(?:er|sie|wir|ich|nächstes|die|der|das)\b)/iu)
    .map(clean)
    .filter(Boolean);
}

function findPeople(text: string, known: KnownPerson[]): ProposedPerson[] {
  const found: { pos: number; p: ProposedPerson }[] = [];
  const seen = new Set<number>();
  for (const k of known) {
    for (const a of [...k.aliases].sort((x, y) => y.length - x.length)) {
      const m = text.match(word(a));
      if (m && m.index !== undefined && !seen.has(k.id)) {
        seen.add(k.id);
        found.push({ pos: m.index, p: { id: k.id, name: k.name, isNew: false } });
      }
    }
  }
  const knownAliases = new Set(known.flatMap(k => k.aliases));
  // "mit X", "mit X und Y" ("bei X" wäre oft eine Firma oder ein Ort)
  const re = new RegExp(`(?<![${L}])mit\\s+([${L}]+)(?:\\s+und\\s+([${L}]+))?`, 'giu');
  for (const m of text.matchAll(re)) {
    for (const [i, raw] of [m[1], m[2]].entries()) {
      if (!raw) continue;
      const w = raw.toLowerCase();
      if (STOP.has(w) || knownAliases.has(w) || WEEKDAYS.includes(w) || MONTHS.includes(w) || w.length < 2) continue;
      // nur Wörter, die wie Namen aussehen: im Original groß geschrieben oder Text komplett klein (Diktat/Tippen)
      const looksLikeName = raw[0] === raw[0].toUpperCase() || text === text.toLowerCase();
      if (!looksLikeName) continue;
      if (found.some(f => f.p.name.toLowerCase() === w)) continue;
      found.push({ pos: (m.index ?? 0) + i, p: { name: cap(raw), isNew: true } });
    }
  }
  return found.sort((a, b) => a.pos - b.pos).map(f => f.p);
}

interface DateHit {
  date: string;
  rest: string;
}

function findDate(clause: string, today: string): DateHit | null {
  const lower = clause.toLowerCase();
  const dm = clause.match(/(?:am\s+)?(\d{1,2}\.\d{1,2}\.(?:\d{2,4})?)/);
  if (dm) {
    const d = parseDayMonth(dm[1], today);
    if (d) return { date: d, rest: clause.replace(dm[0], '') };
  }
  for (const wd of WEEKDAYS) {
    const m = clause.match(new RegExp(`(?:am\\s+|ab\\s+|nächsten\\s+)?${wd}`, 'iu'));
    if (m) {
      const d = nextWeekday(wd, today);
      if (d) return { date: d, rest: clause.replace(m[0], '') };
    }
  }
  if (/\bübermorgen\b/.test(lower)) return { date: addDays(today, 2), rest: clause.replace(/übermorgen/i, '') };
  if (/(?<![\p{L}])morgen(?![\p{L}])/u.test(lower)) return { date: addDays(today, 1), rest: clause.replace(/morgen/i, '') };
  if (/nächste woche/.test(lower)) return { date: addDays(today, 7), rest: clause.replace(/nächste woche/i, '') };
  const mo = lower.match(/im\s+(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)/);
  if (mo) {
    const idx = MONTHS.indexOf(mo[1]);
    const [ty, tm] = today.split('-').map(Number);
    const year = idx + 1 < tm ? ty + 1 : ty;
    return { date: `${year}-${String(idx + 1).padStart(2, '0')}-01`, rest: clause };
  }
  return null;
}

function stripPronoun(s: string): string {
  return clean(s.replace(/^(er|sie|die beiden|beide|wir)\s+/i, ''));
}

export function parseNote(text: string, known: KnownPerson[], today: string): Proposal {
  const clauses = splitClauses(text);
  const people = findPeople(text, known);
  const date = /\bgestern\b/i.test(text) ? addDays(today, -1) : today;
  const prop: Proposal = {
    text: text.trim(),
    date,
    label: cap(clauses[0] ?? text.trim()),
    people,
    facts: [],
    nexts: [],
    occasions: [],
    birthdays: [],
  };
  if (!people.length) return prop;

  for (const cl of clauses) {
    const lower = cl.toLowerCase();

    // Person im Satz bestimmen: wer namentlich vorkommt, sonst die erste
    const inClause = people.findIndex(p => word(p.name.split(' ')[0]).test(cl));
    const p = inClause >= 0 ? inClause : 0;

    const nm = cl.match(/nächstes\s+mal\s+(.+)/iu);
    if (nm) {
      const targets = inClause >= 0 ? [p] : people.map((_, i) => i);
      for (const t of targets) prop.nexts.push({ p: t, text: clean(nm[1]) });
      continue;
    }

    const bd = cl.match(/geburtstag\s+(?:ist\s+)?(?:am\s+)?(\d{1,2})\.(\d{1,2})\.?/iu) ?? cl.match(/(?:am\s+)?(\d{1,2})\.(\d{1,2})\.?\s+geburtstag/iu);
    if (bd) {
      prop.birthdays.push({ p, mmdd: `${bd[2].padStart(2, '0')}-${bd[1].padStart(2, '0')}` });
      continue;
    }

    const fam = cl.match(new RegExp(`(?<![${L}])(tochter|sohn|frau|mann|freundin|freund|partner|partnerin|hund|katze|baby)\\s+(?:heißt\\s+|namens\\s+|ist\\s+)?([${L}]+)`, 'iu'));
    if (fam && !STOP.has(fam[2].toLowerCase()) && !['hat', 'ist', 'war', 'kommt', 'wird'].includes(fam[2].toLowerCase())) {
      prop.facts.push({ p, label: 'Familie', value: `${cap(fam[1].toLowerCase())} ${cap(fam[2])}` });
    }

    const job = cl.match(new RegExp(`(?:arbeitet|fängt|startet|wechselt|anfangen|anfängt|ist jetzt)\\s+(?:[${L}]+\\s+)?(?:bei|zu)\\s+([${L}0-9&.-]+)`, 'iu'));
    if (job) prop.facts.push({ p, label: 'Job', value: cap(job[1]) });

    const move = cl.match(new RegExp(`(?:zieht|zog|ziehen)\\s+(?:[${L}]+\\s+)?nach\\s+([${L}-]+)`, 'iu')) ?? cl.match(new RegExp(`wohnt\\s+(?:jetzt\\s+)?in\\s+([${L}-]+)`, 'iu'));
    if (move) prop.facts.push({ p, label: 'Wohnort', value: capWords(move[1]) });

    const dh = findDate(cl, today);
    if (dh && !lower.startsWith('gestern')) {
      let t = stripPronoun(dh.rest);
      for (const pp of people) t = t.replace(word(pp.name.split(' ')[0]), '').trim();
      t = clean(t.replace(/^(mit|bei)\s+/i, ''));
      if (t) prop.occasions.push({ p, date: dh.date, text: t });
    }
  }
  return prop;
}

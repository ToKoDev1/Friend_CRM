// Datums-Helfer. Alle Daten werden als lokale ISO-Tage "YYYY-MM-DD" gespeichert.

export const WEEKDAYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  const d = fromIso(day);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86400000);
}

/** "18.10." oder "18.10.2026" relativ zu today: ohne Jahr das nächste Vorkommen ab today-30. */
export function parseDayMonth(s: string, today: string): string | null {
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (m[3]) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return iso(new Date(y, month - 1, day));
  }
  const t = fromIso(today);
  let cand = new Date(t.getFullYear(), month - 1, day);
  if (diffDays(today, iso(cand)) < -30) cand = new Date(t.getFullYear() + 1, month - 1, day);
  return iso(cand);
}

/** Nächster Wochentag ab heute (heute zählt mit). */
export function nextWeekday(name: string, today: string): string | null {
  const idx = WEEKDAYS.indexOf(name.toLowerCase());
  if (idx < 0) return null;
  const d = fromIso(today);
  const delta = (idx - d.getDay() + 7) % 7;
  return addDays(today, delta);
}

/** Geburtstag "MM-DD" -> nächstes Vorkommen ab today. */
export function nextBirthday(mmdd: string, today: string): string {
  const [m, d] = mmdd.split('-').map(Number);
  const t = fromIso(today);
  let cand = iso(new Date(t.getFullYear(), m - 1, d));
  if (cand < today) cand = iso(new Date(t.getFullYear() + 1, m - 1, d));
  return cand;
}

export function isoWeek(day: string): number {
  const d = fromIso(day);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

/** "Sa 18.10." */
export function short(day: string): string {
  const d = fromIso(day);
  return `${WD_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

/** "18.10." */
export function dm(day: string): string {
  const d = fromIso(day);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

export function monthName(day: string): string {
  return MONTHS[fromIso(day).getMonth()];
}

/** "10. bis 16. Okt" */
export function weekRange(today: string): string {
  const end = fromIso(addDays(today, 6));
  const start = fromIso(today);
  return `${start.getDate()}. bis ${end.getDate()}. ${MONTHS_SHORT[end.getMonth()]}`;
}

/** Freundlicher Abstand: "heute", "morgen", "Sa 18.10." */
export function when(day: string, today: string): string {
  const n = diffDays(today, day);
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === -1) return 'gestern';
  return short(day);
}

export function todayIso(): string {
  return iso(new Date());
}

// Befehle des Terminals. exec() bekommt eine Eingabezeile und liefert Zeilen für die Ausgabe.

import { db, aliasesFor, snapshot, wipe, type Person, type Snapshot } from '../lib/db';
import { addDays, dm, isoWeek, nextBirthday, parseDayMonth, short, todayIso, weekRange, when } from '../lib/dates';
import { cap, parseNote, SINGLE_FACTS, type Proposal } from '../lib/parse';
import { lastContact, openNexts, quietest, sinceText, weekCards } from '../lib/week';
import type { VContact } from '../lib/vcard';
import { C, box, dim, gap, keys, minus, ok, plus, row, sec, sub, text, warn, type L } from './ui';

export type Pending =
  | { kind: 'merken'; prop: Proposal }
  | { kind: 'import'; contacts: VContact[] }
  | { kind: 'löschen'; person: Person }
  | { kind: 'reset' }
  | { kind: 'gemeldet'; person: Person };

export interface Out {
  lines: L[];
  spin?: string;
  pending?: Pending;
  /** Text zurück ins Eingabefeld legen */
  fill?: string;
  /** Sonderaktionen, die die Oberfläche ausführt */
  action?: 'pickFile' | 'clear' | { open: string } | { download: string; name: string };
}

const nameCmd = (p: Person) => p.aliases[p.aliases.length - 1];

function find(snap: Snapshot, q: string): Person | undefined {
  const s = q.trim().toLowerCase();
  if (!s) return undefined;
  return (
    snap.persons.find(p => p.aliases.includes(s)) ??
    snap.persons.find(p => p.name.toLowerCase().startsWith(s)) ??
    snap.persons.find(p => p.name.toLowerCase().includes(s))
  );
}

/** Teilt "lena 0171 123" in Person + Rest; probiert lange Namen zuerst. */
function personAndRest(snap: Snapshot, arg: string): { p?: Person; rest: string } {
  const words = arg.trim().split(/\s+/);
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const p = find(snap, words.slice(0, n).join(' '));
    if (p) return { p, rest: words.slice(n).join(' ') };
  }
  return { rest: arg };
}

const notFound = (q: string): Out => ({
  lines: [warn(<>Niemand namens „{q}“. <C cmd={`neu ${cap(q)}`}>neu {cap(q)}</C> legt die Person an.</>)],
});

/* ---------- Ansichten ---------- */

export async function woche(): Promise<Out> {
  const today = todayIso();
  const snap = await snapshot();
  if (!snap.persons.length) return start();
  const { cards, more } = weekCards(snap, today);
  const lines: L[] = [
    row(`Woche ${isoWeek(today)}`, weekRange(today), 'acc', true),
    sub(<span className="dim">{cards.length ? `${cards.length} ${cards.length === 1 ? 'Mensch ist' : 'Menschen sind'} dran, sortiert nach Anlass` : 'Diese Woche ist nichts fällig.'}</span>),
  ];
  for (const c of cards) {
    const p = c.person;
    lines.push(gap());
    lines.push(row(<C cmd={nameCmd(p)}>{p.name}</C>, c.date ? when(c.date, today) : '', c.kind === 'rhythmus' ? 'dim' : ''));
    for (const r of c.reasons) lines.push(sub(c.kind === 'rhythmus' ? <span className="dim">{r}</span> : r));
    if (c.hint) lines.push(sub(<span className="q">{c.hint}</span>));
    lines.push(
      c.kind === 'rhythmus'
        ? keys([['m', 'melden', `schreiben ${nameCmd(p)}`], ['e', 'sehen uns eh', `eh ${nameCmd(p)}`], ['l', 'später', `später ${nameCmd(p)}`]])
        : keys([['s', 'schreiben', `schreiben ${nameCmd(p)}`], ['l', 'später', `später ${nameCmd(p)}`]]),
    );
  }
  if (more) lines.push(gap(), dim(`und ${more} weitere, die warten können`));
  if (!cards.length) {
    const q = quietest(snap, today);
    if (q.length) {
      lines.push(gap(), sec('lange nichts notiert'));
      for (const { p, last } of q) lines.push(sub(<><C cmd={nameCmd(p)}>{p.name}</C> <span className="dim">{sinceText(last === p.createdAt.slice(0, 10) ? undefined : last, today)}</span></>));
    }
  }
  return { lines, spin: `Lese ${snap.persons.length} Menschen und ${snap.moments.length} Notizen` };
}

export function start(): Out {
  return {
    lines: [
      row('Willkommen', '', 'acc', true),
      sub('Starte mit 5 bis 15 Menschen, die dir wichtig sind.'),
      gap(),
      sub(<><C cmd="import">import</C> <span className="dim">Kontakte aus einer vCard-Datei wählen</span></>),
      sub(<><C cmd="neu " cls="fillcmd">neu Lena Hoffmann</C> <span className="dim">eine Person anlegen</span></>),
      sub(<><C cmd="demo">demo</C> <span className="dim">mit Beispieldaten ausprobieren</span></>),
      gap(),
      dim('Danach erzählst du einfach, wen du getroffen hast.'),
    ],
  };
}

function hilfe(): Out {
  const h = (cmd: string, desc: string, run = cmd): L => sub(<><C cmd={run}>{cmd}</C> <span className="dim">{desc}</span></>);
  return {
    lines: [
      row('Befehle', '', 'acc', true),
      h('woche', 'wer diese Woche dran ist'),
      h('leute', 'alle Menschen'),
      h('lena', 'alles über eine Person', 'leute'),
      dim('  einfach erzählen: „kaffee mit lena, nächstes mal bouldern“'),
      gap(),
      sec('pflegen'),
      h('neu Name, kreis, geb 18.10., alle 6 wochen', 'Person anlegen', 'neu '),
      h('geburtstag lena 18.10.', 'Geburtstag setzen', 'geburtstag '),
      h('nummer lena 0171…', 'Nummer für WhatsApp', 'nummer '),
      h('rhythmus lena 6 wochen', 'wie oft du dich melden willst', 'rhythmus '),
      h('eh lena', 'sehen uns eh: nie erinnern', 'eh '),
      h('kreis lena uni', 'Kreis setzen', 'kreis '),
      h('netzwerk lena', 'beruflich statt nah', 'netzwerk '),
      gap(),
      sec('handeln'),
      h('schreiben lena', 'WhatsApp öffnen', 'schreiben '),
      h('gemeldet lena', 'Kontakt festhalten', 'gemeldet '),
      h('später lena', 'eine Woche zurückstellen', 'später '),
      h('erledigt lena', '„nächstes Mal“ abhaken', 'erledigt '),
      gap(),
      sec('daten'),
      h('import', 'vCard-Kontakte'),
      h('export', 'alles als Datei sichern'),
      h('löschen lena', 'Person entfernen', 'löschen '),
      h('clear', 'Bildschirm leeren'),
    ],
  };
}

async function leute(): Promise<Out> {
  const today = todayIso();
  const snap = await snapshot();
  if (!snap.persons.length) return start();
  const groups = new Map<string, Person[]>();
  for (const p of [...snap.persons].sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
    const g = p.lens === 'netzwerk' ? `netzwerk${p.circle ? `, ${p.circle}` : ''}` : p.circle ?? 'nah';
    groups.set(g, [...(groups.get(g) ?? []), p]);
  }
  const lines: L[] = [row(`${snap.persons.length} Menschen`, '', 'acc', true)];
  for (const [g, ps] of [...groups].sort(([a], [b]) => a.localeCompare(b, 'de'))) {
    lines.push(sec(g));
    for (const p of ps) {
      const last = lastContact(snap, p.id);
      lines.push(sub(<><C cmd={nameCmd(p)}>{p.name}</C> <span className="dim">{p.routine ? 'sehen uns eh' : sinceText(last, today)}</span></>));
    }
  }
  return { lines, spin: 'Sortiere' };
}

async function person(p: Person): Promise<Out> {
  const today = todayIso();
  const snap = await snapshot();
  const facts = snap.facts.filter(f => f.personId === p.id);
  const nexts = openNexts(snap, p.id);
  const occ = snap.occasions.filter(o => o.personId === p.id && o.date >= addDays(today, -1)).sort((a, b) => a.date.localeCompare(b.date));
  const moments = snap.moments.filter(m => m.personIds.includes(p.id)).sort((a, b) => b.date.localeCompare(a.date));
  const cmd = nameCmd(p);
  const meta = [p.lens === 'netzwerk' ? 'Netzwerk' : 'nah', p.circle, p.routine ? 'sehen uns eh' : p.rhythmDays ? `alle ${Math.round(p.rhythmDays / 7)} Wochen` : undefined].filter(Boolean).join(', ');
  const lines: L[] = [row(p.name, moments.length ? `${moments.length} Notizen` : '', 'acc', true), sub(<span className="dim">{meta}</span>)];

  lines.push(sec('nächstes mal'));
  lines.push(...(nexts.length ? nexts.map(n => sub(n.text)) : [sub(<span className="dim">nichts geplant</span>)]));
  if (occ.length) {
    lines.push(sec('anlässe'));
    lines.push(...occ.map(o => sub(<>{o.text} <span className="dim">{when(o.date, today)}</span></>)));
  }
  lines.push(sec('merker'));
  const merker: L[] = [];
  if (p.birthday) merker.push(sub(<>Geburtstag <span className="dim">{dm(nextBirthday(p.birthday, today))}</span></>));
  for (const f of facts) merker.push(sub(<>{f.label === 'Familie' ? f.value : `${f.label}: ${f.value}`}</>));
  if (p.phone) merker.push(sub(<span className="dim">{p.phone}</span>));
  lines.push(...(merker.length ? merker : [sub(<span className="dim">noch keine</span>)]));
  lines.push(sec('verlauf'));
  if (!moments.length) lines.push(sub(<span className="dim">noch nichts notiert</span>));
  for (const m of moments.slice(0, 6)) {
    lines.push(text(<><span className="dim">{dm(m.date)}</span>  {m.kind === 'gemeldet' ? <span className="dim">gemeldet</span> : m.text}</>, 'log'));
  }
  if (moments.length > 6) lines.push(dim(`  und ${moments.length - 6} ältere`));
  lines.push(gap(), keys([['s', 'schreiben', `schreiben ${cmd}`], ['g', 'gemeldet', `gemeldet ${cmd}`], ['l', 'später', `später ${cmd}`]]));
  if (!p.phone || !p.birthday) {
    lines.push(dim(`  fehlt: ${[!p.phone && `nummer ${cmd} …`, !p.birthday && `geburtstag ${cmd} TT.MM.`].filter(Boolean).join(', ')}`));
  }
  return { lines, spin: `Suche ${p.name.split(' ')[0]}` };
}

/* ---------- Festhalten ---------- */

async function merken(input: string): Promise<Out> {
  const today = todayIso();
  const snap = await snapshot();
  const prop = parseNote(input, snap.persons, today);
  if (!prop.people.length) {
    return {
      lines: [
        warn('Ich habe niemanden erkannt.'),
        dim('  Nenne einen Namen, z. B. „kaffee mit lena“, oder lege die Person mit „neu …“ an.'),
      ],
    };
  }
  const lines: L[] = [];
  const who = prop.people.map(p => p.name).join(', ');
  lines.push(text(<><span className="dot acc">●</span><span className="nm big">merken</span>(<span className="nm">{who}</span>)</>, ''));
  let n = 0;
  for (const p of prop.people) if (p.isNew) { lines.push(plus('Neu', p.name)); n++; }
  lines.push(plus('Moment', `${prop.label}, ${dm(prop.date)}`)); n++;
  const multi = prop.people.length > 1;
  const tag = (i: number) => (multi ? ` (${prop.people[i].name.split(' ')[0]})` : '');
  for (const f of prop.facts) {
    const pid = prop.people[f.p].id;
    if (pid && SINGLE_FACTS.has(f.label)) {
      const old = snap.facts.find(x => x.personId === pid && x.label === f.label);
      if (old && old.value !== f.value) { lines.push(minus(f.label, old.value)); n++; }
      if (old && old.value === f.value) continue;
    }
    lines.push(plus(f.label, f.value + tag(f.p))); n++;
  }
  for (const b of prop.birthdays) { lines.push(plus('Geburtstag', `${b.mmdd.slice(3)}.${b.mmdd.slice(0, 2)}.${tag(b.p)}`)); n++; }
  for (const x of prop.nexts) { lines.push(plus('Nächstes Mal', x.text + tag(x.p))); n++; }
  for (const o of prop.occasions) { lines.push(plus('Anlass', `${o.text}, ${short(o.date)}${tag(o.p)}`)); n++; }
  lines.splice(1, 0, sub(<span className="dim">{n} {n === 1 ? 'Änderung' : 'Änderungen'}</span>));
  lines.push(gap(), text(<>Übernehmen?   <C cmd="j" cls="kbtn"><span className="key">[j]</span> ja</C>   <C cmd="ä" cls="kbtn"><span className="key">[ä]</span> ändern</C>   <C cmd="n" cls="kbtn"><span className="key">[n]</span> verwerfen</C></>, 'keys0'));
  return { lines, spin: 'Höre zu und sortiere', pending: { kind: 'merken', prop } };
}

async function speichern(prop: Proposal): Promise<Out> {
  const now = new Date().toISOString();
  const ids: number[] = [];
  await db.transaction('rw', [db.persons, db.facts, db.moments, db.nexts, db.occasions], async () => {
    for (const p of prop.people) {
      if (p.id) ids.push(p.id);
      else ids.push((await db.persons.add({ name: p.name, aliases: aliasesFor(p.name), lens: 'nah', createdAt: now } as Person)) as number);
    }
    await db.moments.add({ date: prop.date, text: prop.text, personIds: ids, kind: 'notiz' } as never);
    for (const f of prop.facts) {
      if (SINGLE_FACTS.has(f.label)) await db.facts.where({ personId: ids[f.p] }).filter(x => x.label === f.label).delete();
      await db.facts.add({ personId: ids[f.p], label: f.label, value: f.value, createdAt: now } as never);
    }
    for (const x of prop.nexts) await db.nexts.add({ personId: ids[x.p], text: x.text, done: 0, createdAt: now } as never);
    for (const o of prop.occasions) await db.occasions.add({ personId: ids[o.p], date: o.date, text: o.text } as never);
    for (const b of prop.birthdays) await db.persons.update(ids[b.p], { birthday: b.mmdd });
  });
  const lines: L[] = [ok('Gespeichert.')];
  const today = todayIso();
  for (const o of prop.occasions) {
    if (o.date <= addDays(today, 6)) lines.push(dim(`  ${prop.people[o.p].name.split(' ')[0]} steht ${when(o.date, today)} auf deiner Liste.`));
  }
  return { lines };
}

/* ---------- Pflegen ---------- */

async function neu(arg: string): Promise<Out> {
  const parts = arg.split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return { lines: [dim('  So geht es: neu Lena Hoffmann, uni, geb 18.10., alle 6 wochen')], fill: 'neu ' };
  const name = parts[0].split(/\s+/).map(cap).join(' ');
  const snap = await snapshot();
  if (snap.persons.some(p => p.name.toLowerCase() === name.toLowerCase())) return { lines: [warn(<><C cmd={name.toLowerCase()}>{name}</C> gibt es schon.</>)] };
  const p: Omit<Person, 'id'> = { name, aliases: aliasesFor(name), lens: 'nah', createdAt: new Date().toISOString() };
  for (const raw of parts.slice(1)) {
    const s = raw.toLowerCase();
    const geb = s.match(/^(?:geb\.?|geburtstag)\s*(\d{1,2})\.(\d{1,2})\.?/);
    const rh = s.match(/^alle\s+(\d+)\s*(tage?|wochen?|monate?)/);
    if (geb) p.birthday = `${geb[2].padStart(2, '0')}-${geb[1].padStart(2, '0')}`;
    else if (rh) p.rhythmDays = Number(rh[1]) * (rh[2].startsWith('tag') ? 1 : rh[2].startsWith('woche') ? 7 : 30);
    else if (s === 'netzwerk' || s === 'beruflich') p.lens = 'netzwerk';
    else if (s === 'eh' || s === 'sehen uns eh') p.routine = true;
    else if (/^[+\d][\d\s/-]{5,}$/.test(s)) p.phone = s.replace(/[^\d+]/g, '');
    else p.circle = raw;
  }
  // Duplikat-Vorname: dann zählt nur der volle Name als Alias
  const first = p.aliases[p.aliases.length - 1];
  if (p.aliases.length > 1 && snap.persons.some(x => x.aliases.includes(first))) p.aliases = [p.aliases[0]];
  await db.persons.add(p as Person);
  const lines: L[] = [ok(<><C cmd={p.aliases[0]}>{name}</C> angelegt.</>)];
  if (!p.rhythmDays && !p.routine) lines.push(dim(`  Wie oft willst du dich melden? rhythmus ${p.aliases[0]} 6 wochen`));
  return { lines };
}

async function setField(snap: Snapshot, verb: string, arg: string): Promise<Out> {
  const { p, rest } = personAndRest(snap, arg);
  if (!p) return arg.trim() ? notFound(arg.trim().split(/\s+/)[0]) : { lines: [dim(`  ${verb} <name> …`)], fill: `${verb} ` };
  const name = <C cmd={nameCmd(p)}>{p.name.split(' ')[0]}</C>;
  const today = todayIso();
  switch (verb) {
    case 'geburtstag': {
      const d = parseDayMonth(rest.replace(/\.?$/, '.').replace('..', '.'), today);
      if (!d) return { lines: [warn('Datum bitte als TT.MM., z. B. 18.10.')] };
      await db.persons.update(p.id, { birthday: d.slice(5) });
      return { lines: [ok(<>Geburtstag von {name}: {dm(d)}</>)] };
    }
    case 'nummer': {
      const num = rest.replace(/[^\d+]/g, '');
      if (num.length < 6) return { lines: [warn('Das sieht nicht nach einer Nummer aus.')] };
      await db.persons.update(p.id, { phone: num });
      return { lines: [ok(<>Nummer von {name} gespeichert.</>)] };
    }
    case 'rhythmus': {
      if (/aus|kein|nie/.test(rest)) {
        await db.persons.update(p.id, { rhythmDays: null });
        return { lines: [ok(<>Kein Rhythmus mehr für {name}.</>)] };
      }
      const m = rest.match(/(\d+)\s*(tage?|wochen?|monate?)/);
      if (!m) return { lines: [warn('Zum Beispiel: rhythmus lena 6 wochen')] };
      const days = Number(m[1]) * (m[2].startsWith('tag') ? 1 : m[2].startsWith('woche') ? 7 : 30);
      await db.persons.update(p.id, { rhythmDays: days, routine: false });
      return { lines: [ok(<>{name}: alle {m[1]} {m[2]}</>)] };
    }
    case 'eh':
      await db.persons.update(p.id, { routine: !p.routine });
      return { lines: [ok(p.routine ? <>{name} kann wieder auftauchen.</> : <>Mit {name} bist du ohnehin in Kontakt. Keine Erinnerungen mehr.</>)] };
    case 'kreis':
      await db.persons.update(p.id, { circle: rest.trim() || undefined });
      return { lines: [ok(<>{name}: Kreis {rest.trim() || 'entfernt'}</>)] };
    case 'netzwerk':
    case 'nah':
      await db.persons.update(p.id, { lens: verb });
      return { lines: [ok(<>{name} steht jetzt unter {verb}.</>)] };
    case 'später':
      await db.persons.update(p.id, { snoozeUntil: addDays(today, 7) });
      return { lines: [ok(<>{name} ist bis {short(addDays(today, 7))} zurückgestellt.</>)] };
    case 'gemeldet':
      await db.moments.add({ date: today, text: 'gemeldet', personIds: [p.id], kind: 'gemeldet' } as never);
      await db.persons.update(p.id, { snoozeUntil: undefined });
      return { lines: [ok(<>Festgehalten: heute bei {name} gemeldet.</>), dim(`  Gibt es etwas zu merken? Erzähl einfach: „${p.name.split(' ')[0].toLowerCase()} …“`)] };
    case 'erledigt': {
      const n = await db.nexts.where({ personId: p.id }).filter(x => !x.done).modify({ done: 1 });
      return { lines: [ok(<>{n} {n === 1 ? 'Punkt' : 'Punkte'} bei {name} abgehakt.</>)] };
    }
    case 'schreiben':
    case 'anrufen': {
      if (!p.phone) return { lines: [warn(<>Für {name} ist keine Nummer gespeichert.</>), dim(`  nummer ${nameCmd(p)} 0171 …`)], fill: `nummer ${nameCmd(p)} ` };
      const digits = p.phone.replace(/^00/, '+').replace(/^0/, '+49').replace(/\D/g, '');
      const url = verb === 'schreiben' ? `https://wa.me/${digits}` : `tel:${p.phone}`;
      return {
        lines: [text(<><span className="acc">↗</span> {verb === 'schreiben' ? 'WhatsApp' : 'Telefon'} für {name} öffnet sich.</>, ''), text(<>Gemeldet?   <C cmd="j" cls="kbtn"><span className="key">[j]</span> ja</C>   <C cmd="n" cls="kbtn"><span className="key">[n]</span> noch nicht</C></>, 'keys0')],
        action: { open: url },
        pending: { kind: 'gemeldet', person: p },
      };
    }
    case 'löschen':
      return { lines: [warn(<>{p.name} mit allen Notizen löschen?</>), text(<><C cmd="j" cls="kbtn"><span className="key">[j]</span> ja, löschen</C>   <C cmd="n" cls="kbtn"><span className="key">[n]</span> abbrechen</C></>, 'keys0')], pending: { kind: 'löschen', person: p } };
  }
  return { lines: [] };
}

/* ---------- Daten ---------- */

export function importList(contacts: VContact[]): Out {
  if (!contacts.length) return { lines: [warn('In der Datei habe ich keine Kontakte gefunden.')] };
  const lines: L[] = [row(`${contacts.length} Kontakte gefunden`, '', 'acc', true), sub(<span className="dim">Wähle 5 bis 15, die dir wichtig sind. Zum Beispiel: 1 4 7-9</span>)];
  contacts.slice(0, 300).forEach((c, i) => {
    lines.push(text(<><span className="dim num">{String(i + 1).padStart(3, ' ')}</span>  {c.name}{c.birthday ? <span className="dim">  geb. {c.birthday.slice(3)}.{c.birthday.slice(0, 2)}.</span> : null}</>, 'log'));
  });
  if (contacts.length > 300) lines.push(dim(`  und ${contacts.length - 300} weitere (nur die ersten 300 wählbar)`));
  return { lines, pending: { kind: 'import', contacts }, spin: 'Lese Kontakte' };
}

async function importPick(contacts: VContact[], sel: string): Promise<Out> {
  const idx = new Set<number>();
  for (const part of sel.split(/[\s,]+/)) {
    const r = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!r) continue;
    const a = Number(r[1]);
    const b = r[2] ? Number(r[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= Math.min(contacts.length, 300)) idx.add(i - 1);
  }
  if (!idx.size) return { lines: [warn('Bitte Nummern angeben, z. B. 1 4 7-9')], pending: { kind: 'import', contacts } };
  const snap = await snapshot();
  const now = new Date().toISOString();
  const added: string[] = [];
  for (const i of [...idx].sort((x, y) => x - y)) {
    const c = contacts[i];
    if (snap.persons.some(p => p.name.toLowerCase() === c.name.toLowerCase())) continue;
    await db.persons.add({ name: c.name, aliases: aliasesFor(c.name), lens: 'nah', phone: c.phone, birthday: c.birthday, createdAt: now } as Person);
    added.push(c.name);
  }
  return {
    lines: [ok(`${added.length} ${added.length === 1 ? 'Mensch' : 'Menschen'} übernommen.`), ...added.map(n => sub(n)), gap(), dim('  Tipp: rhythmus <name> 6 wochen, damit jemand regelmäßig auftaucht.'), text(<>  Weiter mit <C cmd="woche">woche</C></>, '')],
  };
}

async function exportData(): Promise<Out> {
  const snap = await snapshot();
  const json = JSON.stringify({ app: 'leute', version: 1, exportedAt: new Date().toISOString(), ...snap }, null, 2);
  return { lines: [ok(`Export mit ${snap.persons.length} Menschen und ${snap.moments.length} Notizen erstellt.`)], action: { download: json, name: `leute-${todayIso()}.json` } };
}

async function demo(): Promise<Out> {
  const snap = await snapshot();
  if (snap.persons.length) return { lines: [warn('Demo geht nur, solange noch niemand angelegt ist.')] };
  const t = todayIso();
  const now = new Date().toISOString();
  const add = (name: string, extra: Partial<Person> = {}) => db.persons.add({ name, aliases: aliasesFor(name), lens: 'nah', createdAt: '2026-01-01T00:00:00.000Z', ...extra } as Person) as Promise<number>;
  const lena = await add('Lena Hoffmann (Beispiel)', { circle: 'uni', birthday: nextBirthday(addDays(t, 4).slice(5), t).slice(5), aliases: ['lena hoffmann', 'lena'] });
  const jonas = await add('Jonas Weber (Beispiel)', { circle: 'arbeit', lens: 'netzwerk', aliases: ['jonas weber', 'jonas'] });
  const mo = await add('Mo (Beispiel)', { circle: 'nachbarn', rhythmDays: 28, aliases: ['mo'] });
  const sarah = await add('Sarah Klein (Beispiel)', { circle: 'schule', rhythmDays: 60, aliases: ['sarah klein', 'sarah'] });
  await db.moments.bulkAdd([
    { date: addDays(t, -150), text: 'Kaffee, sie plant einen Umzug', personIds: [lena], kind: 'notiz' },
    { date: addDays(t, -70), text: 'Grillen bei Mo, Lena denkt über Jobwechsel nach', personIds: [lena, mo], kind: 'notiz' },
    { date: addDays(t, -120), text: 'Telefoniert', personIds: [sarah], kind: 'notiz' },
    { date: addDays(t, -20), text: 'Mittag, er wechselt zu Siemens', personIds: [jonas], kind: 'notiz' },
  ] as never);
  await db.nexts.bulkAdd([
    { personId: lena, text: 'bouldern gehen', done: 0, createdAt: now },
    { personId: mo, text: 'ihr seid mit Kochen dran', done: 0, createdAt: now },
  ] as never);
  await db.facts.bulkAdd([
    { personId: lena, label: 'Familie', value: 'Freund Tim', createdAt: now },
    { personId: jonas, label: 'Job', value: 'Siemens', createdAt: now },
  ] as never);
  await db.occasions.add({ personId: jonas, date: addDays(t, 2), text: 'erster Arbeitstag' } as never);
  const w = await woche();
  return { lines: [ok('Beispieldaten geladen. Mit „reset“ fängst du später leer an.'), gap(), ...w.lines] };
}

/* ---------- Dispatcher ---------- */

const VERBS = ['geburtstag', 'nummer', 'rhythmus', 'eh', 'kreis', 'netzwerk', 'nah', 'später', 'gemeldet', 'erledigt', 'schreiben', 'anrufen', 'löschen'];

export async function exec(input: string, pending?: Pending): Promise<Out> {
  const raw = input.trim();
  const low = raw.toLowerCase();

  if (pending) {
    const yes = ['j', 'ja', 'y', 'yes', 'ok'].includes(low);
    const no = ['n', 'nein', 'no', 'abbrechen'].includes(low);
    if (pending.kind === 'merken') {
      if (yes) return speichern(pending.prop);
      if (low === 'ä' || low === 'ändern' || low === 'a') return { lines: [dim('  Text liegt wieder im Eingabefeld.')], fill: pending.prop.text };
      if (no) return { lines: [dim('  Verworfen.')] };
    }
    if (pending.kind === 'import') {
      if (/^[\d\s,-]+$/.test(raw)) return importPick(pending.contacts, raw);
      if (no) return { lines: [dim('  Import abgebrochen.')] };
    }
    if (pending.kind === 'löschen') {
      if (yes) {
        const id = pending.person.id;
        await db.transaction('rw', [db.persons, db.facts, db.moments, db.nexts, db.occasions], async () => {
          await db.persons.delete(id);
          await db.facts.where({ personId: id }).delete();
          await db.nexts.where({ personId: id }).delete();
          await db.occasions.where({ personId: id }).delete();
          await db.moments.where('personIds').equals(id).modify(m => { m.personIds = m.personIds.filter(x => x !== id); });
          await db.moments.filter(m => m.personIds.length === 0).delete();
        });
        return { lines: [ok(`${pending.person.name} gelöscht.`)] };
      }
      if (no) return { lines: [dim('  Nichts gelöscht.')] };
    }
    if (pending.kind === 'reset') {
      if (yes) { await wipe(); return { lines: [ok('Alles gelöscht.'), gap(), ...start().lines] }; }
      if (no) return { lines: [dim('  Nichts gelöscht.')] };
    }
    if (pending.kind === 'gemeldet') {
      if (yes) return exec(`gemeldet ${pending.person.aliases[0]}`);
      if (no) return { lines: [dim('  Okay, bleibt auf der Liste.')] };
    }
  }

  if (!raw || low === 'woche' || low === 'w') return woche();
  if (low === '?' || low === 'hilfe' || low === 'help') return hilfe();
  if (low === 'leute' || low === 'alle' || low === 'l') return leute();
  if (low === 'clear' || low === 'cls') return { lines: [], action: 'clear' };
  if (low === 'import') return { lines: [dim('  Wähle eine .vcf-Datei. Auf dem iPhone: Kontakte teilen, „In Dateien sichern“.')], action: 'pickFile' };
  if (low === 'export') return exportData();
  if (low === 'demo') return demo();
  if (low === 'reset') return { lines: [warn('Wirklich alle Menschen und Notizen löschen?'), text(<><C cmd="j" cls="kbtn"><span className="key">[j]</span> ja, alles löschen</C>   <C cmd="n" cls="kbtn"><span className="key">[n]</span> abbrechen</C></>, 'keys0')], pending: { kind: 'reset' } };
  if (low === 'neu' || low.startsWith('neu ')) return neu(raw.slice(3));

  const verb = VERBS.find(v => low === v || low.startsWith(v + ' '));
  const snap = await snapshot();
  if (verb) return setField(snap, verb, raw.slice(verb.length));

  const p = find(snap, low);
  if (p && (p.aliases.includes(low) || low.split(/\s+/).length <= 2)) return person(p);

  if (low.split(/\s+/).length >= 2) return merken(raw);
  return notFound(raw);
}

export { box };

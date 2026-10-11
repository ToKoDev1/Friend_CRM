// Minimaler vCard-Leser für den Start-Import (Export aus iPhone-Kontakten oder Google).

export interface VContact {
  name: string;
  phone?: string;
  /** "MM-DD" */
  birthday?: string;
}

export function parseVcards(text: string): VContact[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const out: VContact[] = [];
  for (const block of unfolded.split(/BEGIN:VCARD/i).slice(1)) {
    const lines = block.split(/\r?\n/);
    const get = (key: string) => lines.find(l => l.toUpperCase().startsWith(key + ':') || l.toUpperCase().startsWith(key + ';'));
    const val = (l?: string) => (l ? l.slice(l.indexOf(':') + 1).trim() : undefined);
    let name = val(get('FN'));
    if (!name) {
      const n = val(get('N'))?.split(';');
      if (n) name = [n[1], n[0]].filter(Boolean).join(' ');
    }
    name = name?.replace(/\\,/g, ',').trim();
    if (!name) continue;
    const phone = val(get('TEL'))?.replace(/[^\d+]/g, '') || undefined;
    let birthday: string | undefined;
    const b = val(get('BDAY'));
    if (b) {
      const m = b.match(/(?:\d{4}|--)-?(\d{2})-?(\d{2})/);
      if (m) birthday = `${m[1]}-${m[2]}`;
    }
    out.push({ name, phone, birthday });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

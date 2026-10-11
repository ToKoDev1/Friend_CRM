# leute (Friend-CRM)

Privates "Gedächtnis für deine Menschen" von Tobias. Erst nur für ihn selbst, Schwerpunkt Freunde, läuft als PWA auf dem iPhone.
Hintergrund und Panel-Ergebnis: `C:\Users\TobiasKosiek\OneDrive - Ritzenhoefer GmbH\Desktop\Claude_Code\06_Friend_CRM\Panel-Ergebnis.md`.
Scope: `docs/scope.md`. Den Scope nicht eigenmächtig erweitern.

## Stack
- Vite + React + TypeScript (strict), `vite-plugin-pwa`
- Daten lokal in IndexedDB über Dexie (`src/lib/db.ts`). Kein Backend, keine Konten. Sync (Supabase, Frankfurt) kommt später.
- Notizen verstehen: regelbasiert in `src/lib/parse.ts`. Ein LLM (Mistral, EU) darf später dieselbe `Proposal`-Struktur liefern, schreibt aber nie direkt, der Nutzer bestätigt immer.

## Aufbau
- `src/lib/` reine Logik mit Tests (`*.test.ts`, Vitest): Datum, Parser, Wochenlogik, vCard
- `src/shell/commands.tsx` alle Befehle, `exec()` liefert Zeilen
- `src/shell/ui.tsx` Zeilen-Bausteine (row, sub, keys, plus/minus für Diffs)
- `src/App.tsx` Terminal: Spinner, Zeilen nacheinander ausgeben, Eingabe, Diktat

## Design
Terminal-Stil wie Claude Code, bewusst nur dunkel. Tokens in `src/index.css`. IBM Plex Mono, Martian Mono nur fürs Logo. Ein Akzent (Bernstein), Grün/Rot nur für Diffs.
Eingabefeld 16px (sonst zoomt iOS). Alles Antippbare ist ein `<C cmd="…">`.

## Sprache und Ton (Microcopy)
- Deutsch, kurz, sachlich. Die App spricht nicht wie ein Mensch ("mir fällt ein …" ist tabu).
- Anlass vor Abstand: "Geburtstag", "erster Arbeitstag" statt "seit 47 Tagen".
- Ehrlich: Die App weiß nur, was notiert wurde ("seit Juni nichts notiert", nie "kein Kontakt seit Juni").
- Verboten: überfällig, Score, Streak, Lead, rote Zähler, Schuldgefühle.

## Regeln
- Jede Logikänderung mit Test. `npm test` und `npm run build` müssen grün sein.
- Keine Daten über Dritte an externe Dienste ohne ausdrückliche Entscheidung von Tobias.
- Keine Gedankenstriche in UI-Texten.

# Scope

## Jetzt (v0.1, lokal)
- Terminal-Oberfläche mit Spinner und Zeilen-Ausgabe
- `woche`: höchstens 5 Karten, Anlass vor Rhythmus, Geburtstage, "sehen uns eh", "später"
- Festhalten per Text oder Diktat, Ergebnis als Diff, Bestätigen mit `j`
- Personenansicht: nächstes Mal, Anlässe, Merker, Verlauf
- `neu`, `import` (vCard, 5 bis 15 auswählen), `export` (JSON), `demo`, `reset`
- Pflege-Befehle: geburtstag, nummer, rhythmus, eh, kreis, netzwerk/nah, später, gemeldet, erledigt, löschen
- WhatsApp/Telefon per Link, danach Rückfrage "Gemeldet?"
- PWA, offline, Daten nur auf dem Gerät

## Später (in dieser Reihenfolge, je nach Nutzung)
1. Hosting über HTTPS, damit die App aufs iPhone kommt
2. Sync und Backup (Supabase Frankfurt, RLS)
3. KI-Verstehen von Notizen (Mistral), Ergebnis weiter als Diff zur Bestätigung
4. Push oder E-Mail-Wochenrückblick
5. Terminumfrage-Link für Freunde ohne App
6. Kalender-Rückblick (private iCal-URL)
7. LinkedIn-CSV-Import mit Jobwechsel-Vergleich

## Nie
Scraping, Chats mitlesen, Anrufliste, Standort, automatisch Nachrichten senden, Scores für Menschen.

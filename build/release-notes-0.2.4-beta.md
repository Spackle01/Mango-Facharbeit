Mango arbeitet jetzt direkt in den Dateien, die du abgibst, und schreibt kürzer und einfacher.

## Neu

- **Originale geschützt, Arbeit in den Abgabe-Dateien:**
  - `00_vorgaben/` enthält alle Originale der Schule (PDFs und Lerntagebuch-Vorlage). Sie sind schreibgeschützt; ändert die KI dort etwas, setzt Mango es zurück.
  - `abgabe/` enthält die Dateien, die du abgibst: `Lerntagebuch_Nachname_Vorname.docx` (Kopie der Schulvorlage, Deckblatt schon ausgefüllt) und `Facharbeit_Nachname_Vorname.docx` (Format der Schule mit Kapitelgerüst). Im Bereich „Dateien“ stehen sie ganz oben.
  - Bestehende Projekte bekommen den Ordner beim nächsten Öffnen. Ein schon ausgefülltes Lerntagebuch aus `06_…` und Kapitel aus `05_…` werden übernommen.
- **Die KI trägt direkt in Word ein:** Statt Markdown-Dateien zu erzeugen, nennt die KI ihre Änderungen, und Mango trägt sie in die Word-Datei ein: Absätze ausfüllen oder ersetzen, Platzhalter füllen, Text einfügen, Tabellenzeilen anhängen, Bilder (z. B. die Mindmap) einfügen. Schrift, Abstände, Tabellen und Deckblatt der Vorlage bleiben erhalten, die alte Fassung wird vorher gesichert. Unter der Antwort steht „In Word eingetragen“. Ist die Datei gerade in Word geöffnet, gibt es den Knopf „Erneut eintragen“.
- **Schreib-Skills immer aktiv:** Die Regeln der Humanize-Skills (`wissenschaftlich-schreiben`, `sprachpruefung`) werden bei jeder Nachricht mitgeschickt. Vor jedem Text für eine Datei muss die KI den Skill laden und danach prüfen.
- **Automatische Sprachprüfung:** Jeden Text, den die KI in eine Datei schreibt, prüft Mango auf Floskeln, gehäufte Stilwörter, Quellenangaben ohne Beleg, Geviertstriche, englische Anführungszeichen und Sätze über 25 Wörter. Gefundene Stellen überarbeitet die KI einmal selbst. Unter der Antwort steht das Ergebnis („Sprachprüfung: unauffällig“ oder was noch zu prüfen ist).
- **Kurz und einfach:** Chat-Antworten haben meist zwei bis fünf Sätze, Lerntagebuch-Einträge ebenfalls. Keine Floskeln, keine Wiederholung von Dateiinhalten im Chat.

## Download

- **`Mango-Facharbeit-Setup-0.2.4-beta.exe`** für Windows 10/11 (64 Bit).
- `….exe.sha256` enthält die Prüfsumme.

## Voraussetzung

Mindestens ein KI-Anbieter, installiert und einmal angemeldet:

- **Claude Code CLI** ([Anleitung](https://code.claude.com/docs/en/setup)): in der PowerShell `irm https://claude.ai/install.ps1 | iex`, danach `claude auth login`
- **Antigravity CLI (agy)** ([Anleitung](https://antigravity.google/docs/getting-started?tab=cli)): in der PowerShell `irm https://antigravity.google/cli/install.ps1 | iex`, danach einmal `agy` starten und mit dem Google-Konto anmelden. Ältere Versionen aktualisierst du mit `agy update`.

## Installieren

1. Setup herunterladen und doppelklicken. Es ersetzt die vorherige Beta, Projekte und Einstellungen bleiben erhalten.
2. Windows SmartScreen meldet einen „unbekannten Herausgeber“, weil diese Beta nicht signiert ist: **Weitere Informationen → Trotzdem ausführen**.

## Bekannte Einschränkungen der Beta

- Installer und App sind nicht signiert (SmartScreen-Hinweis).
- Eintragen in Word und Sprachprüfung wurden mit der echten Claude Code CLI getestet. Mit Antigravity laufen sie über denselben Weg, wurden aber nicht mit einem angemeldeten Google-Konto getestet.
- Word-Felder wie das Inhaltsverzeichnis aktualisiert Word beim Öffnen (sonst: Rechtsklick → Felder aktualisieren).
- Für macOS und Linux gibt es keine fertige Datei. Dort startest du die App mit Node.js über `npm start` bzw. `npm run desktop`.

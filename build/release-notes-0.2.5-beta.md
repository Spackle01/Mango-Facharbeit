Mango erstellt jetzt PDF, PowerPoint, Excel und Word, räumt den Arbeitsordner auf und antwortet noch kürzer.

## Neu

- **PDF, PowerPoint, Excel und Word erstellen:** Bitte die KI z. B. um eine Präsentation für die Verteidigung oder um die Facharbeit als PDF. Mango erzeugt die Datei, legt sie in `abgabe/` ab und zeigt sie unter der Antwort als Karte mit **Ansehen** und **Öffnen**. Folien haben Sprechernotizen, Tabellen und Bilder werden übernommen.
- **Vorschau in der App:** PDF im eingebauten Viewer, Word, PowerPoint und Excel als vereinfachte Ansicht, dazu Bilder und Text. „Im Programm öffnen“, „Im Ordner zeigen“ und „Herunterladen“ sind im selben Fenster. Auch Klicks auf Dateien im Bereich „Dateien“ öffnen die Vorschau.
- **Arbeitsordner aufgeräumt:** Mango erkennt lose Dateien, Entwürfe in `abgabe/`, alte Fassungen, Kopien und Platzhalter-Namen. Die KI räumt sie auf, nichts wird gelöscht: Aussortiertes liegt im Papierkorb der App, unter der Antwort gibt es **Rückgängig**. Originale und deine Abgabe-Dateien bleiben unberührt, ebenso Dateien, die schon vor dem Projekt im Ordner lagen.
- **Neue Knöpfe:** Oben rechts öffnet das Ordner-Symbol den Arbeitsordner. Im Bereich „Dateien“ gibt es „Arbeitsordner öffnen“ und „Aufräumen“.
- **Schreib-Skills werden geprüft:** Mango erkennt, ob die KI `wissenschaftlich-schreiben` und `sprachpruefung` geladen hat, und lässt fehlende nachholen. Unter der Antwort steht „Schreib-Skills gelesen“ oder „nachgeholt“.
- **Noch kürzere Antworten:** Bei jeder Nachricht gilt: höchstens drei kurze Sätze, einfache Wörter, keine Listen.

## Download

- **`Mango-Facharbeit-Setup-0.2.5-beta.exe`** für Windows 10/11 (64 Bit).
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
- Die neuen Funktionen wurden mit der echten Claude Code CLI getestet. Mit Antigravity laufen sie über denselben Weg, wurden aber nicht mit einem angemeldeten Google-Konto getestet.
- Die Vorschau für Word, PowerPoint und Excel ist vereinfacht (kein Layout, keine Bilder). Das echte Aussehen siehst du über „Im Programm öffnen“.
- Das PDF-Layout ist schlicht (Arial-Optik, A4); Inhaltsverzeichnis und Seitenzahlen im Stil der Schule gibt es nur in der Word-Datei.
- Für macOS und Linux gibt es keine fertige Datei. Dort startest du die App mit Node.js über `npm start` bzw. `npm run desktop`.

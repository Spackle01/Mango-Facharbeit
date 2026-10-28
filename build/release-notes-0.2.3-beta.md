Antigravity-Anbindung überarbeitet: Ich habe Mango gegen die aktuelle Antigravity CLI (agy 1.3.1) geprüft und an ihr Verhalten angepasst.

## Behoben

- **Leere Antworten und Abbrüche bei Antigravity:**
  - **Dateien schreiben:** Antigravity darf im Hintergrund jetzt Dateien im Arbeitsraum ändern (`--mode accept-edits`). Bisher hat agy Dateiänderungen ohne Rückfrage verweigert, und der Assistent hat dann oft gar nicht geantwortet.
  - **Verbindungsabbruch:** Bricht agy wegen eines Verbindungs- oder Modellfehlers ab, erkennt Mango das an der Fehlermeldung der CLI und sendet die Nachricht nach kurzer Pause einmal neu. Das gilt auch für leere Antworten.
  - **Text erst am Ende:** Antworttext, den agy erst am Ende eines Schritts vollständig schickt, kommt jetzt auch an.
- **Klare Meldungen statt „leere Antwort“:**
  - Verweigert Antigravity eine Aktion, steht unter der Antwort „Nicht erlaubt: …“.
  - Bei einem Fehler zeigt Mango die Meldung der CLI im Fehlerkasten an.

## Download

- **`Mango-Facharbeit-Setup-0.2.3-beta.exe`** für Windows 10/11 (64 Bit).
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
- Geprüft wurde mit der echten agy 1.3.1 ohne Anmeldung: Erkennung, Aufrufparameter und Anmeldehinweis. Eine echte Antwort mit einem angemeldeten Google-Konto konnte ich nicht testen.
- Für macOS und Linux gibt es keine fertige Datei. Dort startest du die App mit Node.js über `npm start` bzw. `npm run desktop`.

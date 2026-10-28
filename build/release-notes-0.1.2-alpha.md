Dritte Testversion (Alpha) von **Mango Facharbeit**. Neu: Du kannst bei beiden KI-Anbietern das genaue Modell auswählen.

## Neu: Modellauswahl

- **Claude Code:**
  - „Standard“ (Voreinstellung der CLI)
  - die Modellfamilien **Fable, Opus, Sonnet und Haiku**, jeweils automatisch die neueste Version
  - feste Versionen wie Fable 5.1, Opus 5.5, Opus 4.8, Sonnet 5.5, Sonnet 4.6 oder Haiku 4.5
  - eine eigene Modell-ID
- **Antigravity:** Die App liest die verfügbaren Modelle mit `agy models` aus (z. B. Gemini 3.1 Pro). Eine eigene Modell-ID ist ebenfalls möglich.
- **Auswahl:**
  - über den Anbieter-Knopf im Eingabefeld; er zeigt jetzt auch das Modell, z. B. „Claude Code · Sonnet“
  - „Weitere Modelle …“ öffnet die vollständige Liste
  - in den Einstellungen: „Modell: … Ändern“
- Die Auswahl wird gespeichert und gilt ab der nächsten Nachricht, auch mitten in einem Chat. Der Gesprächsverlauf bleibt erhalten.
- Unter jeder Antwort steht, welches Modell tatsächlich geantwortet hat, z. B. „Claude Code · Opus 5.5“.
- Ist ein Modell für dein Konto nicht verfügbar, erscheint ein verständlicher Hinweis mit dem Knopf „Modell wählen“.

## Download

- **`Mango-Facharbeit-0.1.2-alpha-win-x64.exe`** für Windows 10/11 (64 Bit). Node.js muss nicht installiert sein.
- `….exe.sha256` enthält die Prüfsumme.

## Voraussetzung

Mindestens ein KI-Anbieter, installiert und einmal angemeldet:

- **Claude Code CLI:** in der PowerShell `irm https://claude.ai/install.ps1 | iex`, danach `claude auth login`
- **Antigravity CLI (agy):** in der PowerShell `irm https://antigravity.google/cli/install.ps1 | iex`, danach einmal `agy` starten und mit dem Google-Konto anmelden

## Starten

1. EXE herunterladen und doppelklicken.
2. Windows SmartScreen meldet einen „unbekannten Herausgeber“, weil diese Alpha nicht signiert ist: **Weitere Informationen → Trotzdem ausführen**.
3. Ein Konsolenfenster öffnet sich und muss geöffnet bleiben. Die App erscheint in einem eigenen Edge- bzw. Chrome-Fenster. Zum Beenden das Konsolenfenster schließen.

Projekte und Einstellungen aus 0.1.0-alpha und 0.1.1-alpha werden weiterverwendet. Ohne eigene Wahl nutzt die App wie bisher die Voreinstellung der jeweiligen CLI.

## Bekannte Einschränkungen der Alpha

- Die EXE ist nicht signiert (SmartScreen-Hinweis beim ersten Start).
- Welche festen Claude-Versionen dein Konto nutzen darf, kann die App vorab nicht prüfen. Nicht freigeschaltete Modelle meldet sie beim Senden.
- Die Antigravity-Anbindung, auch die Modellliste, wurde noch nicht mit einem echten Antigravity-Konto getestet. Antigravity kennt keinen reinen Lesemodus; bei der Übernahme einer bestehenden Arbeit schützt dort nur die Wiederherstellung veränderter Dateien durch die App.
- Für macOS und Linux gibt es keine fertige Datei; dort mit Node.js über `npm start` starten.
- Textauszüge aus PDF-Dateien gibt es nur, wenn `pdftotext` installiert ist; sonst liest der Anbieter die PDF selbst.

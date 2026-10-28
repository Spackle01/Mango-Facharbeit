Erste Testversion (Alpha) von **Mango Facharbeit**, einer chatzentrierten App, die durch die Facharbeit an der Fachoberschule begleitet: Mindmap und Thema, Recherche, Schreiben, Prüfung der Abgabe.

## Download

- **`Mango-Facharbeit-0.1.0-alpha-win-x64.exe`** für Windows 10/11 (64 Bit). Node.js muss nicht installiert sein.
- `….exe.sha256` enthält die Prüfsumme.

## Voraussetzung

Mindestens ein KI-Anbieter, installiert und einmal angemeldet:

- **Claude Code CLI:** in der PowerShell `irm https://claude.ai/install.ps1 | iex`, danach `claude auth login`
- **Antigravity CLI (agy):** in der PowerShell `irm https://antigravity.google/cli/install.ps1 | iex`, danach einmal `agy` starten und mit dem Google-Konto anmelden

Fehlt etwas, zeigt die App über dem Eingabefeld den nächsten Schritt mit dem passenden Befehl.

## Starten

1. EXE herunterladen und doppelklicken.
2. Windows SmartScreen meldet einen „unbekannten Herausgeber“, weil diese Alpha nicht signiert ist: **Weitere Informationen → Trotzdem ausführen**.
3. Ein Konsolenfenster öffnet sich und muss geöffnet bleiben. Die App erscheint in einem eigenen Edge- bzw. Chrome-Fenster. Zum Beenden das Konsolenfenster schließen.

Beim ersten Start entpackt die EXE die Programmdateien nach `%LOCALAPPDATA%\Mango-Facharbeit\programm`. Projektdaten liegen im gewählten Arbeitsraum-Ordner, Einstellungen unter `%APPDATA%\Mango-Facharbeit`.

## Enthalten

- Chat mit Claude Code oder Antigravity, Streaming, Stopp, Anbieterwechsel ohne Verlust des Projektstands
- Arbeitsstand mit 27 Aufgaben aus den Schulvorgaben (× Offen, ? In Arbeit, ✓ Erledigt)
- Arbeitsraum je Facharbeit mit Vorlagen, Anhängen (auch per Drag-and-drop), gesicherten Vorversionen
- Exporte: Gesprächsverläufe für den Anhang, Word-Datei mit Schulformatierung, ZIP-Sicherung
- Hell- und Dunkelmodus, mobile Ansicht

## Bekannte Einschränkungen der Alpha

- Die EXE ist nicht signiert (SmartScreen-Hinweis beim ersten Start).
- Die Antigravity-Anbindung folgt der offiziellen Headless-Dokumentation, wurde aber noch nicht mit einem echten Antigravity-Konto getestet.
- Für macOS und Linux gibt es keine fertige Datei; dort mit Node.js über `npm start` starten.
- Textauszüge aus PDF-Dateien gibt es nur, wenn `pdftotext` installiert ist; sonst liest der Anbieter die PDF selbst.

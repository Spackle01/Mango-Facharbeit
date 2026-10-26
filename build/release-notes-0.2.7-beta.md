Der Chat flackert nicht mehr, wenn die KI antwortet oder Dateien erstellt.

## Behoben

- **Chat-Glitch:** Während die KI schrieb, wurde die Antwort bei jedem Textstück neu gezeichnet und blendete jedes Mal wieder ein. Das sah aus wie Flackern. Jetzt blendet nur eine neue Nachricht einmal ein, und am Ende wird nur die fertige Antwort aktualisiert statt des ganzen Verlaufs.
- **Blockreste:** Beim Erstellen von Dateien und beim Aufräumen blitzten kurz Anfänge technischer Blöcke („```erst…“) im Chat auf. Sie werden jetzt von Anfang an ausgeblendet.
- **Kein Sprung am Ende:** Die Zeile „n Arbeitsschritte“ steht schon während der Antwort oben, deshalb springt der Text am Ende nicht mehr nach unten.

## Download



- **`Mango-Facharbeit-Setup-0.2.7-beta.exe`** für Windows 10/11 (64 Bit).
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
- Die nachgezeichnete Folienansicht kommt dem Original sehr nahe, ist aber nicht identisch (z. B. Effekte, Animationen, Diagramme und SmartArt fehlen; Diagramme erscheinen als Platzhalter). Das genaue Aussehen zeigt die Originalansicht oder „Im Programm öffnen“.
- Die Umwandlung über PowerPoint und Word ist neu und wurde nur mit LibreOffice getestet, nicht mit einer installierten Microsoft-Office-Version. Klappt sie nicht, bleibt die nachgezeichnete Ansicht.
- Word und Excel erscheinen ohne Office weiterhin vereinfacht.
- Für macOS und Linux gibt es keine fertige Datei. Dort startest du die App mit Node.js über `npm start` bzw. `npm run desktop`.

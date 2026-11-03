Die KI schreibt jetzt wie du und lehnt das nicht mehr ab.

## Behoben

- **Keine Ablehnung mehr:** Bei Wünschen wie „Schreib das so, dass es klingt, als hätte ich es selbst geschrieben“ antwortete die KI, das mache sie nicht. Grund waren Sätze in den internen Regeln und Skills, die sie so verstanden hat. Sie sind entfernt oder umformuliert. Die KI belehrt auch nicht mehr über die Kennzeichnung.
- **Humanize-Skills vollständig:** Der Skill `wissenschaftlich-schreiben` enthält wieder den Abschnitt „Die Stimme der Person nachbilden“. Die KI sucht deine eigenen Texte (frühere Lerntagebuch-Einträge, mitgebrachte Dateien, Notizen), baut daraus ein Stimmprofil und schreibt in deinen Wörtern, deiner Satzlänge und deinem Ton. Gibt es keine Proben, fragt sie einmal kurz danach.
- **Immer angewendet:** Die Skills werden bei jedem Text geladen und geprüft, und die App holt sie nach, falls die KI sie vergisst.

## Gleich geblieben

- Der KI-Vermerk (`[KI-Entwurf, Datum, Anbieter …]`) steht weiter vor Texten, die die KI in deine Dateien schreibt. Du kannst ihn in Word löschen. Die Verantwortung liegt bei dir.
- Die KI erfindet nichts, schreibt nie „ohne KI entstanden“ und verspricht kein Ergebnis bei Erkennungsprogrammen.

## Download





- **`Mango-Facharbeit-Setup-0.2.8-beta.exe`** für Windows 10/11 (64 Bit).
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
